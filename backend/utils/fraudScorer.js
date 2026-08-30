const { getDB } = require('../db/database');

const BLOCK_THRESHOLD = 80;
const VELOCITY_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const VELOCITY_MIN_ORDERS = 3;

function scoreOrder(order, allCustomerOrders, recentFailures, avgOrderValue) {
  let score = 0;
  const reasons = [];

  // Signal 1: multiple failed payments before this order succeeded
  if (recentFailures >= 2) {
    score += 30;
    reasons.push(`${recentFailures} failed payment attempts before success (card testing)`);
  } else if (recentFailures === 1) {
    score += 15;
    reasons.push('1 failed payment attempt before success');
  }

  // Signal 2: velocity — 3+ orders from same customer within 1 hour
  const windowStart = new Date(new Date(order.created_at + 'Z') - VELOCITY_WINDOW_MS).toISOString();
  const recentOrders = allCustomerOrders.filter(o =>
    o.id !== order.id && o.created_at >= windowStart.replace('T', ' ').slice(0, 19)
  );
  if (recentOrders.length >= VELOCITY_MIN_ORDERS - 1) {
    score += 25;
    reasons.push(`${recentOrders.length + 1} orders placed within 1 hour (velocity fraud)`);
  }

  // Signal 3: bot customer placing high-value order
  if (order.customer_type === 'bot' && order.total_paise > 500000) {
    score += 20;
    reasons.push('Bot customer with order value > ₹5,000');
  }

  // Signal 4: order value is 5x above average
  if (avgOrderValue > 0 && order.total_paise > avgOrderValue * 5) {
    score += 15;
    reasons.push(`Order value (₹${(order.total_paise / 100).toFixed(0)}) is 5x above average`);
  }

  // Signal 5: new customer, first order is highest-priced item
  if (allCustomerOrders.length === 1 && order.total_paise > 300000) {
    score += 10;
    reasons.push('New customer, first order is high-value item (₹3,000+)');
  }

  const riskLevel = score >= BLOCK_THRESHOLD ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    order_id:   order.id,
    score:      Math.min(score, 100),
    risk_level: riskLevel,
    reasons,
    should_block: score >= BLOCK_THRESHOLD,
  };
}

function getAverageOrderValue(db) {
  const row = db.prepare(`SELECT AVG(total_paise) AS avg FROM orders WHERE status != 'cancelled'`).get();
  return row?.avg || 0;
}

function getRecentFailures(db, customerId, beforeOrderId) {
  const order = db.prepare('SELECT created_at FROM orders WHERE id = ?').get(beforeOrderId);
  if (!order) return 0;

  const windowStart = new Date(new Date(order.created_at + 'Z') - VELOCITY_WINDOW_MS)
    .toISOString().replace('T', ' ').slice(0, 19);

  const row = db.prepare(`
    SELECT COUNT(*) AS cnt FROM orders
    WHERE customer_id = ? AND status = 'failed' AND created_at >= ? AND id < ?
  `).get(customerId, windowStart, beforeOrderId);

  return row?.cnt || 0;
}

function scoreAllOrders() {
  const db = getDB();
  const avgOrderValue = getAverageOrderValue(db);

  const orders = db.prepare(`
    SELECT o.*, c.type AS customer_type, c.name AS customer_name, p.name AS product_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN products  p ON p.id = o.product_id
    ORDER BY o.created_at DESC
    LIMIT 100
  `).all();

  return orders.map(order => {
    const allCustomerOrders = db.prepare(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at ASC'
    ).all(order.customer_id);

    const recentFailures = getRecentFailures(db, order.customer_id, order.id);
    const result = scoreOrder(order, allCustomerOrders, recentFailures, avgOrderValue);

    return {
      ...result,
      order,
    };
  });
}

function scoreSingleOrder(orderId) {
  const db = getDB();
  const avgOrderValue = getAverageOrderValue(db);

  const order = db.prepare(`
    SELECT o.*, c.type AS customer_type, c.name AS customer_name, p.name AS product_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN products  p ON p.id = o.product_id
    WHERE o.id = ?
  `).get(orderId);

  if (!order) return null;

  const allCustomerOrders = db.prepare(
    'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at ASC'
  ).all(order.customer_id);

  const recentFailures = getRecentFailures(db, order.customer_id, order.id);
  const result = scoreOrder(order, allCustomerOrders, recentFailures, avgOrderValue);

  return { ...result, order };
}

function blockOrder(orderId) {
  const db = getDB();
  const stmt = db.prepare(`UPDATE orders SET status = 'held', updated_at = datetime('now') WHERE id = ?`);
  const info = stmt.run(orderId);

  if (info.changes > 0) {
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, order_id, reason, result)
      VALUES ('fraud_detector', 'fraud_block', ?, 'Risk score exceeded threshold', 'blocked')
    `).run(orderId);
  }

  return info.changes > 0;
}

function approveOrder(orderId) {
  const db = getDB();
  const stmt = db.prepare(`UPDATE orders SET status = 'pending', updated_at = datetime('now') WHERE id = ? AND status = 'held'`);
  const info = stmt.run(orderId);

  if (info.changes > 0) {
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, order_id, reason, result)
      VALUES ('fraud_detector', 'fraud_approve', ?, 'Manually approved by merchant', 'approved')
    `).run(orderId);
  }

  return info.changes > 0;
}

module.exports = { scoreAllOrders, scoreSingleOrder, blockOrder, approveOrder, BLOCK_THRESHOLD };
