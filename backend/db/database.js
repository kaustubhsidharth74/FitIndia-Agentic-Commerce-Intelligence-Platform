const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, 'fitindia.db');
let _db  = null;
let _SQL = null;
let _inTransaction = false;

function persist() {
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function persistIfIdle() {
  if (!_inTransaction) persist();
}

function normaliseParams(args) {
  if (args.length === 0) return [];
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

function makeStmt(sql) {
  return {
    run(...args) {
      _db.run(sql, normaliseParams(args));
      const lastInsertRowid = _db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? null;
      const changes         = _db.exec('SELECT changes()')[0]?.values[0][0] ?? 0;
      persistIfIdle();
      return { lastInsertRowid, changes };
    },
    get(...args) {
      const stmt = _db.prepare(sql);
      stmt.bind(normaliseParams(args));
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },
    all(...args) {
      const rows = [];
      const stmt = _db.prepare(sql);
      stmt.bind(normaliseParams(args));
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
  };
}

const SCHEMA = `
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
    created_at          TEXT    DEFAULT (datetime('now')),
    updated_at          TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id),
    product_id  INTEGER NOT NULL REFERENCES products(id),
    quantity    INTEGER NOT NULL,
    unit_paise  INTEGER NOT NULL,
    total_paise INTEGER NOT NULL
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
`;

function getDB() {
  if (!_db) throw new Error('DB not initialised yet — call initDB() first');
  return {
    prepare: (sql) => makeStmt(sql),
    exec: (sql) => {
      _db.run(sql);
      const cmd = sql.trim().toUpperCase();
      if (cmd === 'BEGIN' || cmd.startsWith('BEGIN ')) {
        _inTransaction = true;
      } else if (cmd === 'COMMIT' || cmd === 'ROLLBACK') {
        _inTransaction = false;
        persist();
      } else {
        persistIfIdle();
      }
    },
  };
}

async function initDB() {
  _SQL = await require('sql.js')();
  _db  = fs.existsSync(DB_PATH)
    ? new _SQL.Database(fs.readFileSync(DB_PATH))
    : new _SQL.Database();

  _db.exec(SCHEMA);
  persist();
  console.log('SQLite (sql.js) DB initialised at', DB_PATH);
}

module.exports = { getDB, initDB };
