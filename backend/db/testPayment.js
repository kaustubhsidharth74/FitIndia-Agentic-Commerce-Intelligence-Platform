// Phase 3 — Payment simulation test
// Usage: node db/testPayment.js
// Creates a real Razorpay payment link → open it → pay with test card → check DB
//
// Test card:  4111 1111 1111 1111  |  any future expiry  |  any CVV
// UPI:        success@razorpay  (always succeeds in test mode)
// UPI fail:   failure@razorpay

require('dotenv').config({ path: '../../.env' });

if (process.env.HTTPS_PROXY) {
  const https = require('https');
  const { HttpsProxyAgent } = require('https-proxy-agent');
  https.globalAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
}

const { initDB, getDB } = require('./database');

const CUSTOMER_ID = 1;  // Ravi — has a pending Protein Powder order
const PRODUCT_ID  = 1;  // Protein Powder ₹1,499

async function run() {
  await initDB();
  const db = getDB();

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(CUSTOMER_ID);
  const product  = db.prepare('SELECT * FROM products  WHERE id = ?').get(PRODUCT_ID);

  if (!customer || !product) {
    console.error('Customer or product not found — run seed.js first');
    process.exit(1);
  }

  console.log(`\nCreating payment link for:`);
  console.log(`  Customer : ${customer.name} (${customer.email})`);
  console.log(`  Product  : ${product.name}`);
  console.log(`  Amount   : ₹${product.price / 100}\n`);

  // Call the /buy endpoint logic directly (no HTTP needed)
  const Razorpay = require('razorpay');
  const rz = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'your_razorpay_key_id_here') {
    console.error('ERROR: RAZORPAY_KEY_ID not set in .env');
    console.error('Open fitindia/.env and paste your test Key ID and Key Secret');
    process.exit(1);
  }

  // Create DB order
  const orderInfo = db.prepare(`
    INSERT INTO orders (customer_id, product_id, quantity, total_paise, status)
    VALUES (?, ?, 1, ?, 'pending')
  `).run(customer.id, product.id, product.price);
  const dbOrderId = orderInfo.lastInsertRowid;

  // Create Razorpay payment link
  const link = await rz.paymentLink.create({
    amount:      product.price,
    currency:    'INR',
    description: `FitIndia Test — ${product.name}`,
    customer: {
      name:    customer.name,
      email:   customer.email,
      contact: customer.phone || '',
    },
    notify:          { sms: false, email: false },
    reminder_enable: false,
    notes:           { db_order_id: String(dbOrderId), test: 'true' },
  });

  // Save link to order
  db.prepare(`
    UPDATE orders
    SET payment_link = ?, razorpay_order_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(link.short_url, link.id, dbOrderId);

  console.log('═══════════════════════════════════════════════════');
  console.log('  PAYMENT LINK CREATED ✓');
  console.log(`  DB Order ID : #${dbOrderId}`);
  console.log(`  Link ID     : ${link.id}`);
  console.log(`  Amount      : ₹${product.price / 100}`);
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n  Open this URL in your browser:\n`);
  console.log(`  ${link.short_url}\n`);
  console.log('─────────────────────────────────────────────────────');
  console.log('  Test credentials (Razorpay test mode):');
  console.log('  Card   : 4111 1111 1111 1111 | any future expiry | any CVV');
  console.log('  UPI OK : success@razorpay');
  console.log('  UPI KO : failure@razorpay');
  console.log('─────────────────────────────────────────────────────');
  console.log('\nAfter paying, run this to check DB:');
  console.log(`  node -e "const {initDB,getDB}=require('./db/database');initDB().then(()=>{const db=getDB();console.log(db.prepare('SELECT id,status,razorpay_payment_id FROM orders WHERE id=?').get(${dbOrderId}))})"`);
  console.log('');
}

run().catch(err => { console.error(err); process.exit(1); });
