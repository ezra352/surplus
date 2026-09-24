// Rule-based seller Q&A knowledge base. Used by POST /api/chat when no
// OpenAI key is configured. Each topic: id, match keywords, and a practical
// plain-language answer. Keep answers conceptual and durable — point to
// Seller Central for current fee numbers and policy details.
const TOPICS = [
  {
    id: 'fba-fees',
    keys: ['fba fee', 'fulfillment fee', 'referral fee', 'fees', 'how much does amazon take', 'amazon cut', 'amazon takes'],
    answer: `Amazon takes three main bites out of every FBA sale:

1. Referral fee — a percentage of the selling price, usually 15% for most categories (some are 8%, some higher). Taken on every sale, no exceptions.
2. FBA fulfillment fee — a flat fee per unit based on size and weight. This covers pick, pack, and ship. Bigger and heavier = more expensive.
3. Monthly storage fees — charged per cubic foot of warehouse space. Normal most of the year, much higher in Q4 (Oct–Dec), and brutal for inventory sitting over 6–12 months.

To see YOUR exact fees: Seller Central → Reports → Payments, or use the Revenue Calculator (search "revenue calculator" in Seller Central) and punch in any ASIN. Never guess fees from memory — Amazon changes them, usually every year or two. Verify before you commit to a product.`,
  },
  {
    id: 'profit-margin',
    keys: ['profit margin', 'margin', 'how much profit', 'is it profitable', 'worth selling', 'good margin'],
    answer: `Here's the quick math for one unit:

Selling price
− product cost (what you paid the supplier)
− inbound shipping per unit
− referral fee (~15% of price)
− FBA fulfillment fee
− ad spend per unit
= your true profit

As a rule of thumb:
• Under 20% margin — thin. One surprise (fee hike, returns) wipes you out.
• 25–35% — healthy. This is where most solid FBA products live.
• Over 40% — great, but double-check you didn't forget a cost.

Try the Profit tab above with your real numbers — it runs this exact math in seconds. And remember: Amazon shows you revenue, not profit. A $30 sale is not $30 in your pocket.`,
  },
  {
    id: 'reimbursement-what',
    keys: ['reimbursement', 'amazon owes', 'get money back', 'lost inventory', 'damaged', 'owe me'],
    answer: `Amazon regularly owes sellers money and doesn't volunteer it. The big ones:

• Lost inbound shipments — you shipped 500 units, Amazon says they received 480. Those 20 are claimable.
• Damaged in the warehouse — units broken while Amazon stored or handled them.
• Customer-damaged returns — buyer breaks it, Amazon refunds them AND charges you. Often Amazon should eat that cost.
• Fee overcharges — wrong weight/dimension tier on your ASIN means you've been overpaying the FBA fee on every sale.
• Missing removal shipments — you asked for inventory back and it never arrived.

Use the Recovery tab: work the checklist, then the claim builder writes the actual letter for you. One successful claim often covers a year of this subscription.`,
  },
  {
    id: 'file-claim',
    keys: ['file a claim', 'open a case', 'seller support', 'how to claim', 'submit claim'],
    answer: `How to file a reimbursement claim:

1. In Seller Central, go to Help → "Get support" → open a case.
2. Pick the right category (usually "Fulfillment by Amazon" → the matching issue type).
3. Be factual and short: what happened, the ASIN/shipment ID, dates, unit count, and the dollar amount. No emotion, no essays.
4. Attach proof if you have it: supplier invoice, shipment packing list, photos.

The claim builder in the Recovery tab writes this for you — pick the claim type, fill in the blanks, copy, paste into the case.

If they deny it: reply once, politely, restating the facts and asking for a re-check. If denied again, open a fresh case — a different rep often sees it differently. Stay factual every time.`,
  },
  {
    id: 'listing-title',
    keys: ['title', 'product title', 'listing title'],
    answer: `Amazon title rules that actually matter:

• Keep it under 200 characters (most categories).
• Format: Brand + product + key attributes. Example: "AquaSteel Insulated Water Bottle 32oz, Stainless Steel, Leak-Proof Lid, Black"
• Front-load the important keywords — shoppers and search both weight the start.
• No ALL CAPS, no promo phrases ("Best Seller!", "Free Shipping"), no subjective fluff ("amazing", "high quality").
• Don't repeat words and don't stuff every keyword — that's what backend search terms are for.

The Listing tab builds one for you from your product details and checks the length automatically.`,
  },
  {
    id: 'bullets',
    keys: ['bullet', 'bullet points', 'bullets'],
    answer: `You get 5 bullet points. Make each one earn its place:

• Lead with the BENEFIT, then the feature. "Stays cold 24 hours — double-wall vacuum insulation" beats "Double-wall vacuum insulation."
• One idea per bullet. Don't cram.
• Answer the objections buyers actually have: Will it leak? Does it fit my car holder? Is it dishwasher safe?
• Keep each under ~500 characters, plain language, no hype words Amazon flags ("best", "#1", "guaranteed").

The Listing tab drafts all five from your feature list — you just describe the product in normal words.`,
  },
  {
    id: 'backend-terms',
    keys: ['backend', 'search terms', 'keywords', 'seo'],
    answer: `Backend search terms are hidden keywords — shoppers never see them, but Amazon's search uses them. Rules:

• ~249 bytes total (roughly 249 characters in English). That's the whole budget.
• No repeats — don't include words already in your title or bullets, it's wasted space.
• No brand names that aren't yours, no ASINs, no subjective words ("best", "cheap").
• Use synonyms and alternate phrasings shoppers actually type: "water bottle", "sports bottle", "gym bottle".
• Commas or spaces both work; don't stress the format.

The Listing tab generates a set from your keyword list and trims it to fit the limit.`,
  },
  {
    id: 'ppc-basics',
    keys: ['ppc', 'ads', 'advertising', 'acos', 'sponsored'],
    answer: `PPC basics in plain English:

• You bid on keywords; when a shopper clicks your ad, you pay. Sales are not guaranteed — clicks are what you buy.
• ACOS = ad spend ÷ ad sales. If you spent $20 to make $100 in sales, ACOS is 20%.
• Your break-even ACOS ≈ your profit margin. 30% margin means a 30% ACOS breaks even. Below that, ads make money; above it, they lose money.
• Start with one auto campaign + one manual campaign on your best 5–10 keywords. Small daily budget ($10–20).
• Kill keywords with 20+ clicks and zero sales. They're burning money.
• TACOS (total ACOS) = ad spend ÷ ALL sales — this tells you if ads are growing the whole listing or just cannibalizing organic sales.

Don't run ads to "get reviews" or "rank" without a budget cap. Ads are a math game: know your margin, watch ACOS weekly.`,
  },
  {
    id: 'product-research',
    keys: ['product research', 'find a product', 'what to sell', 'niche', 'pick a product'],
    answer: `What to look for in a product idea:

• Price sweet spot: $20–$60. Under $20 and fees eat you alive; over $60 and shoppers think too hard.
• Small and light. Every ounce raises your FBA fee and shipping cost. Shoebox-sized is ideal.
• Demand with weak competition: top sellers doing real volume (hundreds of reviews) but listings that look lazy — bad photos, weak titles, few reviews on page one.
• Avoid: electronics (returns), fragile glass, trademarked stuff, anything needing FDA approval for your first product.
• Can you make it 10% better or different? A small real improvement beats "me too" every time.

The Research tab has a product scorer — punch in your idea and it grades it on these exact criteria.`,
  },
  {
    id: 'inventory-reorder',
    keys: ['reorder', 'inventory', 'stock', 'how much to order', 'reorder point', 'safety stock'],
    answer: `The only inventory formula you need:

Reorder point = daily sales × (supplier lead time + safety stock days)

Example: you sell 10/day, supplier takes 30 days, you want 14 days of buffer.
Reorder point = 10 × (30 + 14) = 440 units. When stock hits 440, order.

• Lead time = the LONGEST it's ever taken, not the average. Suppliers lie.
• Safety stock = your sleep-at-night buffer. 14 days is a sane default.
• Order quantity = reorder point − current stock (plus a little extra if you're growing).

The Inventory tab runs this for you. Running out of stock kills your ranking — Amazon rewards listings that never go dark.`,
  },
  {
    id: 'stockout',
    keys: ['out of stock', 'stockout', 'ran out'],
    answer: `Running out of stock hurts more than the lost sales:

• Your search ranking drops while you're dark — competitors take your spot.
• When you restock, you often have to spend on ads to climb back.
• Repeated stockouts train Amazon's algorithm to trust your listing less.

Prevention: the reorder-point math in the Inventory tab, plus ordering when you hit the point — not when you "feel low." If you're growing fast, add 20–30% to your order. Extra units in the warehouse are cheap insurance; a month of stockout is expensive.`,
  },
  {
    id: 'storage-fees',
    keys: ['storage fee', 'long term storage', 'aged inventory', 'q4 storage'],
    answer: `Storage fees have two layers:

1. Monthly storage — per cubic foot, charged on your daily average volume. Jumps significantly in Q4 (Oct–Dec).
2. Aged inventory surcharge — units sitting 6+ months get extra fees; 12+ months gets worse.

What to do:
• Check Inventory → Inventory Planning in Seller Central monthly. Sort by age.
• Anything over 6 months with no sales velocity: cut the price, run a coupon, or create a removal order. Paying to store dead stock is the worst outcome.
• Before Q4, clear slow movers. Q4 storage rates punish hoarding.

Rule: inventory should turn. If it hasn't sold in 6 months, it's not inventory — it's a storage bill.`,
  },
  {
    id: 'reviews',
    keys: ['review', 'reviews', 'get reviews', 'rating'],
    answer: `Reviews, honestly:

• You can't pay for them, trade them, or put inserts begging for 5 stars. Amazon bans sellers for this — it's not worth your account.
• What works: the "Request a Review" button in Seller Central (Order → click buyer name → request). It's Amazon-approved and free.
• Enroll in Vine (for new listings, gives honest reviews from trusted reviewers) — costs a fee but it's the legitimate fast lane.
• A 4.3-star listing with 500 reviews outsells a 5.0 with 12 reviews. Volume of social proof beats perfection.
• Respond to negative reviews with product fixes, not arguments. One honest reply showing you fixed the issue is worth ten 5-stars.

Never buy reviews. Ever. Sellers lose entire businesses over it.`,
  },
  {
    id: 'buy-box',
    keys: ['buy box', 'buybox', 'win the buy box'],
    answer: `The Buy Box is the "Add to Cart" button — whoever holds it gets ~80%+ of sales on that listing.

• For FBA sellers with competitive pricing, you usually rotate the Buy Box with other sellers rather than owning it outright.
• Price matters most, but so do: in-stock status, seller feedback rating, shipping speed (FBA wins here), and order defect rate.
• If you created the listing (private label), you own the Buy Box by default — one of the big perks of selling your own brand vs. reselling.
• Losing the Buy Box suddenly? Check for hijackers (other sellers on your listing) or a price that's drifted above the pack.

Private label = you own the listing and the Buy Box. Wholesale/resale = you fight for it.`,
  },
  {
    id: 'launch',
    keys: ['launch', 'launching', 'new product', 'launch strategy', 'rank'],
    answer: `A sane launch sequence:

1. Listing first, perfected — great photos, tight title, real bullets. Don't launch traffic to a weak listing.
2. Enroll in Vine for early honest reviews (even 5–10 reviews changes conversion).
3. Turn on PPC day one — small budget, your best keywords. Early sales velocity is what ranking is built on.
4. Price 10–15% below your target for the first 2–4 weeks to buy velocity, then raise. Tell yourself the discount is a marketing expense.
5. Watch: conversion rate (unit session %), keyword rank, ACOS. If clicks come but nobody buys, the listing (or price) is the problem, not the ads.

Expect 60–90 days before a listing finds its level. Launches that "fail" in week 2 usually just needed patience and better photos.`,
  },
  {
    id: 'returns',
    keys: ['return', 'returns', 'refund'],
    answer: `Returns on FBA, simplified:

• Amazon handles the return shipping and customer service — that's what the FBA fee buys you.
• You get refunded the referral fee on most returns, but NOT the FBA fulfillment fee. Returns cost you real money every time.
• Return rate over ~5–8% is a red flag — it usually means the listing oversells or the product disappoints. Fix the listing or the product.
• Customer-damaged returns where Amazon still charges you: these are often reimbursable. Check the Recovery tab.

Design for low returns: accurate photos, honest bullets, size/fit info where relevant. Every prevented return is pure profit.`,
  },
  {
    id: 'account-health',
    keys: ['account health', 'suspended', 'suspension', 'policy violation', 'deactivated'],
    answer: `Account health is your seller license — protect it:

• Watch it in Seller Central: Performance → Account Health. Green is life.
• The metrics that matter: Order Defect Rate (keep under 1%), late shipment rate, valid tracking rate, cancellation rate.
• Never sell counterfeit, never manipulate reviews, never open a second account to dodge a suspension. These get you permanently banned.
• If suspended: you get ONE good appeal shot. Write a plan of action: what happened, what you fixed, how you'll prevent it. Short, factual, no begging.

Most suspensions come from inattention, not malice — check Account Health weekly like you'd check your bank balance.`,
  },
  {
    id: 'photos',
    keys: ['photo', 'photos', 'images', 'main image', 'product photography'],
    answer: `Photos sell the product. Shoppers decide in about 3 seconds.

• Main image: pure white background, product fills ~85% of the frame. This is Amazon's rule and it converts.
• Images 2–6: lifestyle shots (product in use), scale shot (hand/object for size), feature callouts, what's-in-the-box.
• Infographics work — a clean image with 3–4 feature callouts beats a paragraph nobody reads.
• 2000+ pixels on the longest side enables zoom. Always.
• DIY is fine to start (phone + white poster board + daylight), but budget $200–400 for a pro shoot once a product proves itself. It's the highest-ROI money in FBA.

If your clicks are fine but sales are weak, photos are suspect #1.`,
  },
  {
    id: 'pricing',
    keys: ['price', 'pricing', 'how to price', 'charge'],
    answer: `Pricing that works:

• Find the cluster: where do the successful competitors price? Don't be the cheapest (race to zero) or the priciest (no reason to trust you yet).
• Price for your margin AFTER all fees — use the Profit tab. A $29.99 price means nothing until you know the $9.50 truth underneath.
• Charm pricing works: $29.99 beats $30.00. It's cliché because it's true.
• Launch 10–15% low for velocity, raise once reviews land.
• Never compete on price alone against established sellers — compete on listing quality, images, and a small real differentiation.

Reprice only when something changed (fees, costs, competition) — not daily out of anxiety.`,
  },
  {
    id: 'upc',
    keys: ['upc', 'barcode', 'gs1', 'gtin'],
    answer: `Barcodes, quick version:

• Amazon requires a unique UPC/GTIN per product. Buy them from GS1 US (the official source) — about $30 each for a single, cheaper in bulk.
• Don't buy $1 UPCs from random barcode websites. Those are recycled codes that can collide with other products and cause listing nightmares.
• Brand Registry (which protects your listing from hijackers) requires a GS1-registered trademark + GS1 barcodes. Worth doing once you're committed to a brand.
• Stickerless/commingled inventory: skip it. Use Amazon barcodes (FNSKU labels) so your units are tracked as YOURS. Commingling means your perfect units get mixed with someone else's fakes.`,
  },
  {
    id: 'gated',
    keys: ['gated', 'ungate', 'restricted', 'category approval', 'grocery', 'topical'],
    answer: `Some categories need Amazon's approval before you can sell (gated): grocery, beauty/topical, toys at holidays, and most brands.

• Ungating usually needs: a supplier invoice (real wholesaler, not a retail receipt) showing 10+ units purchased, sometimes product photos.
• Invoices must show your business name and address matching your seller account.
• Buy from the actual manufacturer or authorized distributor — Amazon checks.
• Start ungated (home & kitchen, pet supplies, sports) for your first product. Fight the gating battle once you know the game.

Don't buy 500 units of a gated product hoping approval comes through. Get approved first.`,
  },
  {
    id: 'sales-tax',
    keys: ['sales tax', 'tax', '1099'],
    answer: `Tax, simplified (not tax advice — talk to an accountant):

• Amazon collects and remits sales tax for you in most states now (marketplace facilitator laws). This used to be a nightmare; it's mostly handled.
• Income tax: your FBA profit is business income. Set aside 25–30% as you go or quarterly estimates will hurt.
• Amazon sends a 1099-K if you cross the reporting threshold — but you owe tax on profit regardless of any form.
• Keep clean books from day one: separate bank account, track every cost. The Profit tab helps you see per-unit truth; your accountant needs the full picture.

One conversation with an e-commerce accountant in your first month saves real money. Worth the few hundred bucks.`,
  },
  {
    id: 'keyword-research',
    keys: ['keyword research', 'find keywords', 'which keywords'],
    answer: `Finding keywords without expensive tools:

1. Amazon's search bar — type your product's main word and write down every autocomplete suggestion. That's real shopper language, free.
2. Competitor listings — read the titles and bullets of the top 5 sellers. The words they all use are the words that matter.
3. Reviews — shoppers describe products in their own words ("fits my cup holder", "doesn't leak in my bag"). Mine those phrases.
4. Sort by relevance: the 5–10 phrases closest to what your product IS go in the title; the rest go in bullets and backend terms.

Put the keywords into the Listing tab and it places them correctly (title → bullets → backend) without stuffing.`,
  },
  {
    id: 'competitor',
    keys: ['competitor', 'competition', 'competing', 'analyze'],
    answer: `How to size up competitors on any listing:

• Review count + rating: under 500 reviews on page one = soft market. Over 5,000 each = fortress.
• Listing quality: bad photos, thin bullets, no A+ content = you can out-execute them.
• Price cluster: is everyone $24–29? That's the market's verdict on value.
• BSR (Best Sellers Rank): lower number = selling more. Compare BSR across competitors to see who's actually moving units.
• Red flags: big brands, products with 10k+ reviews and 4.8 stars, patent-heavy categories.

You're not looking for zero competition (that means zero demand). You're looking for demand with beatable listings.`,
  },
  {
    id: 'beginner-mistakes',
    keys: ['mistake', 'beginner', 'new seller', 'just starting', 'starting out'],
    answer: `The mistakes that kill new sellers:

1. Buying inventory before doing the math. Run the Profit tab FIRST. Most "great ideas" die at the fee math.
2. Ordering 1,000 units of product #1. Start with 200–300. You'll learn more from a small live test than months of research.
3. Ignoring the listing. Great product + lazy listing = no sales. Photos and copy are half the battle.
4. Running out of stock in month two. The reorder math exists — use it.
5. Buying reviews or doing sketchy hacks. Account death. Not worth it.
6. Quitting at week 3. Listings take 60–90 days to find their level.

Start small, do the math, write a good listing, don't get banned, be patient. That's 90% of it.`,
  },
];

// Score a message against topics by keyword hits. Longer keyword matches
// weigh more; require a minimum score so random chatter falls through.
function findAnswer(text) {
  const t = (text || '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    let score = 0;
    for (const k of topic.keys) {
      if (t.includes(k)) score += k.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  // Need at least one solid keyword hit (min ~5 chars matched).
  if (best && bestScore >= 5) return best.answer;
  return null;
}

function fallbackAnswer() {
  const ids = ['fba-fees', 'profit-margin', 'reimbursement-what', 'listing-title', 'ppc-basics', 'product-research', 'inventory-reorder', 'beginner-mistakes'];
  const names = {
    'fba-fees': 'FBA fees explained',
    'profit-margin': 'profit margins',
    'reimbursement-what': 'money Amazon may owe you',
    'listing-title': 'listing titles',
    'ppc-basics': 'PPC basics',
    'product-research': 'product research',
    'inventory-reorder': 'reorder math',
    'beginner-mistakes': 'beginner mistakes',
  };
  return `I can help with the core seller playbook — here's what I know cold:\n\n` +
    ids.map(id => `• ${names[id]}`).join('\n') +
    `\n\nAsk me about any of those, or try the tabs above: the calculators, the claim builder, and the listing builder all work right now. (When the AI copilot is enabled, I'll handle anything you throw at me.)`;
}

module.exports = { findAnswer, fallbackAnswer };
