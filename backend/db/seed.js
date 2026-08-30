require('dotenv').config({ path: '../../.env' });
const { initDB, getDB } = require('./database');

async function seed() {
  await initDB();
  const db = getDB();

  // ── Products ────────────────────────────────────────────────────────────────
  const products = [
    // Nutrition
    { name: 'Protein Powder',      description: '1kg Whey Protein, 24g protein per scoop',                    price: 149900, category: 'Nutrition',    stock: 200 },
    { name: 'BCAA Energy Drink',   description: 'Amino acid recovery drink, 30 servings, mango flavour',      price:  89900, category: 'Nutrition',    stock: 180 },
    { name: 'Peanut Butter',       description: '1kg natural crunchy peanut butter, high protein, no sugar',   price:  49900, category: 'Nutrition',    stock: 250 },
    { name: 'Mass Gainer',         description: '3kg serious mass gainer, 1250 cal per serving, chocolate',    price: 249900, category: 'Nutrition',    stock:  90 },

    // Accessories
    { name: 'Gym Gloves',          description: 'Anti-slip training gloves, unisex M/L/XL',                   price:  39900, category: 'Accessories',  stock: 150 },
    { name: 'Shaker Bottle',       description: '700ml BPA-free protein shaker with mixer ball',               price:  29900, category: 'Accessories',  stock: 300 },
    { name: 'Wrist Wraps',         description: 'Heavy-duty wrist support wraps for powerlifting, pair',       price:  24900, category: 'Accessories',  stock: 200 },
    { name: 'Gym Bag',             description: 'Duffel bag with shoe compartment, water-resistant, 35L',      price:  79900, category: 'Accessories',  stock: 100 },

    // Equipment
    { name: 'Resistance Bands',    description: 'Set of 5 resistance bands (10–50 lbs) with door anchor',     price:  59900, category: 'Equipment',    stock: 120 },
    { name: 'Yoga Mat',            description: '6mm anti-slip NBR exercise mat with carry strap',             price:  34900, category: 'Equipment',    stock: 220 },
    { name: 'Adjustable Dumbbells', description: '2–14 kg adjustable dumbbell set, space-saving design',       price: 349900, category: 'Equipment',    stock:  40 },
    { name: 'Jump Rope',           description: 'Speed skipping rope, adjustable length, ball-bearing swivel', price:  19900, category: 'Equipment',    stock: 300 },

    // Subscription
    { name: 'Monthly Supplement',  description: 'Monthly wellness pack: vitamins + omega-3',                  price: 299900, category: 'Subscription', stock:  50 },
    { name: 'Quarterly Plan',     description: '12-week transformation plan with diet chart & workout guide',  price: 499900, category: 'Subscription', stock:  80 },
    { name: 'Annual Membership',  description: 'Full year access to AI coaching, meal plans & progress tracking', price: 999900, category: 'Subscription', stock: 100 },
  ];

  for (const p of products) {
    db.prepare(`
      INSERT OR IGNORE INTO products (name, description, price, category, stock)
      VALUES (?, ?, ?, ?, ?)
    `).run(p.name, p.description, p.price, p.category, p.stock);
  }
  console.log('✓ Products seeded');

  // ── Customers ───────────────────────────────────────────────────────────────
  const customers = [
    { name: 'Ravi Sharma',    email: 'ravi@example.com',       phone: '9876543210', type: 'human' },
    { name: 'Meena Patel',    email: 'meena@example.com',      phone: '9123456780', type: 'human' },
    { name: 'Suresh Reddy',   email: 'suresh@example.com',     phone: '9988776655', type: 'human' },
    { name: 'HealthBox Bot',  email: 'healthbox@bot.fitindia', phone: null,         type: 'bot'   },
  ];

  for (const c of customers) {
    db.prepare(`
      INSERT OR IGNORE INTO customers (name, email, phone, type)
      VALUES (?, ?, ?, ?)
    `).run(c.name, c.email, c.phone, c.type);
  }
  console.log('✓ Customers seeded');

  // Helper: get IDs we just inserted
  const pid = (name) => db.prepare('SELECT id FROM products  WHERE name  = ?').get(name)?.id;
  const cid = (email) => db.prepare('SELECT id FROM customers WHERE email = ?').get(email)?.id;

  // ── Orders ──────────────────────────────────────────────────────────────────

  // Ravi — added Protein to cart, never paid (status: pending)
  db.prepare(`
    INSERT INTO orders (customer_id, product_id, quantity, total_paise, status, razorpay_order_id)
    VALUES (?, ?, 1, ?, 'pending', 'rz_order_ravi_001')
  `).run(cid('ravi@example.com'), pid('Protein Powder'), 149900);

  // Meena — bought Protein 4x (paid), never bought Shaker
  for (let i = 1; i <= 4; i++) {
    db.prepare(`
      INSERT INTO orders (customer_id, product_id, quantity, total_paise, status,
                          razorpay_order_id, razorpay_payment_id)
      VALUES (?, ?, 1, ?, 'paid', ?, ?)
    `).run(
      cid('meena@example.com'),
      pid('Protein Powder'),
      149900,
      `rz_order_meena_00${i}`,
      `rz_pay_meena_00${i}`,
    );
  }

  // Suresh — tried Monthly Supplement, payment failed
  db.prepare(`
    INSERT INTO orders (customer_id, product_id, quantity, total_paise, status, razorpay_order_id)
    VALUES (?, ?, 1, ?, 'failed', 'rz_order_suresh_001')
  `).run(cid('suresh@example.com'), pid('Monthly Supplement'), 299900);

  // HealthBox Bot — bulk buyer: 3 paid orders across different products
  const botId = cid('healthbox@bot.fitindia');
  const bulkOrders = [
    { product: 'Protein Powder',   qty: 10, rz: 'rz_order_bot_001', pay: 'rz_pay_bot_001' },
    { product: 'Resistance Bands', qty: 5,  rz: 'rz_order_bot_002', pay: 'rz_pay_bot_002' },
    { product: 'Gym Gloves',       qty: 8,  rz: 'rz_order_bot_003', pay: 'rz_pay_bot_003' },
  ];
  for (const o of bulkOrders) {
    const productRow = db.prepare('SELECT price FROM products WHERE name = ?').get(o.product);
    db.prepare(`
      INSERT INTO orders (customer_id, product_id, quantity, total_paise, status,
                          razorpay_order_id, razorpay_payment_id)
      VALUES (?, ?, ?, ?, 'paid', ?, ?)
    `).run(botId, pid(o.product), o.qty, productRow.price * o.qty, o.rz, o.pay);
  }

  console.log('✓ Orders seeded');

  // ── Audit log entries (backstory for the dashboard) ─────────────────────────
  const auditEntries = [
    { agent: 'system',   action_type: 'catalog_buy', customer_id: botId,                         amount_paise: 10*149900, reason: 'HealthBox Bot initial bulk purchase', result: 'success' },
    { agent: 'system',   action_type: 'checkout',    customer_id: cid('meena@example.com'),       amount_paise: 149900,   reason: 'Meena completed repeat protein purchase', result: 'success' },
    { agent: 'system',   action_type: 'payment',     customer_id: cid('suresh@example.com'),      amount_paise: 299900,   reason: 'Suresh payment failed — card declined',   result: 'failed'  },
    { agent: 'system',   action_type: 'checkout',    customer_id: cid('ravi@example.com'),        amount_paise: 149900,   reason: 'Ravi created order but did not pay',      result: 'pending' },
  ];

  for (const e of auditEntries) {
    db.prepare(`
      INSERT INTO audit_log (agent, action_type, customer_id, amount_paise, reason, result)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(e.agent, e.action_type, e.customer_id, e.amount_paise, e.reason, e.result);
  }

  console.log('✓ Audit log seeded');
  console.log('\nPhase 2 complete. DB is ready.');
}

seed().catch(err => { console.error(err); process.exit(1); });
