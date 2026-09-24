// Deterministic generators: claim letters and listing copy. Pure functions,
// no AI, no network. Premium-gated at the route layer.

function clean(s, max) {
  s = String(s || '').trim().replace(/\s+/g, ' ');
  return max ? s.slice(0, max) : s;
}

// ---------- Claim letter builder ----------
const CLAIM_TYPES = {
  'lost-inbound': {
    label: 'Lost inbound shipment',
    subject: d => `Reimbursement request — lost units, shipment ${d.shipmentId || '(ID)'}`,
    body: d => `Hello Seller Support,

I am requesting reimbursement for units lost in an inbound FBA shipment.

• ASIN: ${d.asin}
• Shipment ID: ${d.shipmentId}
• Date shipped: ${d.date}
• Units shipped (per packing list): ${d.units}
• Units Amazon shows as received: ${d.received || 'fewer than shipped'}
• Estimated value of missing units: $${d.value}

I have attached my packing list / supplier invoice for this shipment. Please reimburse the missing units or confirm receipt.

Thank you,
${d.name}`,
  },
  'damaged-warehouse': {
    label: 'Damaged in FBA warehouse',
    subject: d => `Reimbursement request — damaged units, ASIN ${d.asin || '(ASIN)'}`,
    body: d => `Hello Seller Support,

I am requesting reimbursement for units damaged while in Amazon's fulfillment network.

• ASIN: ${d.asin}
• Approximate date(s) of damage: ${d.date}
• Units affected: ${d.units}
• Estimated value: $${d.value}
${d.details ? `• Details: ${d.details}` : ''}

These units were received in sellable condition and damaged during Amazon handling/storage. Please reimburse per the FBA lost & damaged inventory policy.

Thank you,
${d.name}`,
  },
  'customer-damaged': {
    label: 'Customer-damaged return charged to me',
    subject: d => `Reimbursement request — customer-damaged return, order ${d.orderId || '(order ID)'}`,
    body: d => `Hello Seller Support,

I am requesting reimbursement for a customer return where the item was returned damaged and the cost was charged to me.

• ASIN: ${d.asin}
• Order ID: ${d.orderId}
• Return date: ${d.date}
• Refund amount charged to me: $${d.value}
${d.details ? `• Details: ${d.details}` : ''}

The damage was caused by the customer/carrier, not by a product defect, and under the FBA returns policy this cost should be borne by Amazon. Please review and reimburse.

Thank you,
${d.name}`,
  },
  'fee-overcharge': {
    label: 'FBA fee overcharge (wrong size/weight tier)',
    subject: d => `Fee correction request — wrong size tier, ASIN ${d.asin || '(ASIN)'}`,
    body: d => `Hello Seller Support,

I believe the FBA fulfillment fee on my ASIN is calculated using the wrong size/weight tier.

• ASIN: ${d.asin}
• Current tier Amazon applies: ${d.details || '(see attached)'}
• Correct tier per actual measurements: ${d.details2 || '(see attached)'}
• Date range affected: ${d.date}
• Estimated overcharge: $${d.value}

I have attached product measurements and photos with a tape measure for verification. Please correct the tier and reimburse the fee difference for the affected period.

Thank you,
${d.name}`,
  },
  'missing-removal': {
    label: 'Missing removal shipment',
    subject: d => `Reimbursement request — missing removal order ${d.orderId || '(order ID)'}`,
    body: d => `Hello Seller Support,

I am requesting reimbursement for a removal order that never arrived or arrived short.

• Removal order ID: ${d.orderId}
• ASIN(s): ${d.asin}
• Date requested: ${d.date}
• Units expected: ${d.units}
• Units received: ${d.received || 'none'}
• Estimated value: $${d.value}

Please investigate the carrier tracking and reimburse the missing units.

Thank you,
${d.name}`,
  },
  'wrong-refund': {
    label: 'Incorrect customer refund',
    subject: d => `Reimbursement request — incorrect refund, order ${d.orderId || '(order ID)'}`,
    body: d => `Hello Seller Support,

I am requesting a review of a customer refund that I believe was issued incorrectly.

• ASIN: ${d.asin}
• Order ID: ${d.orderId}
• Refund date: ${d.date}
• Refund amount: $${d.value}
${d.details ? `• What happened: ${d.details}` : ''}

Please review the return records and reimburse if the refund was issued in error.

Thank you,
${d.name}`,
  },
};

function buildClaim(input) {
  const type = CLAIM_TYPES[input.claimType] ? input.claimType : 'lost-inbound';
  const t = CLAIM_TYPES[type];
  const d = {
    name: clean(input.name, 80) || 'Seller',
    asin: clean(input.asin, 20),
    shipmentId: clean(input.shipmentId, 40),
    orderId: clean(input.orderId, 40),
    date: clean(input.date, 40),
    units: clean(input.units, 10),
    received: clean(input.received, 10),
    value: clean(input.value, 12),
    details: clean(input.details, 300),
    details2: clean(input.details2, 120),
  };
  return { type, label: t.label, subject: t.subject(d), body: t.body(d) };
}

// ---------- Listing builder ----------
function titleCase(s) {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function buildListing(input) {
  const brand = clean(input.brand, 40);
  const name = clean(input.name, 120);
  const audience = clean(input.audience, 80);
  const features = String(input.features || '')
    .split('\n').map(f => clean(f, 200)).filter(Boolean).slice(0, 8);
  const keywords = String(input.keywords || '')
    .split(',').map(k => clean(k, 40).toLowerCase()).filter(Boolean).slice(0, 12);

  // Title: Brand + product + top attributes/keywords, <= 200 chars.
  const kwTop = keywords.slice(0, 3).map(titleCase).join(', ');
  let title = [brand, titleCase(name), kwTop].filter(Boolean).join(' — ');
  if (title.length > 200) title = title.slice(0, 197) + '...';

  // Bullets: benefit-led, one idea each, <= 5.
  const benefitLead = {
    default: f => f.charAt(0).toUpperCase() + f.slice(1),
  };
  const bullets = features.slice(0, 5).map(f => {
    let b = benefitLead.default(f);
    if (!/[.!?]$/.test(b)) b += '.';
    return b.length > 500 ? b.slice(0, 497) + '...' : b;
  });
  while (bullets.length < 5) {
    bullets.push(null); // frontend renders placeholders for missing ones
  }

  // Description: short paragraphs.
  const descParts = [];
  if (name) descParts.push(`${brand ? brand + ' ' : ''}${titleCase(name)}${audience ? ` — made for ${audience}` : ''}.`);
  if (features.length) descParts.push(features.map(f => benefitLead.default(f) + '.').join(' '));
  if (keywords.length) descParts.push(`Search terms customers use: ${keywords.slice(0, 6).join(', ')}.`);
  const description = descParts.join('\n\n');

  // Backend terms: unique, not in title, <= 249 bytes.
  const titleWords = new Set(title.toLowerCase().split(/[^a-z0-9]+/));
  const terms = [];
  let bytes = 0;
  for (const k of keywords) {
    const words = k.split(/[^a-z0-9]+/).filter(w => w && !titleWords.has(w) && !terms.includes(w));
    for (const w of words) {
      const nb = bytes + (bytes ? 1 : 0) + Buffer.byteLength(w);
      if (nb > 249) break;
      terms.push(w);
      bytes = nb;
    }
  }
  const backendTerms = terms.join(' ');

  return {
    title, titleLength: title.length,
    bullets: bullets.filter(Boolean),
    bulletPlaceholders: 5 - bullets.filter(Boolean).length,
    description,
    backendTerms, backendBytes: bytes,
    warnings: [
      title.length >= 200 ? 'Title hit the 200-character limit — consider shortening.' : null,
      bullets.filter(Boolean).length < 3 ? 'Add more features for stronger bullets (aim for 5).' : null,
      !backendTerms ? 'Add keywords not already in the title to fill backend search terms.' : null,
    ].filter(Boolean),
  };
}

module.exports = { buildClaim, CLAIM_TYPES, buildListing };
