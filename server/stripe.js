// Stripe billing: Checkout for new subscriptions, Customer Portal for
// management, and a webhook that keeps our DB in sync with Stripe.
// All keys and the price ID come from environment variables. Test mode by default.
const express = require('express');
const Stripe = require('stripe');
const config = require('./config');
const db = require('./db');
const { requireAuth } = require('./auth');

const stripe = new Stripe(config.stripeSecretKey);
const router = express.Router();

// Public price info for the landing page (no secrets exposed).
router.get('/price', async (req, res) => {
  try {
    const price = await stripe.prices.retrieve(config.stripePriceId);
    res.json({
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring && price.recurring.interval,
    });
  } catch (e) {
    console.error('Stripe price lookup failed:', e.message);
    res.status(502).json({ error: 'Could not load pricing right now.' });
  }
});

// Start a new Premium subscription via Stripe Checkout.
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { userId: String(req.user.id) },
      });
      customerId = customer.id;
      db.setStripeCustomerId(req.user.id, customerId);
    }
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: config.stripePriceId, quantity: 1 }],
      success_url: `${config.appUrl}/app?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.appUrl}/app?canceled=1`,
      metadata: { userId: String(req.user.id) },
    });
    res.json({ url: checkoutSession.url });
  } catch (e) {
    console.error('Checkout creation failed:', e.message);
    res.status(502).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// Verify a just-completed Checkout session and sync Premium status.
// Fallback for when the Stripe webhook isn't configured yet: the frontend
// calls this once after redirecting back from Checkout with ?upgraded=1.
router.get('/verify-session', requireAuth, async (req, res) => {
  const sessionId = req.query.session_id;
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'Missing checkout session.' });
  }
  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    if (!s.metadata || s.metadata.userId !== String(req.user.id)) {
      return res.status(403).json({ error: 'Session does not belong to this account.' });
    }
    if (s.payment_status !== 'paid') {
      return res.json({ paid: false });
    }
    if (s.customer) db.setStripeCustomerId(req.user.id, String(s.customer));
    if (s.subscription) {
      db.setSubscriptionStatus(req.user.id, await statusFromSubscription(s.subscription));
    } else {
      db.setSubscriptionStatus(req.user.id, 'active');
    }
    const user = db.findUserById(req.user.id);
    res.json({ paid: true, user: db.toPublicUser(user) });
  } catch (e) {
    console.error('Session verification failed:', e.message);
    res.status(502).json({ error: 'Could not verify payment. Please try again.' });
  }
});

// Open the Stripe Customer Portal (change plan, update card, cancel).
router.post('/portal', requireAuth, async (req, res) => {
  try {
    if (!req.user.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account yet. Subscribe first.' });
    }
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: req.user.stripe_customer_id,
      return_url: `${config.appUrl}/app`,
    });
    res.json({ url: portalSession.url });
  } catch (e) {
    console.error('Portal creation failed:', e.message);
    res.status(502).json({ error: 'Could not open billing portal. Please try again.' });
  }
});

// ---- Webhook: keep subscription_status in sync with Stripe ----
async function statusFromSubscription(subscriptionId) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return sub.status; // trialing | active | past_due | canceled | incomplete | ...
}

async function handleWebhookEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      const userId = s.metadata && s.metadata.userId;
      if (userId && s.customer) {
        db.setStripeCustomerId(Number(userId), String(s.customer));
        if (s.subscription) {
          db.setSubscriptionStatus(Number(userId), await statusFromSubscription(s.subscription));
        }
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const user = db.findUserByStripeCustomerId(String(sub.customer));
      if (user) db.setSubscriptionStatus(user.id, sub.status);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const user = db.findUserByStripeCustomerId(String(sub.customer));
      if (user) db.setSubscriptionStatus(user.id, 'canceled');
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const user = invoice.customer && db.findUserByStripeCustomerId(String(invoice.customer));
      if (user) db.setSubscriptionStatus(user.id, 'past_due');
      break;
    }
    default:
      break; // ignore everything else
  }
}

// Raw body is required for signature verification; mounted before express.json().
function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message);
    return res.status(400).send('Invalid signature');
  }
  handleWebhookEvent(event)
    .then(() => res.json({ received: true }))
    .catch((e) => {
      console.error('Webhook handling failed:', e.message);
      res.status(500).send('Handler error');
    });
}

module.exports = { router, webhookHandler };
