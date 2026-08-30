const express = require('express');
const crypto  = require('crypto');
const { getDB } = require('../db/database');

const router = express.Router();

// POST /api/webhook  — Razorpay sends all events here
router.post('/', (req, res) => {
  const secret    = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  if (!secret) {
    // Dev mode: skip verification if webhook secret not yet configured
    console.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping signature check (dev mode)');
  } else {
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('hex');

    if (signature !== expectedSig) {
      console.warn('Webhook signature mismatch — rejected');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  console.log(`[webhook] ${event.event}`);
  const db = getDB();

  // ── payment_link.paid ──────────────────────────────────────────────────────
  // Fired when customer pays via a Razorpay Payment Link
  if (event.event === 'payment_link.paid') {
    const pl      = event.payload.payment_link.entity;
    const payment = event.payload.payment.entity;

    // Match by payment link ID stored in razorpay_order_id column
    db.prepare(`
      UPDATE orders
      SET status = 'paid',
          razorpay_payment_id = ?,
          updated_at = datetime('now')
      WHERE razorpay_order_id = ?
    `).run(payment.id, pl.id);

    db.prepare(`
      INSERT INTO audit_log (agent, action_type, amount_paise, result, metadata)
      VALUES ('webhook', 'payment', ?, 'success', ?)
    `).run(payment.amount, JSON.stringify({
      event:          'payment_link.paid',
      payment_id:     payment.id,
      payment_link_id: pl.id,
    }));

    console.log(`  ✓ Payment link ${pl.id} paid — ₹${payment.amount / 100}`);
  }

  // ── payment.captured ──────────────────────────────────────────────────────
  // Fired for Razorpay Order-based payments (checkout widget)
  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;

    db.prepare(`
      UPDATE orders
      SET status = 'paid',
          razorpay_payment_id = ?,
          updated_at = datetime('now')
      WHERE razorpay_order_id = ?
    `).run(payment.id, payment.order_id);

    db.prepare(`
      INSERT INTO audit_log (agent, action_type, amount_paise, result, metadata)
      VALUES ('webhook', 'payment', ?, 'success', ?)
    `).run(payment.amount, JSON.stringify({
      event:      'payment.captured',
      payment_id: payment.id,
      order_id:   payment.order_id,
    }));

    console.log(`  ✓ Payment ${payment.id} captured — ₹${payment.amount / 100}`);
  }

  // ── payment.failed ────────────────────────────────────────────────────────
  if (event.event === 'payment.failed') {
    const payment = event.payload.payment.entity;

    db.prepare(`
      UPDATE orders
      SET status = 'failed',
          updated_at = datetime('now')
      WHERE razorpay_order_id = ?
    `).run(payment.order_id);

    db.prepare(`
      INSERT INTO audit_log (agent, action_type, amount_paise, result, metadata)
      VALUES ('webhook', 'payment', ?, 'failed', ?)
    `).run(payment.amount, JSON.stringify({
      event:      'payment.failed',
      payment_id: payment.id,
      error:      payment.error_description,
    }));

    console.log(`  ✗ Payment ${payment.id} failed — ${payment.error_description}`);
  }

  // ── payment_link.expired / cancelled ─────────────────────────────────────
  if (event.event === 'payment_link.expired' || event.event === 'payment_link.cancelled') {
    const pl = event.payload.payment_link.entity;

    db.prepare(`
      UPDATE orders
      SET status = 'cancelled',
          updated_at = datetime('now')
      WHERE razorpay_order_id = ?
    `).run(pl.id);

    console.log(`  ○ Payment link ${pl.id} ${event.event}`);
  }

  res.json({ received: true });
});

module.exports = router;
