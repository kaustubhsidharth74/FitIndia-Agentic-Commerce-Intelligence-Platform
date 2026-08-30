// Direction 3 — Upsell & Cross-sell Agent
// Flow: read history → Claude decides upsell → guardrail check → payment link → audit log

const Anthropic = require('@anthropic-ai/sdk');
const { getDB } = require('../db/database');
const { createPaymentLink, MOCK: MOCK_RAZORPAY } = require('../razorpayClient');

const MOCK_AI    = process.env.MOCK_AI === 'true';
const guardrails = require('../config/guardrails');

// ── Guardrail ────────────────────────────────────────────────────────────────
function applyGuardrails(product, discountPercent) {
  const cfg    = guardrails.get();
  const errors = [];
  if (discountPercent > cfg.max_upsell_discount_pct)
    errors.push(`Discount ${discountPercent}% exceeds max allowed ${cfg.max_upsell_discount_pct}%`);

  const finalPrice = Math.round(product.price * (1 - discountPercent / 100));
  if (finalPrice > cfg.max_auto_approve_inr * 100)
    errors.push(`Amount ₹${finalPrice / 100} exceeds ₹${cfg.max_auto_approve_inr} no-approval limit`);

  return { passed: errors.length === 0, errors, finalPrice };
}

// ── Mock AI decision (used when MOCK_AI=true) ─────────────────────────────
function mockDecision(customer, orderHistory, catalog) {
  // Find products the customer has NOT bought
  const boughtIds = new Set(orderHistory.filter(o => o.status === 'paid').map(o => o.product_id));
  const unbought  = catalog.filter(p => !boughtIds.has(p.id) && p.stock > 0);

  if (unbought.length === 0) {
    // All products bought — suggest the cheapest one again with small discount
    const cheapest = [...catalog].sort((a, b) => a.price - b.price)[0];
    return {
      product_id:       cheapest.id,
      discount_percent: 10,
      reasoning:        `${customer.name} has purchased all products. Offering a repeat discount on ${cheapest.name} to drive loyalty.`,
      message:          `Hey ${customer.name}! As a valued customer, here's 10% off on ${cheapest.name}. Grab it while the offer lasts!`,
    };
  }

  // Pick the lowest-priced unbought product (easiest conversion)
  const target   = unbought.sort((a, b) => a.price - b.price)[0];
  const discount = orderHistory.filter(o => o.status === 'paid').length >= 3 ? 15 : 10;

  return {
    product_id:       target.id,
    discount_percent: discount,
    reasoning:        `${customer.name} has bought ${boughtIds.size} product(s) but never tried ${target.name}. Offering ${discount}% to encourage first purchase of a complementary item.`,
    message:          `Hi ${customer.name}! Since you love our products, we thought you'd love ${target.name} too. Grab it at ${discount}% off today!`,
  };
}

// ── Real Claude decision via tool-use ─────────────────────────────────────
async function claudeDecision(customer, orderHistory, catalog) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const historyText = orderHistory.length
    ? orderHistory.map(o =>
        `- ${o.product_name} x${o.quantity} | ₹${o.total_paise / 100} | ${o.status} | ${o.created_at}`
      ).join('\n')
    : '(no previous orders)';

  const catalogText = catalog.map(p =>
    `ID:${p.id} | ${p.name} | ₹${p.price / 100} | ${p.category} | stock:${p.stock}`
  ).join('\n');

  const response = await client.messages.create({
    model:      'claude-opus-5',
    max_tokens: 1024,
    tools: [{
      name:        'create_upsell_offer',
      description: 'Submit your upsell decision for this customer',
      input_schema: {
        type: 'object',
        properties: {
          product_id: {
            type:        'integer',
            description: 'ID of the product to upsell (from the catalog)',
          },
          discount_percent: {
            type:        'integer',
            description: 'Discount percentage to offer (0–30). Use 0 for no discount.',
          },
          reasoning: {
            type:        'string',
            description: 'Your internal reasoning — why this product for this customer',
          },
          message: {
            type:        'string',
            description: 'Short friendly message to the customer (1-2 sentences)',
          },
        },
        required: ['product_id', 'discount_percent', 'reasoning', 'message'],
      },
    }],
    tool_choice: { type: 'tool', name: 'create_upsell_offer' },
    messages: [{
      role:    'user',
      content: `You are an AI upsell agent for FitIndia, an Indian fitness e-commerce store.

CUSTOMER:
Name: ${customer.name}
Email: ${customer.email}
Type: ${customer.type}

ORDER HISTORY:
${historyText}

PRODUCT CATALOG:
${catalogText}

GUARDRAILS (non-negotiable):
- Max discount: ${guardrails.get().max_upsell_discount_pct}%
- Max order value without approval: ₹${guardrails.get().max_auto_approve_inr}
- Never upsell a product that is out of stock

Analyse the customer's purchase history and choose the single best product to upsell or cross-sell.
Call the create_upsell_offer tool with your decision.`,
    }],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('Claude did not call the upsell tool');
  return toolUse.input;
}

// ── Main agent function ───────────────────────────────────────────────────
async function runUpsellAgent(customerId) {
  const db = getDB();

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return { success: false, error: 'Customer not found' };

  const orderHistory = db.prepare(`
    SELECT o.*, p.name AS product_name
    FROM orders o
    LEFT JOIN products p ON p.id = o.product_id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
  `).all(customerId);

  const catalog = db.prepare('SELECT * FROM products WHERE stock > 0 ORDER BY price').all();

  // 1. Get AI decision
  let decision;
  try {
    decision = MOCK_AI
      ? mockDecision(customer, orderHistory, catalog)
      : await claudeDecision(customer, orderHistory, catalog);
  } catch (err) {
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, reason, result)
      VALUES ('upsell_agent', 'upsell', ?, ?, 'failed')
    `).run(customerId, `AI decision error: ${err.message}`);
    return { success: false, error: `AI error: ${err.message}` };
  }

  const { product_id, discount_percent, reasoning, message } = decision;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) {
    return { success: false, error: `AI picked invalid product_id ${product_id}` };
  }

  // 2. Guardrail check
  const guardrail = applyGuardrails(product, discount_percent);
  if (!guardrail.passed) {
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, reason, result, metadata)
      VALUES ('upsell_agent', 'upsell', ?, ?, 'failed', ?)
    `).run(customerId, `Guardrail blocked: ${guardrail.errors.join('; ')}`, JSON.stringify({ decision }));
    return { success: false, error: `Guardrail: ${guardrail.errors.join('; ')}`, decision };
  }

  const finalPaise = guardrail.finalPrice;

  // 3. Create pending order in DB
  const orderInfo = db.prepare(`
    INSERT INTO orders (customer_id, product_id, quantity, total_paise, status)
    VALUES (?, ?, 1, ?, 'pending')
  `).run(customerId, product_id, finalPaise);
  const dbOrderId = orderInfo.lastInsertRowid;

  // 4. Create payment link
  let link;
  try {
    link = await createPaymentLink({
      amount:      finalPaise,
      description: `FitIndia Upsell — ${product.name}${discount_percent > 0 ? ` (${discount_percent}% off)` : ''}`,
      customer:    { name: customer.name, email: customer.email, contact: customer.phone || '' },
      notes:       { db_order_id: String(dbOrderId), agent: 'upsell_agent', discount: String(discount_percent) },
      dbOrderId,
    });
  } catch (err) {
    db.prepare(`UPDATE orders SET status='failed' WHERE id=?`).run(dbOrderId);
    return { success: false, error: `Payment link error: ${err.message}` };
  }

  // Save link back to order
  db.prepare(`
    UPDATE orders SET payment_link=?, razorpay_order_id=?, updated_at=datetime('now') WHERE id=?
  `).run(link.short_url, link.id, dbOrderId);

  // 5. Audit log
  db.prepare(`
    INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
    VALUES ('upsell_agent', 'upsell', ?, ?, ?, ?, 'pending', ?)
  `).run(
    customerId, dbOrderId, finalPaise, reasoning,
    JSON.stringify({ product: product.name, discount_percent, message, mock_ai: MOCK_AI }),
  );

  return {
    success:          true,
    customer:         customer.name,
    product:          product.name,
    original_price:   product.price / 100,
    final_price:      finalPaise / 100,
    discount_percent,
    reasoning,
    message,
    payment_link:     link.short_url,
    db_order_id:      dbOrderId,
    mock_ai:          MOCK_AI,
    mock_razorpay:    MOCK_RAZORPAY,
  };
}

module.exports = { runUpsellAgent };
