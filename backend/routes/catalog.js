const express  = require('express');
const { getDB } = require('../db/database');
const { createPaymentLink } = require('../razorpayClient');

const router = express.Router();

function formatProduct(p) {
  return {
    id:          p.id,
    name:        p.name,
    description: p.description,
    category:    p.category,
    price_paise: p.price,
    price_inr:   p.price / 100,
    stock:       p.stock,
    buyable:     p.stock > 0,
  };
}

// GET /api/catalog  — machine-readable product catalog for AI buyer agents
// Returns structured JSON with pricing, stock, and agent instructions
router.get('/', (_req, res) => {
  const db       = getDB();
  const products = db.prepare('SELECT * FROM products ORDER BY id').all();
  res.json({
    store:    'FitIndia',
    currency: 'INR',
    agent_instructions: 'To purchase, POST /api/buy with { customer_id, product_id, quantity }. Returns payment_link.',
    products: products.map(formatProduct),
  });
});

// GET /api/catalog/:id  — single product
router.get('/:id', (req, res) => {
  const db      = getDB();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(formatProduct(product));
});

// POST /api/buy  — agent-facing buy endpoint (cleaner URL than /api/razorpay/buy)
// Body: { customer_id, product_id, quantity? }
// Returns: { success, db_order_id, payment_link, amount_inr }
router.post('/buy', async (req, res) => {
  try {
    const { customer_id, product_id, quantity = 1 } = req.body;
    if (!customer_id || !product_id)
      return res.status(400).json({ success: false, error: 'customer_id and product_id required' });

    const db       = getDB();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    const product  = db.prepare('SELECT * FROM products  WHERE id = ?').get(product_id);

    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    if (!product)  return res.status(404).json({ success: false, error: 'Product not found' });
    if (product.stock < quantity)
      return res.status(400).json({ success: false, error: `Insufficient stock (${product.stock} available)` });

    const total = product.price * quantity;

    // Create pending order
    const info = db.prepare(`
      INSERT INTO orders (customer_id, product_id, quantity, total_paise, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(customer_id, product_id, quantity, total);
    const dbOrderId = info.lastInsertRowid;

    // Create payment link
    const link = await createPaymentLink({
      amount:      total,
      description: `FitIndia — ${product.name} x${quantity}`,
      customer:    { name: customer.name, email: customer.email, contact: customer.phone || '' },
      notes:       { db_order_id: String(dbOrderId), agent: 'buyer_agent' },
      dbOrderId,
    });

    db.prepare(`
      UPDATE orders SET payment_link=?, razorpay_order_id=?, updated_at=datetime('now') WHERE id=?
    `).run(link.short_url, link.id, dbOrderId);

    res.json({
      success:     true,
      db_order_id: dbOrderId,
      payment_link: link.short_url,
      amount_inr:  total / 100,
      product:     product.name,
      quantity,
      customer:    customer.name,
    });
  } catch (err) {
    console.error('/api/buy error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
