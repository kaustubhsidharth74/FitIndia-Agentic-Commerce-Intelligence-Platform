// Phase 9 — Failure Handling
// simulatePaymentFailure: marks an order as failed, logs payment_failed to audit
// runRetryAgent: retries once, logs every step, raises merchant_alert on second failure

const { getDB } = require('../db/database');
const { createPaymentLink } = require('../razorpayClient');

const MOCK_AI = process.env.MOCK_AI === 'true';

// ── Simulate a payment failure ────────────────────────────────────────────────
async function simulatePaymentFailure({ orderId }) {
  const db    = getDB();
  const order = db.prepare(`
    SELECT o.*, c.name AS customer_name, c.email, p.name AS product_name, p.price AS unit_price
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN products  p ON o.product_id  = p.id
    WHERE o.id = ?
  `).get(orderId);

  if (!order) return { success: false, error: `Order #${orderId} not found` };
  if (order.status === 'paid') return { success: false, error: `Order #${orderId} is already paid — cannot simulate failure` };

  // Mark order as failed
  db.prepare(`UPDATE orders SET status='failed', updated_at=datetime('now') WHERE id=?`).run(orderId);

  // Log payment_failed to audit
  db.prepare(`
    INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
    VALUES ('retry_agent', 'payment_failed', ?, ?, ?, ?, 'failed', ?)
  `).run(
    order.customer_id, orderId, order.total_paise,
    `Payment failed — ${order.customer_name}'s ${order.product_name} order. Reason: Card declined.`,
    JSON.stringify({ simulated: true, customer: order.customer_name, product: order.product_name }),
  );

  return {
    success:       true,
    order_id:      orderId,
    customer_name: order.customer_name,
    product_name:  order.product_name,
    amount_inr:    order.total_paise / 100,
    message:       `Payment failure simulated for ${order.customer_name}'s order #${orderId}.`,
  };
}

// ── Check how many retries have already been attempted for this order ─────────
function getRetryCount(db, orderId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS cnt FROM audit_log
    WHERE order_id = ? AND action_type = 'payment_retry'
  `).get(orderId);
  return row?.cnt || 0;
}

// ── Core retry logic ──────────────────────────────────────────────────────────
async function retryOrder({ order, forceRetryFail, db }) {
  const steps = [];

  // Step 1 — log retry attempt
  db.prepare(`
    INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
    VALUES ('retry_agent', 'payment_retry', ?, ?, ?, ?, 'pending', ?)
  `).run(
    order.customer_id, order.id, order.total_paise,
    `Retrying payment for ${order.customer_name}'s order #${order.id} (${order.product_name})`,
    JSON.stringify({ attempt: 1, customer: order.customer_name, product: order.product_name }),
  );
  steps.push({ step: 'retry_attempt', status: 'pending', message: `Retry initiated for order #${order.id}` });

  // Simulate small delay (agent "thinking")
  await new Promise(r => setTimeout(r, 800));

  const shouldFail = forceRetryFail || (process.env.MOCK_RETRY_FAIL === 'true');

  if (shouldFail) {
    // Step 2a — retry also failed
    db.prepare(`UPDATE orders SET status='failed', updated_at=datetime('now') WHERE id=?`).run(order.id);

    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
      VALUES ('retry_agent', 'payment_retry', ?, ?, ?, ?, 'failed', ?)
    `).run(
      order.customer_id, order.id, order.total_paise,
      `Retry failed — ${order.customer_name}'s card declined again on order #${order.id}`,
      JSON.stringify({ attempt: 1, outcome: 'failed' }),
    );
    steps.push({ step: 'retry_result', status: 'failed', message: 'Retry failed — card declined again' });

    // Step 3 — raise merchant alert
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
      VALUES ('retry_agent', 'merchant_alert', ?, ?, ?, ?, 'failed', ?)
    `).run(
      order.customer_id, order.id, order.total_paise,
      `ALERT: Manual intervention required for ${order.customer_name} — order #${order.id} (₹${order.total_paise / 100}). Both initial payment and retry failed.`,
      JSON.stringify({ customer: order.customer_name, product: order.product_name, amount_inr: order.total_paise / 100, alert_type: 'payment_retry_exhausted' }),
    );
    steps.push({ step: 'merchant_alert', status: 'failed', message: `Merchant alerted — order #${order.id} requires manual action` });

    return { success: false, retried: true, alerted: true, steps };
  } else {
    // Step 2b — retry succeeded: new payment link
    const link = await createPaymentLink({
      amount:      order.total_paise,
      description: `FitIndia Retry — ${order.product_name}`,
      customer:    { name: order.customer_name, email: order.email, contact: order.phone || '' },
      notes:       { db_order_id: String(order.id), agent: 'retry_agent', attempt: '1' },
      dbOrderId:   order.id,
    });

    db.prepare(`UPDATE orders SET status='pending', payment_link=?, updated_at=datetime('now') WHERE id=?`).run(link.short_url, order.id);

    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
      VALUES ('retry_agent', 'payment_retry', ?, ?, ?, ?, 'success', ?)
    `).run(
      order.customer_id, order.id, order.total_paise,
      `Retry succeeded — new payment link issued for ${order.customer_name}'s order #${order.id}`,
      JSON.stringify({ attempt: 1, outcome: 'success', payment_link: link.short_url }),
    );
    steps.push({ step: 'retry_result', status: 'success', message: 'Retry succeeded — new payment link issued' });

    return { success: true, retried: true, alerted: false, payment_link: link.short_url, steps };
  }
}

// ── Public: run retry agent ───────────────────────────────────────────────────
// body: { order_id?, force_retry_fail? }
// If order_id omitted → finds all failed orders with < 1 retry
async function runRetryAgent({ orderId, forceRetryFail = false } = {}) {
  const db = getDB();

  let failedOrders;
  if (orderId) {
    const o = db.prepare(`
      SELECT o.*, c.name AS customer_name, c.email, c.phone,
             p.name AS product_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN products  p ON o.product_id  = p.id
      WHERE o.id = ? AND o.status = 'failed'
    `).get(orderId);
    if (!o) return { success: false, error: `Order #${orderId} not found or not in failed state` };
    failedOrders = [o];
  } else {
    failedOrders = db.prepare(`
      SELECT o.*, c.name AS customer_name, c.email, c.phone,
             p.name AS product_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN products  p ON o.product_id  = p.id
      WHERE o.status = 'failed'
    `).all();
  }

  if (failedOrders.length === 0) {
    return { success: true, results: [], message: 'No failed orders to retry' };
  }

  const results = [];
  for (const order of failedOrders) {
    const retries = getRetryCount(db, order.id);
    if (retries >= 1) {
      results.push({
        order_id:      order.id,
        customer_name: order.customer_name,
        skipped:       true,
        reason:        'Already retried once — merchant alert should have been raised',
      });
      continue;
    }

    const result = await retryOrder({ order, forceRetryFail, db });
    results.push({
      order_id:      order.id,
      customer_name: order.customer_name,
      product_name:  order.product_name,
      amount_inr:    order.total_paise / 100,
      ...result,
    });
  }

  return { success: true, results };
}

module.exports = { simulatePaymentFailure, runRetryAgent };
