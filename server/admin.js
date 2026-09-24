// Admin tools: grant/revoke complimentary Premium accounts and list users.
// Protected by the ADMIN_PASSWORD env var. Every route 503s if it isn't set,
// so there is no way to reach these endpoints on a server without a password.
const express = require('express');
const config = require('./config');
const db = require('./db');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!config.adminPassword) {
    return res.status(503).json({ error: 'Admin is not configured on this server.' });
  }
  const given =
    req.headers['x-admin-password'] || (req.body && req.body.adminPassword) || req.query.password;
  if (given !== config.adminPassword) {
    return res.status(401).json({ error: 'Wrong admin password.' });
  }
  next();
}

router.use(requireAdmin);

// GET /api/admin/users — every account, newest first.
router.get('/users', (req, res) => {
  res.json({ users: db.listUsers().map((u) => db.toPublicUser(u)) });
});

// POST /api/admin/grant { email } — give a free Premium ("comped") account.
// The person must already have signed up; comped status survives Stripe
// webhooks because Stripe never sends events for an account with no subscription.
router.post('/grant', (req, res) => {
  const email = ((req.body && req.body.email) || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const user = db.findUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'No account with that email yet — they need to sign up first.' });
  }
  db.setSubscriptionStatus(user.id, 'comped');
  res.json({ user: db.toPublicUser(db.findUserById(user.id)) });
});

// POST /api/admin/revoke { email } — take Premium away (back to free).
router.post('/revoke', (req, res) => {
  const email = ((req.body && req.body.email) || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const user = db.findUserByEmail(email);
  if (!user) return res.status(404).json({ error: 'No account with that email.' });
  db.setSubscriptionStatus(user.id, 'none');
  res.json({ user: db.toPublicUser(db.findUserById(user.id)) });
});

module.exports = { router };
