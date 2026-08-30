const express = require('express');
const { scoreAllOrders, scoreSingleOrder, blockOrder, approveOrder } = require('../utils/fraudScorer');

const router = express.Router();

// GET /api/fraud/orders — all orders with risk scores
router.get('/orders', (req, res) => {
  try {
    const scored = scoreAllOrders();
    const summary = {
      total:  scored.length,
      high:   scored.filter(s => s.risk_level === 'high').length,
      medium: scored.filter(s => s.risk_level === 'medium').length,
      low:    scored.filter(s => s.risk_level === 'low').length,
      amount_at_risk_paise: scored
        .filter(s => s.risk_level === 'high')
        .reduce((sum, s) => sum + (s.order.total_paise || 0), 0),
    };
    res.json({ summary, orders: scored });
  } catch (err) {
    console.error('fraud/orders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fraud/scan/:orderId — score a specific order
router.post('/scan/:orderId', (req, res) => {
  try {
    const result = scoreSingleOrder(Number(req.params.orderId));
    if (!result) return res.status(404).json({ error: 'Order not found' });
    res.json(result);
  } catch (err) {
    console.error('fraud/scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fraud/block/:orderId — block a suspicious order
router.post('/block/:orderId', (req, res) => {
  try {
    const changed = blockOrder(Number(req.params.orderId));
    if (!changed) return res.status(404).json({ error: 'Order not found or already blocked' });
    res.json({ success: true, message: 'Order blocked and logged to audit trail' });
  } catch (err) {
    console.error('fraud/block error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fraud/approve/:orderId — whitelist a held order
router.post('/approve/:orderId', (req, res) => {
  try {
    const changed = approveOrder(Number(req.params.orderId));
    if (!changed) return res.status(404).json({ error: 'Order not found or not in held state' });
    res.json({ success: true, message: 'Order approved and restored to pending' });
  } catch (err) {
    console.error('fraud/approve error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fraud/stats — summary stats for dashboard card
router.get('/stats', (req, res) => {
  try {
    const scored = scoreAllOrders();
    const highRisk = scored.filter(s => s.risk_level === 'high');
    res.json({
      flagged_count:        highRisk.length,
      amount_at_risk_inr:   highRisk.reduce((sum, s) => sum + (s.order.total_paise || 0), 0) / 100,
      velocity_offenders:   scored.filter(s => s.reasons.some(r => r.includes('velocity'))).length,
      auto_blocked:         scored.filter(s => s.order.status === 'held').length,
    });
  } catch (err) {
    console.error('fraud/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
