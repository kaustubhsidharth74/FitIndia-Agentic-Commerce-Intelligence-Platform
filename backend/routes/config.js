const express   = require('express');
const mockState = require('../config/mockState');

const router = express.Router();

// GET /api/config — current mock state
router.get('/', (_req, res) => {
  res.json({ success: true, ...mockState.getState() });
});

// POST /api/config — update mock flags
// Body: { mock_razorpay?: bool, mock_ai?: bool }
router.post('/', (req, res) => {
  const { mock_razorpay, mock_ai } = req.body;
  if (mock_razorpay !== undefined) mockState.setMockRazorpay(mock_razorpay);
  if (mock_ai       !== undefined) mockState.setMockAI(mock_ai);
  console.log(`[config] Mock updated →`, mockState.getState());
  res.json({ success: true, ...mockState.getState() });
});

module.exports = router;
