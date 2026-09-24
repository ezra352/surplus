// Surplus app — Express server.
// Serves the frontend statically and exposes the JSON API + Stripe webhook.
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const { router: authRouter, sessionMiddleware } = require('./auth');
const stripe = require('./stripe');
const ai = require('./ai');
const admin = require('./admin');

const app = express();
app.set('trust proxy', 1); // correct secure cookies behind Railway/Render proxies

app.use(helmet({ contentSecurityPolicy: false })); // CSP off: single-file app uses inline scripts

// Stripe webhook MUST be mounted before express.json() (needs the raw body).
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripe.webhookHandler);

app.use(express.json({ limit: '256kb' }));
app.use(sessionMiddleware);

app.use('/api/auth', authRouter);
app.use('/api/billing', stripe.router);
app.use('/api/admin', admin.router);
app.use('/api', ai.router);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Frontend (single-page app).
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Central error handler (never leaks stack traces to clients).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(config.port, () => {
  console.log(`Surplus app listening on port ${config.port} (${config.nodeEnv})`);
});
