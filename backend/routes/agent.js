const express  = require('express');
const { getDB } = require('../db/database');
const { runUpsellAgent }      = require('../agents/upsellAgent');
const { runCampaignAgent }    = require('../agents/campaignAgent');
const { handleCheckoutMessage } = require('../agents/checkoutAgent');
const { runBuyerAgent }           = require('../agents/buyerAgent');
const { simulatePaymentFailure, runRetryAgent } = require('../agents/retryAgent');
const guardrails = require('../config/guardrails');

const router = express.Router();

// ── Human-readable activity feed helper ───────────────────────────────────────
const ACTION_LABELS = {
  upsell:             (l) => `sent ${l.metadata_obj?.discount_percent || ''}% upsell offer to ${l.customer_name}`,
  catalog_buy:        (l) => `placed ${l.metadata_obj?.product || 'product'} order for ${l.customer_name}`,
  payment_failed:     (l) => `detected payment failure for ${l.customer_name}`,
  payment_retry:      (l) => `retried payment for ${l.customer_name}`,
  merchant_alert:     (l) => `raised merchant alert for ${l.customer_name}`,
  campaign_reminder:  (l) => `sent campaign reminder to ${l.customer_name}`,
  campaign_converted: (l) => `recorded conversion for ${l.customer_name}`,
  checkout:           (l) => `assisted ${l.customer_name} in checkout`,
  payment:            (l) => `processed payment for ${l.customer_name}`,
};

function toActivityLine(log) {
  let metaObj = {};
  try { metaObj = log.metadata ? JSON.parse(log.metadata) : {}; } catch {}
  const enriched = { ...log, metadata_obj: metaObj };
  const verb     = (ACTION_LABELS[log.action_type] || (() => log.action_type))(enriched);
  const time     = new Date(log.timestamp + 'Z').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return {
    id:          log.id,
    timestamp:   log.timestamp,
    time,
    agent:       log.agent,
    action_type: log.action_type,
    customer:    log.customer_name || '—',
    result:      log.result,
    amount_inr:  log.amount_paise ? log.amount_paise / 100 : null,
    sentence:    `${log.agent} ${verb}`,
  };
}

// GET /api/agent/audit  — audit trail with optional filters
// Query params: agent, action_type, result, limit (default 100)
router.get('/audit', (req, res) => {
  const db = getDB();
  const { agent, action_type, result, limit = 100 } = req.query;

  let where = [];
  let params = [];
  if (agent)       { where.push('a.agent = ?');       params.push(agent); }
  if (action_type) { where.push('a.action_type = ?'); params.push(action_type); }
  if (result)      { where.push('a.result = ?');      params.push(result); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const logs = db.prepare(`
    SELECT a.*, c.name AS customer_name
    FROM audit_log a
    LEFT JOIN customers c ON a.customer_id = c.id
    ${whereClause}
    ORDER BY a.timestamp DESC
    LIMIT ?
  `).all(...params, Number(limit));

  // Summary stats (always on full table, no filter)
  const stats = db.prepare(`
    SELECT
      COUNT(*)                                              AS total,
      SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END)  AS success,
      SUM(CASE WHEN result = 'failed'  THEN 1 ELSE 0 END)  AS failed,
      SUM(CASE WHEN result = 'pending' THEN 1 ELSE 0 END)  AS pending,
      SUM(CASE WHEN result = 'success' THEN COALESCE(amount_paise, 0) ELSE 0 END) AS total_revenue_paise
    FROM audit_log
  `).get();

  res.json({ success: true, logs, stats });
});

// GET /api/agent/audit/agents  — distinct agent names for filter dropdown
router.get('/audit/agents', (_req, res) => {
  const db = getDB();
  const agents = db.prepare('SELECT DISTINCT agent FROM audit_log ORDER BY agent').all().map(r => r.agent);
  res.json({ success: true, agents });
});

// POST /api/agent/audit  — write a manual audit entry
router.post('/audit', (req, res) => {
  const { agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata } = req.body;
  const db = getDB();
  const info = db.prepare(`
    INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(agent, action_type, customer_id || null, order_id || null, amount_paise || null, reason || null, result || null, metadata ? JSON.stringify(metadata) : null);

  res.json({ success: true, id: info.lastInsertRowid });
});

// GET /api/agent/customers  — customer list with order history summary
router.get('/customers', (_req, res) => {
  const db = getDB();
  const customers = db.prepare(`
    SELECT c.*,
      COUNT(o.id)                                     AS total_orders,
      SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
      SUM(CASE WHEN o.status = 'paid' THEN o.total_paise ELSE 0 END) AS total_spent_paise
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.id
  `).all();
  res.json({ success: true, customers });
});

// GET /api/agent/customers/:id/orders
router.get('/customers/:id/orders', (req, res) => {
  const db = getDB();
  const orders = db.prepare(`
    SELECT o.*, p.name AS product_name, p.price AS product_price
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
  `).all(req.params.id);
  res.json({ success: true, orders });
});

// POST /api/agent/upsell  — run upsell agent for a customer
// Body: { customer_id }
router.post('/upsell', async (req, res) => {
  const { customer_id } = req.body;
  if (!customer_id) return res.status(400).json({ success: false, error: 'customer_id required' });
  try {
    const result = await runUpsellAgent(Number(customer_id));
    res.json(result);
  } catch (err) {
    console.error('Upsell route error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/agent/buyer  — run AI buyer agent (bot purchases from catalog)
// Body: { bot_customer_id, goal, target_product_name?, quantity? }
router.post('/buyer', async (req, res) => {
  const { bot_customer_id = 4, goal = 'Buy fitness products in bulk', target_product_name, quantity } = req.body;
  try {
    const result = await runBuyerAgent({
      botCustomerId:    Number(bot_customer_id),
      goal,
      targetProductName: target_product_name,
      quantity:         quantity ? Number(quantity) : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error('Buyer route error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/agent/alerts  — merchant_alert entries for dashboard banner
router.get('/alerts', (_req, res) => {
  const db = getDB();
  const alerts = db.prepare(`
    SELECT a.*, c.name AS customer_name
    FROM audit_log a
    LEFT JOIN customers c ON a.customer_id = c.id
    WHERE a.action_type = 'merchant_alert'
    ORDER BY a.timestamp DESC
    LIMIT 20
  `).all();
  res.json({ success: true, alerts });
});

// GET /api/agent/activity  — human-readable activity feed (last 30 entries)
router.get('/activity', (_req, res) => {
  const db = getDB();
  const logs = db.prepare(`
    SELECT a.*, c.name AS customer_name
    FROM audit_log a
    LEFT JOIN customers c ON a.customer_id = c.id
    ORDER BY a.timestamp DESC
    LIMIT 30
  `).all();
  res.json({ success: true, activity: logs.map(toActivityLine) });
});

// GET /api/agent/stats  — comprehensive merchant dashboard stats
router.get('/stats', (_req, res) => {
  const db = getDB();

  const orders = db.prepare('SELECT * FROM orders').all();
  const paid   = orders.filter(o => o.status === 'paid');
  const pending = orders.filter(o => o.status === 'pending');
  const failed  = orders.filter(o => o.status === 'failed');

  const totalRevenuePaise    = paid.reduce((s, o) => s + o.total_paise, 0);

  // Revenue recovered = audit entries where result='success' and action_type in (upsell, campaign_converted, payment_retry)
  const recoveredRow = db.prepare(`
    SELECT COALESCE(SUM(amount_paise), 0) AS total
    FROM audit_log
    WHERE result = 'success'
      AND action_type IN ('upsell', 'campaign_converted', 'payment_retry')
  `).get();

  // Active campaign targets = pending orders with no recent reminder
  const campaignTargets = db.prepare(`
    SELECT COUNT(DISTINCT o.id) AS cnt
    FROM orders o
    WHERE o.status = 'pending'
  `).get();

  // Merchant alerts count
  const alertsCount = db.prepare(`SELECT COUNT(*) AS cnt FROM audit_log WHERE action_type='merchant_alert'`).get();

  // Last campaign run
  const lastCampaign = db.prepare(`
    SELECT timestamp FROM audit_log WHERE agent='campaign_agent' ORDER BY timestamp DESC LIMIT 1
  `).get();

  // Distinct active agents (last 24h)
  const activeAgents = db.prepare(`
    SELECT COUNT(DISTINCT agent) AS cnt FROM audit_log
    WHERE timestamp >= datetime('now', '-24 hours') AND agent != 'system'
  `).get();

  res.json({
    success: true,
    stats: {
      total_orders:        orders.length,
      paid_orders:         paid.length,
      pending_orders:      pending.length,
      failed_orders:       failed.length,
      total_revenue_inr:   totalRevenuePaise / 100,
      recovered_inr:       recoveredRow.total / 100,
      campaign_targets:    campaignTargets.cnt,
      merchant_alerts:     alertsCount.cnt,
      last_campaign:       lastCampaign?.timestamp || null,
      active_agents_24h:   activeAgents.cnt,
    },
  });
});

// GET /api/agent/guardrails  — current guardrail settings
router.get('/guardrails', (_req, res) => {
  res.json({ success: true, guardrails: guardrails.get() });
});

// POST /api/agent/guardrails  — update guardrail settings
router.post('/guardrails', (req, res) => {
  const { max_upsell_discount_pct, max_auto_approve_inr, max_reminders_per_order, retry_enabled } = req.body;
  const patch = {};
  if (max_upsell_discount_pct  !== undefined) patch.max_upsell_discount_pct  = Number(max_upsell_discount_pct);
  if (max_auto_approve_inr     !== undefined) patch.max_auto_approve_inr     = Number(max_auto_approve_inr);
  if (max_reminders_per_order  !== undefined) patch.max_reminders_per_order  = Number(max_reminders_per_order);
  if (retry_enabled            !== undefined) patch.retry_enabled            = Boolean(retry_enabled);
  const updated = guardrails.update(patch);
  res.json({ success: true, guardrails: updated });
});

// POST /api/agent/simulate-failure  — mark an order as failed (demo trigger)
// Body: { order_id }
router.post('/simulate-failure', async (req, res) => {
  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ success: false, error: 'order_id required' });
  try {
    const result = await simulatePaymentFailure({ orderId: Number(order_id) });
    res.json(result);
  } catch (err) {
    console.error('Simulate failure error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/agent/retry  — run retry agent for failed orders
// Body: { order_id?, force_retry_fail? }
router.post('/retry', async (req, res) => {
  const { order_id, force_retry_fail = false } = req.body;
  try {
    const result = await runRetryAgent({
      orderId:        order_id ? Number(order_id) : undefined,
      forceRetryFail: Boolean(force_retry_fail),
    });
    res.json(result);
  } catch (err) {
    console.error('Retry agent error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/agent/revenue-trend  — monthly paid revenue for chart
router.get('/revenue-trend', (_req, res) => {
  const db = getDB();
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', created_at)              AS month_key,
      CAST(strftime('%m', created_at) AS INTEGER) AS month_num,
      CAST(SUM(total_paise) / 100 AS INTEGER)    AS value
    FROM orders
    WHERE status = 'paid'
    GROUP BY month_key
    ORDER BY month_key ASC
    LIMIT 12
  `).all().map(r => ({
    month_key: r.month_key,
    month:     MONTH_NAMES[(r.month_num || 1) - 1],
    value:     r.value,
  }));
  res.json({ success: true, trend: rows });
});

// POST /api/agent/campaign  — run abandoned cart recovery campaign
router.post('/campaign', async (_req, res) => {
  try {
    const result = await runCampaignAgent();
    res.json(result);
  } catch (err) {
    console.error('Campaign route error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/agent/chat  — conversational checkout agent
// Body: { messages: [{role, content}], customer_id }
router.post('/chat', async (req, res) => {
  const { messages = [], customer_id = 1 } = req.body;
  try {
    const result = await handleCheckoutMessage({ messages, customerId: Number(customer_id) });
    res.json(result);
  } catch (err) {
    console.error('Chat route error:', err);
    res.status(500).json({ reply: 'Agent error. Please try again.', paymentLink: null });
  }
});

module.exports = router;
