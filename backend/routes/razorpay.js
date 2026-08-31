const express = require('express');
const { getDB } = require('../db/database');
const rz = require('../razorpayClient');
const { fetchPaymentLink } = rz;

const router = express.Router();

// POST /api/razorpay/order
router.post('/order', async (req, res) => {
  try {
    const { amount_paise, receipt, notes } = req.body;
    const order = await rz.createOrder({ amount: amount_paise, receipt, notes });
    res.json({ success: true, order });
  } catch (err) {
    console.error('Order error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/razorpay/buy — one-shot: DB order + payment link
router.post('/buy', async (req, res) => {
  try {
    const { customer_id, product_id, quantity = 1 } = req.body;
    if (!customer_id || !product_id)
      return res.status(400).json({ success: false, error: 'customer_id and product_id are required' });

    const db       = getDB();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    const product  = db.prepare('SELECT * FROM products  WHERE id = ?').get(product_id);

    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    if (!product)  return res.status(404).json({ success: false, error: 'Product not found' });
    if (product.stock < quantity)
      return res.status(400).json({ success: false, error: 'Insufficient stock' });

    const total_paise = product.price * quantity;

    // 1. Create pending order in DB
    const info = db.prepare(`
      INSERT INTO orders (customer_id, product_id, quantity, total_paise, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(customer_id, product_id, quantity, total_paise);
    const dbOrderId = info.lastInsertRowid;

    // 2. Create Razorpay payment link (real or mock)
    const link = await rz.createPaymentLink({
      amount:      total_paise,
      description: `FitIndia — ${product.name} x${quantity}`,
      customer: { name: customer.name, email: customer.email, contact: customer.phone || '' },
      notes:    { db_order_id: String(dbOrderId), product_name: product.name },
      dbOrderId,
    });

    // 3. Save link back to order
    db.prepare(`
      UPDATE orders
      SET payment_link = ?, razorpay_order_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(link.short_url, link.id, dbOrderId);

    // 4. Audit entry
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result)
      VALUES ('razorpay', 'checkout', ?, ?, ?, ?, 'pending')
    `).run(customer_id, dbOrderId, total_paise, `Payment link created for ${product.name} x${quantity}`);

    res.json({
      success:      true,
      db_order_id:  dbOrderId,
      payment_link: link.short_url,
      amount_paise: total_paise,
      amount_inr:   total_paise / 100,
      mock:         rz.MOCK,
    });
  } catch (err) {
    console.error('Buy error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/razorpay/cart — one payment link for one or more catalog products
// Body: { customer_id, items: [{ product_id, quantity }] }
router.post('/cart', async (req, res) => {
  try {
    const { customer_id, items } = req.body;
    if (!customer_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'customer_id and at least one cart item are required' });
    }

    const db = getDB();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const consolidated = new Map();
    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ success: false, error: 'Each cart item needs a valid product_id and positive quantity' });
      }
      consolidated.set(productId, (consolidated.get(productId) || 0) + quantity);
    }

    const cartItems = [];
    for (const [productId, quantity] of consolidated) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      if (!product) return res.status(404).json({ success: false, error: `Product ${productId} not found` });
      if (product.stock < quantity) {
        return res.status(400).json({ success: false, error: `${product.name}: only ${product.stock} in stock` });
      }
      cartItems.push({ product, quantity, total_paise: product.price * quantity });
    }

    const totalPaise = cartItems.reduce((sum, item) => sum + item.total_paise, 0);
    const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    let dbOrderId;
    db.exec('BEGIN');
    try {
      const info = db.prepare(`
        INSERT INTO orders (customer_id, product_id, quantity, total_paise, status)
        VALUES (?, NULL, ?, ?, 'pending')
      `).run(customer_id, totalQuantity, totalPaise);
      dbOrderId = info.lastInsertRowid;
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_paise, total_paise)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const item of cartItems) {
        insertItem.run(dbOrderId, item.product.id, item.quantity, item.product.price, item.total_paise);
      }
      db.exec('COMMIT');
    } catch (txErr) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw txErr;
    }
    const itemSummary = cartItems.map(item => `${item.product.name} x${item.quantity}`).join(', ');

    const link = await rz.createPaymentLink({
      amount: totalPaise,
      description: `FitIndia Cart — ${itemSummary}`.slice(0, 255),
      customer: { name: customer.name, email: customer.email, contact: customer.phone || '' },
      notes: { db_order_id: String(dbOrderId), order_type: 'cart', item_count: String(cartItems.length) },
      dbOrderId,
    });

    db.prepare(`
      UPDATE orders SET payment_link = ?, razorpay_order_id = ?, updated_at = datetime('now') WHERE id = ?
    `).run(link.short_url, link.id, dbOrderId);
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
      VALUES ('razorpay', 'checkout', ?, ?, ?, ?, 'pending', ?)
    `).run(customer_id, dbOrderId, totalPaise, `Cart checkout: ${itemSummary}`, JSON.stringify({ items: cartItems.map(item => ({ product_id: item.product.id, name: item.product.name, quantity: item.quantity })) }));

    res.json({
      success: true,
      db_order_id: dbOrderId,
      payment_link: link.short_url,
      amount_paise: totalPaise,
      amount_inr: totalPaise / 100,
      items: cartItems.map(item => ({ product_id: item.product.id, name: item.product.name, quantity: item.quantity, total_inr: item.total_paise / 100 })),
      mock: rz.MOCK,
    });
  } catch (err) {
    console.error('Cart checkout error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/razorpay/payment-link — standalone link (used by agents)
router.post('/payment-link', async (req, res) => {
  try {
    const { amount_paise, customer, description, order_id } = req.body;
    const link = await rz.createPaymentLink({
      amount:      amount_paise,
      description: description || 'FitIndia Purchase',
      customer:    customer    || {},
      notes:       { order_id: order_id || '' },
      dbOrderId:   order_id,
    });

    if (order_id) {
      const db = getDB();
      db.prepare(`UPDATE orders SET payment_link = ?, razorpay_order_id = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(link.short_url, link.id, order_id);
    }

    res.json({ success: true, link, mock: rz.MOCK });
  } catch (err) {
    console.error('Payment-link error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/razorpay/orders
router.get('/orders', (_req, res) => {
  const db     = getDB();
  const orders = db.prepare(`
    SELECT o.*, c.name AS customer_name,
      COALESCE(p.name, (
        SELECT group_concat(pr.name, ', ')
        FROM order_items oi JOIN products pr ON pr.id = oi.product_id
        WHERE oi.order_id = o.id
      ), 'Cart order') AS product_name
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN products  p ON o.product_id  = p.id
    ORDER BY o.created_at DESC LIMIT 50
  `).all();
  res.json({ success: true, orders, mock: rz.MOCK });
});

// GET /api/razorpay/orders/:id
router.get('/orders/:id', (req, res) => {
  const db    = getDB();
  const order = db.prepare(`
    SELECT o.*, c.name AS customer_name,
      COALESCE(p.name, (
        SELECT group_concat(pr.name, ', ')
        FROM order_items oi JOIN products pr ON pr.id = oi.product_id
        WHERE oi.order_id = o.id
      ), 'Cart order') AS product_name
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN products  p ON o.product_id  = p.id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!order) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, order });
});

// GET /api/razorpay/test-connection — verify Razorpay credentials + network
router.get('/test-connection', async (req, res) => {
  if (rz.MOCK) return res.json({ success: true, mode: 'mock', message: 'Mock mode active — no real API call' });
  try {
    const rzInstance = new (require('razorpay'))({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    await rzInstance.orders.all({ count: 1 });
    res.json({ success: true, mode: 'live', message: 'Razorpay API reachable — credentials valid' });
  } catch (err) {
    const msg = err?.error?.description || err?.message || String(err);
    res.status(502).json({ success: false, message: `Cannot reach Razorpay: ${msg}` });
  }
});

// POST /api/razorpay/sync-status
// Polls Razorpay for all pending orders and marks paid ones — needed because
// webhooks can't reach localhost during local development.
router.post('/sync-status', async (req, res) => {
  if (rz.MOCK) {
    return res.json({ success: true, synced: 0, checked: 0, message: 'Mock mode — no real Razorpay to sync' });
  }

  const db = getDB();
  const pendingOrders = db.prepare(`
    SELECT o.*, c.name AS customer_name
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.status = 'pending'
      AND o.razorpay_order_id IS NOT NULL
      AND o.razorpay_order_id LIKE 'plink_%'
  `).all();

  let synced = 0;
  const results = [];

  for (const order of pendingOrders) {
    try {
      const pl = await fetchPaymentLink(order.razorpay_order_id);
      if (pl && pl.status === 'paid') {
        db.prepare(`UPDATE orders SET status='paid', updated_at=datetime('now') WHERE id=?`).run(order.id);
        db.prepare(`
          INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result)
          VALUES ('webhook', 'payment', ?, ?, ?, 'Payment confirmed via Razorpay sync', 'success')
        `).run(order.customer_id, order.id, order.total_paise);
        synced++;
        results.push({ order_id: order.id, customer: order.customer_name, status: 'paid' });
      } else {
        results.push({ order_id: order.id, customer: order.customer_name, status: pl?.status || 'unknown' });
      }
    } catch (err) {
      results.push({ order_id: order.id, error: err.message });
    }
  }

  res.json({ success: true, synced, checked: pendingOrders.length, results });
});

// POST /api/razorpay/mock-pay — manually resolve a mock payment as success or failure
// Body: { db_order_id, outcome: 'success' | 'fail' }
router.post('/mock-pay', (req, res) => {
  if (!rz.MOCK) return res.status(400).json({ success: false, error: 'Only available in mock mode' });
  const { db_order_id, outcome = 'success' } = req.body;
  if (!db_order_id) return res.status(400).json({ success: false, error: 'db_order_id required' });

  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(db_order_id);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

  if (outcome === 'success') {
    const paymentId = `pay_mock_${Date.now()}`;
    db.prepare(`UPDATE orders SET status='paid', razorpay_payment_id=?, updated_at=datetime('now') WHERE id=?`).run(paymentId, db_order_id);
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
      VALUES ('mock_webhook', 'payment', ?, ?, ?, 'Mock payment captured (manual)', 'success', ?)
    `).run(order.customer_id, db_order_id, order.total_paise, JSON.stringify({ event: 'mock.captured', payment_id: paymentId }));
    res.json({ success: true, status: 'paid', payment_id: paymentId });
  } else {
    db.prepare(`UPDATE orders SET status='failed', updated_at=datetime('now') WHERE id=?`).run(db_order_id);
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
      VALUES ('retry_agent', 'payment_failed', ?, ?, ?, 'Mock payment failed (manual simulation)', 'failed', ?)
    `).run(order.customer_id, db_order_id, order.total_paise, JSON.stringify({ simulated: true }));
    res.json({ success: true, status: 'failed' });
  }
});

module.exports = router;
