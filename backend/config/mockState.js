// Runtime-mutable mock flags — toggled via POST /api/config without server restart.
// Initial values read from .env at startup.
let _mockRazorpay = process.env.MOCK_RAZORPAY === 'true';
let _mockAI       = process.env.MOCK_AI       === 'true';

module.exports = {
  isMockRazorpay: () => _mockRazorpay,
  isMockAI:       () => _mockAI,
  setMockRazorpay: (v) => { _mockRazorpay = Boolean(v); },
  setMockAI:       (v) => { _mockAI       = Boolean(v); },
  getState: () => ({ mock_razorpay: _mockRazorpay, mock_ai: _mockAI }),
};
