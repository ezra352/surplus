// Central configuration. Every secret comes from environment variables.
// The app refuses to boot unless all required values are present.
require('dotenv').config();

const REQUIRED = [
  'SESSION_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_ID',
  'STRIPE_WEBHOOK_SECRET',
];
// OPENAI_API_KEY and GEMINI_API_KEY are both optional: the app boots and all
// non-AI tools work without either. Priority: OpenAI first, then Gemini, then
// the built-in playbook. Gemini's free tier (via Google AI Studio) costs $0.

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('\nMissing required environment variables: ' + missing.join(', '));
  console.error('Copy .env.example to .env and fill in each value, then restart.\n');
  process.exit(1);
}

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  // Public base URL of the deployed app, e.g. https://seller-ai-app.up.railway.app
  // Used for Stripe redirect URLs. No trailing slash.
  appUrl: (process.env.APP_URL || `http://localhost:${process.env.PORT || '3000'}`).replace(/\/$/, ''),
  sessionSecret: process.env.SESSION_SECRET,
  dbPath: process.env.DB_PATH || './data/app.db',

  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripePriceId: process.env.STRIPE_PRICE_ID,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  openaiApiKey: process.env.OPENAI_API_KEY || null,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  geminiApiKey: process.env.GEMINI_API_KEY || null,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

  // Max AI chat messages per user per day (cost control).
  dailyMessageLimit: parseInt(process.env.DAILY_MESSAGE_LIMIT || '100', 10),
};

module.exports = config;
