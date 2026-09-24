# Surplus — AI Seller Assistant for Amazon Sellers

A sellable web app: Amazon sellers sign up, pay a monthly Premium subscription
via Stripe, and get an AI copilot plus seller tools (cash recovery, inventory
planning, listing optimizer, profit calculator, product research).

**Stack:** Node.js + Express · SQLite (`better-sqlite3`, swappable for Postgres)
· Stripe Billing (Checkout + Customer Portal + webhooks) · OpenAI chat API.

---

## 1. Quick start (local)

**Prerequisites:** Node.js 18+ and a Stripe account + OpenAI API key (see sections
2 and 3 to get them).

```bash
cd seller-ai-app
cp .env.example .env
# open .env and fill in every value
npm install
npm start
```

Open http://localhost:3000. The app refuses to start if any required
environment variable is missing — it will tell you exactly which ones.

---

## 2. Create the Stripe product and price (do this first)

1. Go to https://dashboard.stripe.com and create an account (or log in).
2. Make sure **Test mode** is ON (toggle in the top-right) while you build.
3. Go to **Product catalog → Create product**:
   - Name: `Surplus Premium`
   - Pricing: **Recurring**, price = whatever you want to charge per month
     (e.g. $29.00 USD), billing period **Monthly**.
   - Save.
4. Click the price you just created and copy its **Price ID** — it looks like
   `price_1AbC...`. This is your `STRIPE_PRICE_ID`.
5. Go to **Developers → API keys** and copy your **Secret key**
   (`sk_test_...`). This is your `STRIPE_SECRET_KEY`.

### Webhook (so the app knows who paid)

1. Install the Stripe CLI: https://docs.stripe.com/stripe-cli
2. Log in: `stripe login`
3. Forward webhooks to your local app while developing:
   ```bash
   stripe listen --forward-to localhost:3000/webhooks/stripe
   ```
   The CLI prints a webhook signing secret like `whsec_...` — put it in your
   `.env` as `STRIPE_WEBHOOK_SECRET`.
4. In another terminal, trigger a test event to confirm the app receives it:
   ```bash
   stripe trigger checkout.session.completed
   ```
5. For production (Railway), add the endpoint in the dashboard instead:
   **Developers → Webhooks → Add endpoint** →
   `https://YOUR-APP.up.railway.app/webhooks/stripe`, select the events
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`. Copy the signing secret into Railway's env vars.

---

## 3. Get an OpenAI API key

1. Go to https://platform.openai.com/api-keys and create a key.
2. Put it in `.env` as `OPENAI_API_KEY`.
3. Add a billing method and a **spending limit** in the OpenAI dashboard —
   every customer message costs you a few cents, and the app's daily
   per-user message cap (`DAILY_MESSAGE_LIMIT`, default 100) is your
   second layer of cost control.

---

## 4. Deploy to Railway (recommended)

1. Push this folder to a GitHub repo.
2. Go to https://railway.app → **New Project → Deploy from GitHub repo**,
   select the repo.
3. Railway auto-detects Node. Set the **start command** to `npm start`
   (Railway usually picks this up from `package.json`).
4. In the Railway project go to **Variables** and add every variable from
   `.env.example`, using your **live** Stripe keys (`sk_live_...`) and the
   production webhook secret when you go live. Set `NODE_ENV=production` and
   `APP_URL=https://YOUR-APP.up.railway.app`.
5. Add a persistent volume mounted at `/app/data` and set `DB_PATH` to
   `/app/data/app.db` — otherwise your user database is wiped on every
   redeploy. (Long-term: migrate `server/db.js` to Postgres; the rest of the
   app only uses its helper functions, so no route code needs to change.)
6. Deploy. Open the public URL — sign up, upgrade via test checkout
   (card `4242 4242 4242 4242`), and confirm Premium unlocks.

**Alternatives:** the same code deploys on Render (Web Service, `npm start`) or
Fly.io with no changes.

---

## 5. Environment variables reference

| Variable | Required | What it is |
|---|---|---|
| `SESSION_SECRET` | yes | Long random string for login sessions |
| `APP_URL` | yes | Public base URL, no trailing slash |
| `STRIPE_SECRET_KEY` | yes | `sk_test_...` (dev) / `sk_live_...` (prod) |
| `STRIPE_PRICE_ID` | yes | `price_...` from your Premium product |
| `STRIPE_WEBHOOK_SECRET` | yes | `whsec_...` from CLI or dashboard |
| `OPENAI_API_KEY` | yes | `sk-...` from OpenAI |
| `OPENAI_MODEL` | no | Default `gpt-4o-mini` |
| `DAILY_MESSAGE_LIMIT` | no | Default `100` AI messages/user/day |
| `DB_PATH` | no | Default `./data/app.db` |
| `PORT` | no | Default `3000` |
| `NODE_ENV` | no | Set `production` on your host |

---

## 6. Launch checklist (in order)

- [ ] Stripe account created; **test mode** product + monthly price created
- [ ] `STRIPE_PRICE_ID`, `STRIPE_SECRET_KEY` copied into `.env`
- [ ] Webhook forwarding works locally (`stripe listen`); test event received
- [ ] OpenAI API key created; billing + spending limit set in OpenAI dashboard
- [ ] App runs locally: sign up → upgrade (test card) → chat works → cancel via billing portal
- [ ] Code pushed to GitHub; Railway project created from the repo
- [ ] Railway env vars set (switch Stripe keys to **live** mode for launch)
- [ ] Production webhook endpoint added in Stripe dashboard
- [ ] Persistent volume for SQLite (or Postgres migration)
- [ ] Buy a domain and point it at Railway (Railway → Settings → Domains)
- [ ] Flip Stripe out of test mode; do one real $1 test signup, then refund it

## 7. Later (after launch)

- **App stores:** wrapping this as an iPhone/Android app needs an Apple
  Developer account ($99/year, in your name) plus a wrapper such as Capacitor
  or a PWA listing. Do this after the web app has paying users.
- **Postgres:** migrate when you outgrow SQLite (see section 4, step 5).
- **OAuth / social login:** the app uses email + password for v1; add Google
  login later if users ask for it.

---

## Disclaimer

This is a software starting point, not business, legal, tax, or financial
advice. Forming a business, handling sales tax, and reporting subscription
revenue all have real legal and tax implications — talk to a licensed
professional (CPA / business attorney) before you start charging customers.
