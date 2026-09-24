// SQLite persistence via better-sqlite3.
// Path to Postgres later: replace this module's internals; the rest of the
// app only uses the exported helper functions, so no route code changes.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

const dbDir = path.dirname(path.resolve(config.dbPath));
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  stripe_customer_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage (
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  messages INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
`);

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

const ACTIVE_STATUSES = new Set(['trialing', 'active', 'comped']);
// 'comped' = free Premium granted by the owner via /api/admin/grant.
// Stripe webhooks only ever set real Stripe statuses, so a comped account
// keeps its free Premium until the owner revokes it.

module.exports = {
  db,

  createUser(email, passwordHash) {
    const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    const info = stmt.run(email.toLowerCase().trim(), passwordHash);
    return this.findUserById(info.lastInsertRowid);
  },

  findUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  },

  findUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  listUsers() {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC, id DESC').all();
  },

  setStripeCustomerId(userId, customerId) {
    db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, userId);
  },

  setSubscriptionStatus(userId, status) {
    db.prepare('UPDATE users SET subscription_status = ? WHERE id = ?').run(status, userId);
  },

  findUserByStripeCustomerId(customerId) {
    return db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(customerId);
  },

  isPremium(user) {
    return !!user && ACTIVE_STATUSES.has(user.subscription_status);
  },

  getDailyUsage(userId) {
    const row = db.prepare('SELECT messages FROM usage WHERE user_id = ? AND day = ?').get(userId, today());
    return row ? row.messages : 0;
  },

  incrementDailyUsage(userId) {
    db.prepare(
      `INSERT INTO usage (user_id, day, messages) VALUES (?, ?, 1)
       ON CONFLICT(user_id, day) DO UPDATE SET messages = messages + 1`
    ).run(userId, today());
  },

  // express-session store helpers
  sessionGet(sid) {
    const row = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expire > ?').get(sid, Date.now());
    return row ? JSON.parse(row.sess) : null;
  },
  sessionSet(sid, sess, expireMs) {
    db.prepare(
      'INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire'
    ).run(sid, JSON.stringify(sess), Date.now() + expireMs);
  },
  sessionDestroy(sid) {
    db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
  },
  sessionCleanup() {
    db.prepare('DELETE FROM sessions WHERE expire <= ?').run(Date.now());
  },

  toPublicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      subscriptionStatus: user.subscription_status,
      isPremium: this.isPremium(user),
      createdAt: user.created_at,
    };
  },
};
