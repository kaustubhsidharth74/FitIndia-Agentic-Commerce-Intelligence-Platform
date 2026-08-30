// Razorpay client with mock fallback.
// Set MOCK_RAZORPAY=true in .env to run without network access.
// Mock mode: returns realistic fake responses and auto-marks orders paid after 5s.

const { getDB } = require('./db/database');

const MOCK = process.env.MOCK_RAZORPAY === 'true';

if (MOCK) {
  console.log('[razorpay] MOCK MODE — no real API calls will be made');
}

function getRealRazorpay() {
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// Simulate payment captured 5 seconds after link is created
function mockAutoCapture(linkId, dbOrderId, amountPaise) {
  setTimeout(() => {
    try {
      const db        = getDB();
      const paymentId = `pay_mock_${Date.now()}`;

      db.prepare(`
        UPDATE orders
        SET status = 'paid', razorpay_payment_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(paymentId, dbOrderId);

      // Look up customer_id from the order so the audit row is linked
      const order = db.prepare('SELECT customer_id FROM orders WHERE id = ?').get(dbOrderId);

      db.prepare(`
        INSERT INTO audit_log (agent, action_type, customer_id, order_id, amount_paise, reason, result, metadata)
        VALUES ('mock_webhook', 'payment', ?, ?, ?, 'Mock payment auto-captured (test mode)', 'success', ?)
      `).run(
        order?.customer_id || null,
        dbOrderId,
        amountPaise,
        JSON.stringify({ event: 'mock.captured', payment_id: paymentId, link_id: linkId }),
      );

      console.log(`[mock] Auto-captured order #${dbOrderId} — ${paymentId}`);
    } catch (e) {
      console.error('[mock] Auto-capture error:', e.message);
    }
  }, 5000);
}

async function createPaymentLink({ amount, description, customer, notes, dbOrderId }) {
  if (MOCK) {
    const linkId  = `plink_mock_${Date.now()}`;
    const shortUrl = `http://localhost:4000/mock-pay/${linkId}`;
    mockAutoCapture(linkId, dbOrderId, amount);
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
      throw new Error('Cannot reach Razorpay API — check HTTPS_PROXY in .env or try MOCK_RAZORPAY=true');
    }
    throw new Error(`Razorpay error: ${msg}`);
  }
}

async function createOrder({ amount, receipt, notes }) {
  if (MOCK) {
    return {
      id:       `order_mock_${Date.now()}`,
      amount,
      currency: 'INR',
      receipt,
      status:   'created',
    };
  }
  const rz = getRealRazorpay();
  return rz.orders.create({ amount, currency: 'INR', receipt, notes: notes || {} });
}

async function listOrders(count = 10) {
  if (MOCK) return { items: [], count: 0 };
  const rz = getRealRazorpay();
  return rz.orders.all({ count });
}

async function fetchPaymentLink(linkId) {
  if (MOCK) return null;
  const rz = getRealRazorpay();
  return rz.paymentLink.fetch(linkId);
}

module.exports = { createPaymentLink, createOrder, listOrders, fetchPaymentLink, MOCK };
