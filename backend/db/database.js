const path = require('path');

const DB_PATH = path.join(__dirname, 'fitindia.db');
let _db = null;

function getDB() {
  if (!_db) throw new Error('DB not initialised yet — call initDB() first');
  return _db;
}

async function initDB() {
  const Database = require('better-sqlite3');
  _db = new Database(DB_PATH);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      description TEXT,
      price       INTEGER NOT NULL,
      category    TEXT,
      stock       INTEGER DEFAULT 100,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      phone      TEXT,
      type       TEXT DEFAULT 'human',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id         INTEGER REFERENCES customers(id),
      product_id          INTEGER REFERENCES products(id),
      quantity            INTEGER DEFAULT 1,
      total_paise         INTEGER NOT NULL,
      status              TEXT DEFAULT 'pending',
      razorpay_order_id   TEXT,
      razorpay_payment_id TEXT,
      payment_link        TEXT,
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp    TEXT    DEFAULT (datetime('now')),
      agent        TEXT    NOT NULL,
      action_type  TEXT    NOT NULL,
      customer_id  INTEGER REFERENCES customers(id),
      order_id     INTEGER REFERENCES orders(id),
      amount_paise INTEGER,
      reason       TEXT,
      result       TEXT,
      metadata     TEXT
    );
  `);

  console.log('SQLite (better-sqlite3) DB initialised at', DB_PATH);
}

module.exports = { getDB, initDB };
