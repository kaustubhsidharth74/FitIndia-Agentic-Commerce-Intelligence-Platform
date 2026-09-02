// Razorpay client with mock fallback.
// Mock mode is toggled at runtime via POST /api/config — no server restart needed.

const { getDB } = require('./db/database');
const mockState = require('./config/mockState');

const isMock = () => mockState.isMockRazorpay();

console.log(`[razorpay] Starting in ${isMock() ? 'MOCK' : 'LIVE'} mode`);

function getRealRazorpay() {
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

async function createPaymentLink({ amount, description, customer, notes, dbOrderId }) {
  if (isMock()) {
    const linkId   = `plink_mock_${Date.now()}`;
    const shortUrl = `http://localhost:4000/mock-pay/${linkId}`;
    return { id: linkId, short_url: shortUrl, amount, status: 'created' };
  }

  const rz = getRealRazorpay();
  try {
    return await rz.paymentLink.create({
      amount,
      currency:        'INR',
      description:     description || 'FitIndia Purchase',
      customer:        customer    || {},
      notify:          { sms: false, email: false },
      reminder_enable: false,
      notes:           notes || {},
    });
  } catch (err) {
    const msg = err?.error?.description || err?.message || String(err);
    console.error('[razorpay] createPaymentLink failed:', msg);
    if (msg.includes('undefined') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
      throw new Error('Cannot reach Razorpay API — try setting MOCK_RAZORPAY=true in .env');
    }
    throw new Error(`Razorpay error: ${msg}`);
  }
}

async function createOrder({ amount, receipt, notes }) {
  if (isMock()) {
    return { id: `order_mock_${Date.now()}`, amount, currency: 'INR', receipt, status: 'created' };
  }
  const rz = getRealRazorpay();
  return rz.orders.create({ amount, currency: 'INR', receipt, notes: notes || {} });
}

async function listOrders(count = 10) {
  if (isMock()) return { items: [], count: 0 };
  const rz = getRealRazorpay();
  return rz.orders.all({ count });
}

async function fetchPaymentLink(linkId) {
  if (isMock()) return null;
  const rz = getRealRazorpay();
  return rz.paymentLink.fetch(linkId);
}

// MOCK exported as a getter so callers always see the current runtime value
module.exports = {
  createPaymentLink,
  createOrder,
  listOrders,
  fetchPaymentLink,
  get MOCK() { return isMock(); },
};
