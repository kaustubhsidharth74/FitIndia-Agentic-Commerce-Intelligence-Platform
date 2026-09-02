// Direction 1 — Conversational Checkout Agent
// Customer types intent → Groq searches catalog + creates payment link → confirms in chat

const Groq = require('groq-sdk');
const { getDB } = require('../db/database');
const { createPaymentLink } = require('../razorpayClient');

const MOCK_AI = process.env.MOCK_AI === 'true';

// ── Tool definitions (OpenAI-compatible format for Groq) ──────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name:        'search_catalog',
      description: 'Search the FitIndia product catalog by name or category. Returns matching products with price and stock.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Product name, keyword, or category to search for' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name:        'create_payment_link',
      description: 'Create a Razorpay payment link for the customer to pay for a product. Call this only after confirming the product with the customer.',
      parameters: {
        type: 'object',
        properties: {
          product_id:  { type: 'integer', description: 'ID of the product to purchase' },
          quantity:    { type: 'integer', description: 'Quantity to purchase (default 1)' },
          customer_id: { type: 'integer', description: 'Customer ID making the purchase' },
        },
        required: ['product_id', 'customer_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name:        'check_payment_status',
      description: 'Check if a specific order has been paid. Use when the customer says they have completed payment.',
      parameters: {
        type: 'object',
        properties: {
          order_id: { type: 'integer', description: 'The DB order ID to check' },
        },
        required: ['order_id'],
      },
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────────
async function executeTool(toolName, toolInput, customerId) {
  const db = getDB();

  if (toolName === 'search_catalog') {
    const query = toolInput.query.toLowerCase();
    const products = db.prepare('SELECT * FROM products WHERE stock > 0').all();
    const matches  = products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.category || '').toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query)
    );
    if (matches.length === 0) return { found: false, message: 'No products found matching your query.' };
    return {
      found:    true,
      products: matches.map(p => ({
        id:          p.id,
        name:        p.name,
        description: p.description,
        price_inr:   p.price / 100,
        category:    p.category,
        stock:       p.stock,
      })),
    };
  }

  if (toolName === 'create_payment_link') {
    const { product_id, quantity = 1, customer_id: cid } = toolInput;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(cid || customerId);
    const product  = db.prepare('SELECT * FROM products  WHERE id = ?').get(product_id);

    if (!customer) return { success: false, error: 'Customer not found' };
    if (!product)  return { success: false, error: 'Product not found' };
    if (product.stock < quantity) return { success: false, error: 'Insufficient stock' };

    const total = product.price * quantity;

    const orderInfo = db.prepare(`
      INSERT INTO orders (customer_id, product_id, quantity, total_paise, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(customer.id, product_id, quantity, total);
    const dbOrderId = orderInfo.lastInsertRowid;

    const link = await createPaymentLink({
      amount:      total,
      description: `FitIndia Chat — ${product.name} x${quantity}`,
      customer:    { name: customer.name, email: customer.email, contact: customer.phone || '' },
      notes:       { db_order_id: String(dbOrderId), agent: 'checkout_agent' },
      dbOrderId,
    });

    db.prepare(`
      UPDATE orders SET payment_link=?, razorpay_order_id=?, updated_at=datetime('now') WHERE id=?
    `).run(link.short_url, link.id, dbOrderId);

    return {
      success:      true,
      order_id:     dbOrderId,
      product_name: product.name,
      quantity,
      amount_inr:   total / 100,
      payment_link: link.short_url,
    };
  }

  if (toolName === 'check_payment_status') {
    const order = db.prepare('SELECT id, status, total_paise FROM orders WHERE id = ?').get(toolInput.order_id);
    if (!order) return { found: false };
    return { found: true, order_id: order.id, status: order.status, amount_inr: order.total_paise / 100 };
  }

  return { error: `Unknown tool: ${toolName}` };
}

// ── Mock checkout (no Claude API needed) ─────────────────────────────────────
async function mockCheckout(messages, customerId) {
  const db       = getDB();
  const lastMsg  = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const lower    = lastMsg.toLowerCase();
  const products = db.prepare('SELECT * FROM products WHERE stock > 0').all();

  // Check payment confirmation
  if (lower.includes('paid') || lower.includes('done') || lower.includes('completed')) {
    return { reply: 'Thank you! If your payment went through, your order is confirmed. Check the Audit Trail page to see it logged. 🎉', paymentLink: null };
  }

  // Match a product
  const match = products.find(p => lower.includes(p.name.toLowerCase().split(' ')[0].toLowerCase()));
  if (!match) {
    const list = products.map(p => `• ${p.name} — ₹${p.price / 100}`).join('\n');
    return {
      reply: `Hi! I'm the FitIndia AI. Here's what we have:\n\n${list}\n\nWhich product would you like to buy?`,
      paymentLink: null,
    };
  }

  // Create payment link for matched product
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return { reply: 'Could not identify customer. Please refresh the page.', paymentLink: null };

  const total     = match.price;
  const orderInfo = db.prepare(`INSERT INTO orders (customer_id, product_id, quantity, total_paise, status) VALUES (?,?,1,?,'pending')`).run(customer.id, match.id, total);
  const dbOrderId = orderInfo.lastInsertRowid;

  const link = await createPaymentLink({
    amount: total, description: `FitIndia Chat — ${match.name}`,
    customer: { name: customer.name, email: customer.email, contact: customer.phone || '' },
    notes: { db_order_id: String(dbOrderId), agent: 'checkout_agent_mock' }, dbOrderId,
  });
  db.prepare(`UPDATE orders SET payment_link=?,razorpay_order_id=?,updated_at=datetime('now') WHERE id=?`).run(link.short_url, link.id, dbOrderId);

  return {
    reply:       `Great choice! **${match.name}** costs ₹${match.price / 100}. I've created a payment link just for you, ${customer.name}. Click the button below to complete your purchase!`,
    paymentLink: link.short_url,
    orderId:     dbOrderId,
  };
}

// ── Real Groq agentic loop ───────────────────────────────────────────────────
async function groqCheckout(messages, customerId) {
  const groq     = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const db       = getDB();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);

  const systemPrompt = `You are the FitIndia AI shopping assistant. Help customers browse products and complete purchases inside this chat.

Customer: ${customer?.name || 'Guest'} (ID: ${customerId})

Rules:
- Use search_catalog to find products before quoting prices
- Always confirm the product and price with the customer before calling create_payment_link
- After creating a payment link, tell the customer to click it to pay
- If the customer says they paid, use check_payment_status to verify and confirm
- Be friendly, concise, and helpful
- All prices are in Indian Rupees (₹)`;

  let currentMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ];

  let paymentLink = null;
  let orderId     = null;
  let finalReply  = '';

  // Agentic loop — max 5 iterations
  for (let i = 0; i < 5; i++) {
    const response = await groq.chat.completions.create({
      model:      'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages:   currentMessages,
      tools:      TOOLS,
    });

    const msg          = response.choices[0].message;
    const finishReason = response.choices[0].finish_reason;

    if (finishReason === 'stop' || !msg.tool_calls?.length) {
      finalReply = msg.content || '';
      break;
    }

    if (finishReason === 'tool_calls') {
      const toolResults = [];

      for (const toolCall of msg.tool_calls) {
        const toolName  = toolCall.function.name;
        const toolInput = JSON.parse(toolCall.function.arguments);
        const result    = await executeTool(toolName, toolInput, customerId);

        if (toolName === 'create_payment_link' && result.success) {
          paymentLink = result.payment_link;
          orderId     = result.order_id;
        }

        toolResults.push({
          role:         'tool',
          tool_call_id: toolCall.id,
          content:      JSON.stringify(result),
        });
      }

      currentMessages = [...currentMessages, msg, ...toolResults];
      continue;
    }

    finalReply = msg.content || 'Something went wrong. Please try again.';
    break;
  }

  return { reply: finalReply, paymentLink, orderId };
}

// ── Public function ───────────────────────────────────────────────────────────
async function handleCheckoutMessage({ messages, customerId }) {
  const db = getDB();

  let result;
  try {
    result = MOCK_AI
      ? await mockCheckout(messages, customerId)
      : await groqCheckout(messages, customerId);
  } catch (err) {
    console.error('[checkout agent] error:', err.message);
    result = { reply: `Agent error: ${err.message}`, paymentLink: null };
  }

  // Log conversation turn to audit trail
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  db.prepare(`
    INSERT INTO audit_log (agent, action_type, customer_id, reason, result, metadata)
    VALUES ('checkout_agent', 'checkout', ?, ?, 'pending', ?)
  `).run(
    customerId || null,
    `User: "${lastUserMsg.slice(0, 120)}"`,
    JSON.stringify({ reply: result.reply?.slice(0, 200), payment_link: result.paymentLink, mock_ai: MOCK_AI }),
  );

  return result;
}

module.exports = { handleCheckoutMessage };
