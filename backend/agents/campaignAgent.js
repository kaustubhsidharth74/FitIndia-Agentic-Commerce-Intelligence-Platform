// Direction 4 — Campaign Orchestrator Agent
// Flow: scan abandoned carts → AI personalizes message → send reminder payment links → track conversions → audit log

const Groq = require('groq-sdk');
const { getDB } = require('../db/database');
const { createPaymentLink } = require('../razorpayClient');
const guardrails = require('../config/guardrails');

const MIN_AGE_HOURS = Number(process.env.CAMPAIGN_MIN_AGE_HOURS ?? 2);

function makeGroqClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'your_groq_api_key_here') return null;
  return new Groq({ apiKey: key });
}

const groqClient = makeGroqClient();

// ── Fallback templates (used when Groq key not set) ───────────────────────────

function buildFallbackMessage(customer, product, attempt) {
  const messages = [
    `Hi ${customer.name}! You left ${product.name} in your cart. Complete your purchase before it sells out!`,
    `${customer.name}, your ${product.name} is still waiting! Here's a fresh payment link just for you.`,
    `Final reminder, ${customer.name} — your ${product.name} order is still pending. Tap below to complete payment.`,
  ];
  return messages[Math.min(attempt - 1, messages.length - 1)];
}

// ── Groq tool definition ──────────────────────────────────────────────────────

const COMPOSE_TOOL = {
  type: 'function',
  function: {
    name: 'compose_campaign_message',
    description: 'Compose a personalized SMS-friendly abandoned cart recovery message for this customer',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The personalized recovery message (max 160 chars, conversational, no emojis)',
        },
        tone: {
          type: 'string',
          enum: ['friendly', 'urgent', 'final'],
          description: 'Tone based on reminder attempt and customer history',
        },
        reasoning: {
          type: 'string',
          description: 'One line explaining why this message fits this customer',
        },
      },
      required: ['message', 'tone', 'reasoning'],
    },
  },
};

// ── AI message generator ──────────────────────────────────────────────────────

async function buildAIMessage(customer, product, orderHistory, attempt) {
  if (!groqClient) {
    return {
      message: buildFallbackMessage(customer, product, attempt),
      tone: attempt === 1 ? 'friendly' : attempt === 2 ? 'urgent' : 'final',
      reasoning: 'Groq key not configured — used fallback template',
      ai_powered: false,
    };
  }

  const historyText = orderHistory.length
    ? orderHistory.map(o => `${o.product_name} — ₹${(o.total_paise / 100).toFixed(0)} (${o.status})`).join(', ')
    : 'No prior purchases';

  const systemPrompt = `You are a campaign agent for FitIndia, an Indian fitness e-commerce store.
Your job is to write a short, personalized abandoned cart recovery message.
Rules: max 160 chars, no emojis, natural Indian English, address customer by first name only, mention the product name, include urgency appropriate to the attempt number.`;

  const userPrompt = `Customer: ${customer.name}
Abandoned product: ${product.name} (₹${(product.price / 100).toFixed(0)})
Order history: ${historyText}
Reminder attempt: ${attempt} of 3
${attempt === 3 ? 'This is the final reminder — be clear this is the last chance.' : ''}

Call compose_campaign_message with a personalized message for this customer.`;

  const response = await groqClient.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    tools: [COMPOSE_TOOL],
    tool_choice: 'required',
    max_tokens: 256,
    temperature: 0.7,
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error('Groq did not return a tool call');

  const args = JSON.parse(toolCall.function.arguments);
  return { ...args, ai_powered: true };
}

// ── Main agent function ───────────────────────────────────────────────────────

async function runCampaignAgent() {
  const db = getDB();

  // 1. Find pending orders older than MIN_AGE_HOURS
  const abandonedOrders = db.prepare(`
    SELECT o.*, c.name AS customer_name, c.email AS customer_email,
           c.phone AS customer_phone, p.name AS product_name,
           p.price AS product_price
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN products  p ON p.id = o.product_id
    WHERE o.status = 'pending'
      AND o.created_at <= datetime('now', '-' || ? || ' hours')
    ORDER BY o.created_at ASC
  `).all(MIN_AGE_HOURS);

  // 2. Check which previously-reminded orders converted
  const remindedOrderIds = db.prepare(`
    SELECT DISTINCT order_id FROM audit_log
    WHERE action_type = 'campaign' AND order_id IS NOT NULL
  `).all().map(r => r.order_id);

  const conversions = [];
  for (const oid of remindedOrderIds) {
    const order = db.prepare('SELECT id, status, customer_id FROM orders WHERE id = ?').get(oid);
    if (!order) continue;

    const alreadyLogged = db.prepare(`
      SELECT id FROM audit_log WHERE action_type = 'campaign_converted' AND order_id = ?
    `).get(oid);

    if (order.status === 'paid' && !alreadyLogged) {
      db.prepare(`
        INSERT INTO audit_log (agent, action_type, customer_id, order_id, reason, result)
        VALUES ('campaign_agent', 'campaign_converted', ?, ?, 'Customer paid after campaign reminder', 'success')
      `).run(order.customer_id, oid);
      conversions.push(oid);
    }
  }

  // 3. Process each abandoned order
  const campaignResults = [];

  for (const order of abandonedOrders) {
    const priorReminders = db.prepare(`
      SELECT COUNT(*) AS n FROM audit_log WHERE action_type = 'campaign' AND order_id = ?
    `).get(order.id)?.n || 0;

    const maxReminders = guardrails.get().max_reminders_per_order;
    if (priorReminders >= maxReminders) {
      campaignResults.push({
        order_id: order.id,
        customer: order.customer_name,
        product:  order.product_name,
        status:   'skipped',
        reason:   `Max reminders (${maxReminders}) already sent`,
      });
      continue;
    }

    const attempt = priorReminders + 1;

    // Fetch customer order history for AI personalization
    const orderHistory = db.prepare(`
      SELECT o.status, o.total_paise, p.name AS product_name
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE o.customer_id = ? AND o.id != ?
      ORDER BY o.created_at DESC
      LIMIT 5
    `).all(order.customer_id, order.id);

    // Generate personalized message via Groq (or fallback)
    let composed;
    try {
      composed = await buildAIMessage(
        { name: order.customer_name },
        { name: order.product_name, price: order.product_price },
        orderHistory,
        attempt,
      );
    } catch (err) {
      composed = {
        message: buildFallbackMessage({ name: order.customer_name }, { name: order.product_name }, attempt),
        tone: 'friendly',
        reasoning: `Groq error: ${err.message}`,
        ai_powered: false,
      };
    }

    // Create a fresh payment link
    let link;
    try {
      link = await createPaymentLink({
        amount:      order.total_paise,
        description: `FitIndia Recovery — ${order.product_name} (reminder #${attempt})`,
        customer: {
          name:    order.customer_name,
          email:   order.customer_email,
          contact: order.customer_phone || '',
        },
        notes: {
          db_order_id:  String(order.id),
          agent:        'campaign_agent',
          reminder_num: String(attempt),
        },
        dbOrderId: order.id,
      });
    } catch (err) {
      campaignResults.push({
        order_id: order.id,
        customer: order.customer_name,
        product:  order.product_name,
        status:   'error',
        reason:   err.message,
      });
      continue;
    }

    db.prepare(`
      UPDATE orders SET payment_link = ?, razorpay_order_id = ?, updated_at = datetime('now') WHERE id = ?
    `).run(link.short_url, link.id, order.id);

    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
      VALUES ('campaign_agent', 'campaign', ?, ?, ?, ?, 'pending', ?)
    `).run(
      order.customer_id,
      order.id,
      order.total_paise,
      `Reminder #${attempt} [${composed.tone}]: ${composed.message}`,
      JSON.stringify({
        attempt,
        payment_link:  link.short_url,
        message:       composed.message,
        tone:          composed.tone,
        reasoning:     composed.reasoning,
        ai_powered:    composed.ai_powered,
      }),
    );

    campaignResults.push({
      order_id:     order.id,
      customer:     order.customer_name,
      product:      order.product_name,
      amount_inr:   order.total_paise / 100,
      attempt,
      message:      composed.message,
      tone:         composed.tone,
      reasoning:    composed.reasoning,
      ai_powered:   composed.ai_powered,
      payment_link: link.short_url,
      status:       'reminded',
    });
  }

  return {
    success:            true,
    ai_powered:         !!groqClient,
    min_age_hours:      MIN_AGE_HOURS,
    abandoned_found:    abandonedOrders.length,
    reminded:           campaignResults.filter(r => r.status === 'reminded').length,
    skipped:            campaignResults.filter(r => r.status === 'skipped').length,
    errors:             campaignResults.filter(r => r.status === 'error').length,
    conversions_logged: conversions.length,
    results:            campaignResults,
  };
}

module.exports = { runCampaignAgent };
