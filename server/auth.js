// Email + password authentication with server-side sessions stored in SQLite.
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./db');

const router = express.Router();

// ---- SQLite-backed session store (no MemoryStore leak warnings) ----
class SqliteStore extends session.Store {
  get(sid, cb) {
    try {
      cb(null, db.sessionGet(sid));
    } catch (e) {
      cb(e);
    }
  }
  set(sid, sess, cb) {
    try {
      const maxAge = (sess.cookie && sess.cookie.maxAge) || 1000 * 60 * 60 * 24 * 30;
      db.sessionSet(sid, sess, maxAge);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }
  destroy(sid, cb) {
    try {
      db.sessionDestroy(sid);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }
  touch(sid, sess, cb) {
    this.set(sid, sess, cb);
  }
}

const sessionMiddleware = session({
  name: 'sellerai.sid',
  secret: config.sessionSecret,
  store: new SqliteStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  },
});

// Clean up expired sessions every hour.
setInterval(() => {
  try {
    db.sessionCleanup();
  } catch (e) {
    console.error('Session cleanup failed:', e.message);
  }
}, 1000 * 60 * 60).unref();

// ---- Rate limiting on auth endpoints (brute-force protection) ----
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// ---- Middleware ----
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Please log in first.' });
  }
  const user = db.findUserById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  req.user = user;
  next();
}

function requirePremium(req, res, next) {
  if (!db.isPremium(req.user)) {
    return res.status(403).json({ error: 'Premium subscription required.', needsUpgrade: true });
  }
  next();
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ---- Routes ----
router.post('/signup', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (db.findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' });
  }
  const passwordHash = bcrypt.hashSync(password, 12);
  const user = db.createUser(email, passwordHash);
  req.session.userId = user.id;
  res.status(201).json({ user: db.toPublicUser(user) });
});

router.post('/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Please enter your email and password.' });
  }
  const user = db.findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  req.session.userId = user.id;
  res.json({ user: db.toPublicUser(user) });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sellerai.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.json({ user: null });
  const user = db.findUserById(req.session.userId);
  res.json({ user: db.toPublicUser(user) });
});

module.exports = { router, sessionMiddleware, requireAuth, requirePremium };
