// Direction 2 — AI Buyer Agent
// Bot reads /api/catalog, decides what to buy (with reasoning), calls /api/buy, logs to audit

const Groq = require('groq-sdk');
const { getDB } = require('../db/database');
const { createPaymentLink } = require('../razorpayClient');

const MOCK_AI = process.env.MOCK_AI === 'true';

// ── Tool definitions (OpenAI-compatible format for Groq) ──────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name:        'browse_catalog',
      description: 'Fetch the full FitIndia product catalog. Returns all available products with ID, name, price, stock, and category.',
      parameters:  { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name:        'place_order',
      description: 'Purchase a product from FitIndia. Creates a DB order and returns a payment link.',
      parameters: {
        type: 'object',
        properties: {
          product_id:  { type: 'integer', description: 'Product ID from the catalog' },
          quantity:    { type: 'integer', description: 'Number of units to buy (min 1)' },
          reasoning:   { type: 'string',  description: 'Why you are buying this product and quantity' },
        },
        required: ['product_id', 'quantity', 'reasoning'],
      },
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────────
async function executeTool(toolName, toolInput, botCustomerId) {
  const db = getDB();

  if (toolName === 'browse_catalog') {
    const products = db.prepare('SELECT * FROM products WHERE stock > 0 ORDER BY id').all();
    return {
      store:    'FitIndia',
      currency: 'INR',
      products: products.map(p => ({
        id: p.id, name: p.name, description: p.description,
        price_inr: p.price / 100, category: p.category, stock: p.stock,
      })),
    };
  }

  if (toolName === 'place_order') {
    const { product_id, quantity, reasoning } = toolInput;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(botCustomerId);
    const product  = db.prepare('SELECT * FROM products  WHERE id = ?').get(product_id);

    if (!customer) return { success: false, error: 'Bot customer not found' };
    if (!product)  return { success: false, error: `Product ${product_id} not found` };
    if (product.stock < quantity) return { success: false, error: `Only ${product.stock} in stock` };

    const total   = product.price * quantity;
    const info    = db.prepare(`
      INSERT INTO orders (customer_id, product_id, quantity, total_paise, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(botCustomerId, product_id, quantity, total);
    const dbOrderId = info.lastInsertRowid;

    const link = await createPaymentLink({
      amount:      total,
      description: `FitIndia Bot — ${product.name} x${quantity}`,
      customer:    { name: customer.name, email: customer.email, contact: '' },
      notes:       { db_order_id: String(dbOrderId), agent: 'buyer_agent', reasoning: reasoning.slice(0, 100) },
      dbOrderId,
    });

    db.prepare(`
      UPDATE orders SET payment_link=?, razorpay_order_id=?, updated_at=datetime('now') WHERE id=?
    `).run(link.short_url, link.id, dbOrderId);

    // Write audit log immediately per purchase
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
      VALUES ('buyer_agent', 'catalog_buy', ?, ?, ?, ?, 'pending', ?)
    `).run(
      botCustomerId, dbOrderId, total, reasoning,
      JSON.stringify({ product: product.name, quantity, payment_link: link.short_url }),
    );

    return {
      success:      true,
      order_id:     dbOrderId,
      product:      product.name,
      quantity,
      amount_inr:   total / 100,
      payment_link: link.short_url,
    };
  }

  return { error: `Unknown tool: ${toolName}` };
}

// ── Mock buyer (no Claude API) ───────────────────────────────────────────────
async function mockBuyer({ botCustomerId, goal, targetProductName, quantity = 1 }) {
  const db      = getDB();
  const product = db.prepare(`
    SELECT * FROM products WHERE LOWER(name) LIKE LOWER(?) AND stock >= ? LIMIT 1
  `).get(`%${targetProductName}%`, quantity);

  if (!product) {
    return { success: false, error: `Product matching "${targetProductName}" not found or insufficient stock` };
  }

  const reasoning = `Bot goal: "${goal}". Selected ${product.name} (₹${product.price / 100} each) x${quantity} = ₹${(product.price * quantity) / 100}. Bulk purchase for resale/distribution.`;
  const result    = await executeTool('place_order', { product_id: product.id, quantity, reasoning }, botCustomerId);

  return {
    success:   result.success,
    reasoning,
    purchases: result.success ? [result] : [],
    error:     result.error,
  };
}

// ── Real Groq agentic loop ───────────────────────────────────────────────────
async function groqBuyer({ botCustomerId, goal }) {
  const groq     = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const db       = getDB();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(botCustomerId);

  const systemPrompt = `You are ${customer?.name || 'an AI buyer bot'}, an automated purchasing agent for a fitness supply business.

Your goal: ${goal}

Instructions:
1. Call browse_catalog to see what's available
2. Decide which product(s) to buy and in what quantity based on your goal
3. Call place_order for each purchase with clear reasoning
4. You may place multiple orders if your goal requires it
5. Be cost-effective and only buy what serves the stated goal`;

  let messages    = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: `Execute your purchasing goal: ${goal}` },
  ];
  const purchases = [];
  let summary     = '';

  for (let i = 0; i < 8; i++) {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile', max_tokens: 1024, messages, tools: TOOLS,
    });

    const msg          = response.choices[0].message;
    const finishReason = response.choices[0].finish_reason;

    if (finishReason === 'stop' || !msg.tool_calls?.length) {
      summary = msg.content || '';
      break;
    }

    if (finishReason === 'tool_calls') {
      const toolResults = [];

      for (const toolCall of msg.tool_calls) {
        const toolName  = toolCall.function.name;
        const toolInput = JSON.parse(toolCall.function.arguments);
        const result    = await executeTool(toolName, toolInput, botCustomerId);
        if (toolName === 'place_order' && result.success) purchases.push(result);
        toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }

      messages = [...messages, msg, ...toolResults];
      continue;
    }

    summary = msg.content || '';
    break;
  }

  return { success: true, purchases, summary };
}

// ── Public function ───────────────────────────────────────────────────────────
async function runBuyerAgent({ botCustomerId, goal, targetProductName, quantity }) {
  const db = getDB();

  // Verify this is a bot customer
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND type = ?').get(botCustomerId, 'bot');
  if (!customer) return { success: false, error: 'Customer not found or not a bot account' };

  let result;
  try {
    result = MOCK_AI
      ? await mockBuyer({ botCustomerId, goal, targetProductName, quantity })
      : await groqBuyer({ botCustomerId, goal });
  } catch (err) {
    console.error('[buyer agent] error:', err.message);
    return { success: false, error: err.message };
  }

  return {
    ...result,
    bot:       customer.name,
    mock_ai:   MOCK_AI,
  };
}

module.exports = { runBuyerAgent };
