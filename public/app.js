/* Surplus single-page app: landing, auth, and the seller workspace. */
(function () {
  'use strict';

  var state = { user: null, chatHistory: [], priceCache: null };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- View routing ----------
  var VIEWS = ['view-landing', 'view-auth', 'view-app'];
  function show(view) {
    VIEWS.forEach(function (v) { $(v).classList.toggle('hidden', v !== view); });
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-go]').forEach(function (el) {
    el.addEventListener('click', function () {
      var dest = el.getAttribute('data-go');
      if (dest === 'landing') { show('view-landing'); }
      else if (dest === 'login') { showAuth('login'); }
      else if (dest === 'signup') { showAuth('signup'); }
    });
  });

  function showAuth(mode) {
    show('view-auth');
    setAuthTab(mode || 'signup');
  }
  function setAuthTab(mode) {
    var isSignup = mode === 'signup';
    $('tab-signup').classList.toggle('active', isSignup);
    $('tab-login').classList.toggle('active', !isSignup);
    $('form-signup').classList.toggle('hidden', !isSignup);
    $('form-login').classList.toggle('hidden', isSignup);
  }
  $('tab-signup').addEventListener('click', function () { setAuthTab('signup'); });
  $('tab-login').addEventListener('click', function () { setAuthTab('login'); });

  // ---------- API helpers ----------
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch(path, opts).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || 'Request failed');
          err.status = res.status;
          err.needsUpgrade = data && data.needsUpgrade;
          throw err;
        }
        return data;
      });
    });
  }

  // ---------- Pricing (never hardcoded — read from Stripe via backend) ----------
  function money(amount, currency) {
    return (amount / 100).toLocaleString('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() });
  }
  function loadPrice() {
    if (state.priceCache) return Promise.resolve(state.priceCache);
    return api('/api/billing/price').then(function (p) {
      state.priceCache = p;
      var label = money(p.amount, p.currency);
      document.querySelectorAll('.price .amount').forEach(function (el) { el.textContent = label; });
      var pers = document.querySelectorAll('.price .per');
      pers.forEach(function (el) { el.textContent = '/' + (p.interval || 'month'); });
      return p;
    }).catch(function () {
      document.querySelectorAll('.price .amount').forEach(function (el) { el.textContent = 'Premium'; });
    });
  }

  // ---------- Auth ----------
  function setError(id, msg) {
    var el = $(id);
    if (!msg) { el.classList.add('hidden'); el.textContent = ''; return; }
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  $('form-signup').addEventListener('submit', function (e) {
    e.preventDefault();
    setError('su-error', null);
    var btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: $('su-email').value, password: $('su-password').value }),
    }).then(function (d) { enterApp(d.user); })
      .catch(function (err) { setError('su-error', err.message); btn.disabled = false; });
  });
  $('form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    setError('li-error', null);
    var btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('li-email').value, password: $('li-password').value }),
    }).then(function (d) { enterApp(d.user); })
      .catch(function (err) { setError('li-error', err.message); btn.disabled = false; });
  });
  $('btn-logout').addEventListener('click', function () {
    api('/api/auth/logout', { method: 'POST' }).finally(function () {
      state.user = null;
      state.chatHistory = [];
      history.pushState({}, '', '/');
      show('view-landing');
    });
  });

  function enterApp(user) {
    state.user = user;
    history.pushState({}, '', '/app');
    renderApp();
    show('view-app');
  }

  // ---------- Billing ----------
  function startCheckout() {
    api('/api/billing/checkout', { method: 'POST' })
      .then(function (d) { window.location.href = d.url; })
      .catch(function (err) { alert(err.message); });
  }
  function openPortal() {
    api('/api/billing/portal', { method: 'POST' })
      .then(function (d) { window.location.href = d.url; })
      .catch(function (err) { alert(err.message); });
  }
  $('btn-upgrade').addEventListener('click', startCheckout);
  $('btn-billing').addEventListener('click', function () {
    if (state.user && state.user.isPremium) openPortal();
    else startCheckout();
  });

  // ---------- App rendering ----------
  function renderApp() {
    var premium = state.user && state.user.isPremium;
    $('paywall').classList.toggle('hidden', premium);
    $('app-main').classList.toggle('hidden', !premium);
    $('btn-billing').textContent = premium ? 'Manage billing' : 'Upgrade';
    if (premium) {
      refreshUsage();
      if (state.chatHistory.length === 0) {
        addMsg('ai', 'Hi! I\'m your seller copilot. Ask me about fees, reimbursements, listings, PPC, product research, or inventory — or use the tools above. I answer from the seller playbook, instantly and free.');
      }
    }
  }

  function refreshUsage() {
    api('/api/chat/limit').then(function (d) {
      var pill = $('usage-pill');
      if (d.unlimited || !d.limit) { pill.classList.add('hidden'); return; }
      pill.classList.remove('hidden');
      pill.textContent = d.used + ' / ' + d.limit + ' messages today';
    }).catch(function () {});
  }

  // ---------- App tabs ----------
  document.querySelectorAll('.app-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.app-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.add('hidden'); });
      $('tab-' + tab.getAttribute('data-tab')).classList.remove('hidden');
    });
  });
  function goToChatTab() {
    document.querySelector('.app-tab[data-tab="chat"]').click();
  }

  // ---------- Chat ----------
  function addMsg(role, text) {
    var div = document.createElement('div');
    div.className = 'msg msg-' + role;
    div.innerHTML = esc(text).replace(/\n/g, '<br>');
    $('chat-messages').appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return div;
  }
  function sendChat(text) {
    text = (text || '').trim();
    if (!text) return;
    addMsg('user', text);
    $('chat-input').value = '';
    state.chatHistory.push({ role: 'user', content: text });
    if (state.chatHistory.length > 20) state.chatHistory = state.chatHistory.slice(-20);
    var typing = addMsg('ai', 'Thinking…');
    typing.classList.add('typing');
    var sendBtn = $('chat-send');
    sendBtn.disabled = true;
    api('/api/chat', { method: 'POST', body: JSON.stringify({ messages: state.chatHistory }) })
      .then(function (d) {
        typing.classList.remove('typing');
        typing.innerHTML = esc(d.reply).replace(/\n/g, '<br>');
        state.chatHistory.push({ role: 'assistant', content: d.reply });
        refreshUsage();
      })
      .catch(function (err) {
        typing.classList.remove('typing');
        if (err.needsUpgrade) {
          typing.textContent = 'Premium is required for the copilot. Upgrade to continue.';
          renderApp();
        } else {
          typing.textContent = 'Error: ' + err.message;
        }
      })
      .finally(function () { sendBtn.disabled = false; });
  }
  $('chat-send').addEventListener('click', function () { sendChat($('chat-input').value); });
  $('chat-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendChat($('chat-input').value);
  });

  // ---------- Recovery checklist ----------
  var RECOVERY_ITEMS = [
    ['Lost inbound shipments', 'Units Amazon marked as received short vs. what you shipped.'],
    ['Damaged in FBA warehouse', 'Units damaged while stored or handled by Amazon.'],
    ['Customer-damaged returns', 'Refunds issued where Amazon, not you, should absorb the cost.'],
    ['Fee overcharges', 'Wrong weight/dimension tier or referral fee applied to your ASINs.'],
    ['Missing removal shipments', 'Removal orders that never arrived or arrived short.'],
    ['Unrefunded returns', 'Customer returned the item but the refund was never reversed correctly.'],
  ];
  function renderChecklist() {
    var box = $('recovery-checklist');
    RECOVERY_ITEMS.forEach(function (item, i) {
      var label = document.createElement('label');
      label.className = 'check-item';
      label.innerHTML = '<input type="checkbox" data-i="' + i + '"><span><strong>' + esc(item[0]) + '</strong><small>' + esc(item[1]) + '</small></span>';
      box.appendChild(label);
    });
  }
  renderChecklist();
  $('btn-recovery-ask').addEventListener('click', function () {
    var checked = Array.prototype.slice.call(document.querySelectorAll('#recovery-checklist input:checked'))
      .map(function (c) { return RECOVERY_ITEMS[Number(c.getAttribute('data-i'))][0]; });
    var prompt = checked.length
      ? 'I want to check these reimbursement opportunities: ' + checked.join('; ') + '. For each one, tell me exactly which Seller Central report to pull, what to look for, and draft a short, factual claim message I can send to Seller Support.'
      : 'Walk me through the most common Amazon FBA reimbursement opportunities and how to check each one in Seller Central.';
    goToChatTab();
    sendChat(prompt);
  });

  // ---------- Inventory calculator ----------
  $('btn-inv-calc').addEventListener('click', function () {
    var daily = Math.max(0, Number($('inv-daily').value) || 0);
    var lead = Math.max(0, Number($('inv-lead').value) || 0);
    var safety = Math.max(0, Number($('inv-safety').value) || 0);
    var stock = Math.max(0, Number($('inv-stock').value) || 0);
    var reorderPoint = Math.ceil(daily * (lead + safety));
    var suggested = Math.max(0, reorderPoint - stock);
    var daysLeft = daily > 0 ? Math.floor(stock / daily) : '—';
    $('inv-result').innerHTML =
      '<div class="big">' + reorderPoint + ' units <span class="muted" style="font-size:1rem">reorder point</span></div>' +
      '<div class="row"><span>Suggested order now</span><strong>' + suggested + ' units</strong></div>' +
      '<div class="row"><span>Current stock covers</span><strong>~' + daysLeft + ' days</strong></div>' +
      '<div class="row"><span>Lead-time demand</span><strong>' + Math.ceil(daily * lead) + ' units</strong></div>' +
      '<div class="row"><span>Safety stock</span><strong>' + Math.ceil(daily * safety) + ' units</strong></div>';
    $('inv-result').classList.remove('hidden');
  });

  // ---------- Profit calculator ----------
  $('btn-profit-calc').addEventListener('click', function () {
    var price = Number($('pr-price').value) || 0;
    var cogs = Number($('pr-cogs').value) || 0;
    var ship = Number($('pr-ship').value) || 0;
    var referral = price * ((Number($('pr-referral').value) || 0) / 100);
    var fba = Number($('pr-fba').value) || 0;
    var ads = Number($('pr-ads').value) || 0;
    var totalCost = cogs + ship + referral + fba + ads;
    var profit = price - totalCost;
    var margin = price > 0 ? (profit / price) * 100 : 0;
    var cls = profit >= 0 ? 'positive' : 'negative';
    $('profit-result').innerHTML =
      '<div class="big ' + cls + '">$' + profit.toFixed(2) + ' <span class="muted" style="font-size:1rem">profit / unit (' + margin.toFixed(1) + '%)</span></div>' +
      '<div class="row"><span>Selling price</span><strong>$' + price.toFixed(2) + '</strong></div>' +
      '<div class="row"><span>Unit cost (COGS)</span><strong>−$' + cogs.toFixed(2) + '</strong></div>' +
      '<div class="row"><span>Inbound shipping</span><strong>−$' + ship.toFixed(2) + '</strong></div>' +
      '<div class="row"><span>Referral fee</span><strong>−$' + referral.toFixed(2) + '</strong></div>' +
      '<div class="row"><span>FBA fulfillment fee</span><strong>−$' + fba.toFixed(2) + '</strong></div>' +
      '<div class="row"><span>Ad spend / unit</span><strong>−$' + ads.toFixed(2) + '</strong></div>' +
      '<p class="tiny">Estimates only — verify current Amazon fee schedules in Seller Central before deciding.</p>';
    $('profit-result').classList.remove('hidden');
  });

  // ---------- Claim letter builder ----------
  $('btn-claim-build').addEventListener('click', function () {
    var payload = {
      claimType: $('claim-type').value,
      name: $('claim-name').value,
      asin: $('claim-asin').value,
      shipmentId: $('claim-shipid').value,
      orderId: $('claim-shipid').value,
      date: $('claim-date').value,
      units: $('claim-units').value,
      received: $('claim-received').value,
      value: $('claim-value').value,
      details: $('claim-details').value,
    };
    var box = $('claim-result');
    box.classList.remove('hidden');
    box.innerHTML = '<p class="muted">Building your letter…</p>';
    api('/api/tools/claim', { method: 'POST', body: JSON.stringify(payload) })
      .then(function (d) {
        box.innerHTML =
          '<div class="row"><span>Claim type</span><strong>' + esc(d.label) + '</strong></div>' +
          '<h3 style="margin:1rem 0 0.4rem">Subject line</h3>' +
          '<p><strong>' + esc(d.subject) + '</strong> <button class="btn btn-ghost btn-sm" data-copy="claim-subject">Copy</button></p>' +
          '<h3 style="margin:1rem 0 0.4rem">Letter</h3>' +
          '<p style="white-space:pre-wrap;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:1rem" id="claim-body">' + esc(d.body) + '</p>' +
          '<button class="btn btn-primary" data-copy="claim-body" style="margin-top:0.75rem">Copy letter</button> ' +
          '<span class="tiny">Paste it into a Seller Support case (Seller Central → Help → Get support).</span>' +
          '<span id="claim-subject" class="hidden">' + esc(d.subject) + '</span>';
      })
      .catch(function (err) { box.innerHTML = '<p class="form-error">Error: ' + esc(err.message) + '</p>'; });
  });

  // ---------- Listing builder ----------
  $('btn-listing-gen').addEventListener('click', function () {
    var payload = {
      brand: $('list-brand').value,
      name: $('list-name').value,
      audience: $('list-audience').value,
      features: $('list-features').value,
      keywords: $('list-keywords').value,
    };
    if (!payload.name.trim()) { alert('Please enter your product name first.'); return; }
    var box = $('listing-result');
    box.classList.remove('hidden');
    box.innerHTML = '<p class="muted">Building your listing…</p>';
    api('/api/tools/listing', { method: 'POST', body: JSON.stringify(payload) })
      .then(function (d) {
        var html = '<div class="row"><span>Title length</span><strong>' + d.titleLength + ' / 200 chars</strong></div>' +
          '<h3 style="margin:1rem 0 0.4rem">Title</h3><p><strong>' + esc(d.title) + '</strong></p>' +
          '<button class="btn btn-ghost btn-sm" data-copytext="' + esc(d.title).replace(/"/g, '&quot;') + '">Copy title</button>' +
          '<h3 style="margin:1rem 0 0.4rem">Bullet points</h3><ul>' +
          d.bullets.map(function (b) { return '<li style="margin-bottom:0.5rem">' + esc(b) + '</li>'; }).join('') + '</ul>' +
          '<button class="btn btn-ghost btn-sm" data-copytext="' + esc(d.bullets.map(function (b, i) { return (i + 1) + '. ' + b; }).join('\n')).replace(/"/g, '&quot;') + '">Copy bullets</button>' +
          '<h3 style="margin:1rem 0 0.4rem">Description</h3><p style="white-space:pre-wrap">' + esc(d.description) + '</p>' +
          '<button class="btn btn-ghost btn-sm" data-copytext="' + esc(d.description).replace(/"/g, '&quot;') + '">Copy description</button>' +
          '<h3 style="margin:1rem 0 0.4rem">Backend search terms <span class="tiny">(' + d.backendBytes + ' / 249 bytes)</span></h3>' +
          '<p><code>' + esc(d.backendTerms || '—') + '</code></p>' +
          (d.warnings.length ? '<p class="tiny" style="margin-top:0.75rem">⚠️ ' + d.warnings.map(esc).join('<br>⚠️ ') + '</p>' : '');
        box.innerHTML = html;
      })
      .catch(function (err) { box.innerHTML = '<p class="form-error">Error: ' + esc(err.message) + '</p>'; });
  });
  $('link-listing-ask').addEventListener('click', function (e) {
    e.preventDefault();
    goToChatTab();
    sendChat('Give me listing optimization advice for: ' + $('list-name').value.trim());
  });

  // ---------- Copy buttons (delegated) ----------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy], [data-copytext]');
    if (!btn) return;
    var text = btn.getAttribute('data-copytext');
    if (!text && btn.getAttribute('data-copy')) {
      var el = document.getElementById(btn.getAttribute('data-copy'));
      text = el ? el.textContent : '';
    }
    if (!text) return;
    var done = function () { btn.textContent = 'Copied ✓'; setTimeout(function () { btn.textContent = btn.textContent.replace('Copied ✓', 'Copy'); }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {});
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(ta); done();
    }
  });

  // ---------- Research tools ----------
  document.querySelectorAll('.template[data-tool]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ['budget', 'scorer', 'competitors', 'mistakes'].forEach(function (t) {
        $('tool-' + t).classList.toggle('hidden', t !== btn.getAttribute('data-tool'));
      });
      $('tool-' + btn.getAttribute('data-tool')).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  $('btn-budget-calc').addEventListener('click', function () {
    var cogs = Number($('bd-cogs').value) || 0;
    var qty = Math.max(0, Math.round(Number($('bd-qty').value) || 0));
    var ship = Number($('bd-ship').value) || 0;
    var photo = Number($('bd-photo').value) || 0;
    var samples = Number($('bd-samples').value) || 0;
    var ppc = Number($('bd-ppc').value) || 0;
    var buffer = Number($('bd-buffer').value) || 0;
    var inventory = cogs * qty + ship;
    var subtotal = inventory + photo + samples + ppc;
    var total = subtotal * (1 + buffer / 100);
    $('budget-result').innerHTML =
      '<div class="big">$' + total.toFixed(2) + ' <span class="muted" style="font-size:1rem">total launch budget</span></div>' +
      '<div class="row"><span>Inventory (' + qty + ' units)</span><strong>$' + (cogs * qty).toFixed(2) + '</strong></div>' +
      '<div class="row"><span>Inbound shipping</span><strong>$' + ship.toFixed(2) + '</strong></div>' +
      '<div class="row"><span>Photography</span><strong>$' + photo.toFixed(2) + '</strong></div>' +
      '<div class="row"><span>Samples</span><strong>$' + samples.toFixed(2) + '</strong></div>' +
      '<div class="row"><span>First-month PPC</span><strong>$' + ppc.toFixed(2) + '</strong></div>' +
      '<div class="row"><span>Buffer (' + buffer + '%)</span><strong>$' + (total - subtotal).toFixed(2) + '</strong></div>' +
      '<p class="tiny">Excludes the $39.99/mo Professional seller plan and any trademark/brand registry costs.</p>';
  });

  $('btn-score-calc').addEventListener('click', function () {
    var price = Number($('sc-price').value) || 0;
    var cost = Number($('sc-cost').value) || 0;
    var marginPts = price > 0 ? ((price - cost - price * 0.15 - 5.5) / price) * 100 : 0;
    var score = 0, notes = [];
    if (marginPts >= 30) { score += 3; notes.push('Margin looks healthy (~' + marginPts.toFixed(0) + '% est.).'); }
    else if (marginPts >= 20) { score += 2; notes.push('Margin is workable (~' + marginPts.toFixed(0) + '% est.) — watch fees closely.'); }
    else { score += 0; notes.push('Margin is thin (~' + marginPts.toFixed(0) + '% est.) — risky.'); }
    var size = Number($('sc-size').value);
    score += size;
    notes.push(['Large/heavy hurts FBA fees.', 'Medium size is fine.', 'Small & light keeps fees low.'][size]);
    var comp = Number($('sc-comp').value);
    score += comp;
    notes.push(['Very competitive — needs a real edge.', 'Contested — beatable with a better listing.', 'Soft competition — good sign.'][comp]);
    var diff = Number($('sc-diff').value);
    score += diff;
    notes.push(['No differentiation is the riskiest bet.', 'A better listing can win a soft market.', 'A real improvement is your moat.'][diff]);
    var repeat = Number($('sc-repeat').value);
    score += repeat;
    if (repeat) notes.push('Repeat purchases = compounding revenue.');
    var verdict = score >= 8 ? ['Strong idea', 'positive'] : score >= 5 ? ['Worth testing', ''] : ['Risky', 'negative'];
    $('score-result').innerHTML =
      '<div class="big ' + verdict[1] + '">' + score + ' / 10 <span class="muted" style="font-size:1rem">' + verdict[0] + '</span></div>' +
      '<ul>' + notes.map(function (n) { return '<li style="margin-bottom:0.4rem">' + esc(n) + '</li>'; }).join('') + '</ul>' +
      '<p class="tiny">Estimate only — margin uses ~15% referral + $5.50 FBA fee. Verify real fees in Seller Central.</p>';
  });

  var COMPETITOR_ITEMS = [
    ['Review count', 'Under 500 on page one = soft. Over 5,000 each = fortress.'],
    ['Listing quality', 'Bad photos and thin bullets mean you can out-execute them.'],
    ['Price cluster', 'Where do winners price? That\'s the market\'s verdict on value.'],
    ['BSR', 'Lower Best Sellers Rank = selling more. Compare across competitors.'],
    ['Differentiation gap', 'Is there a real improvement you could make?'],
    ['Red flags', 'Big brands, patents, 10k+ reviews at 4.8 stars — walk away.'],
  ];
  (function renderComp() {
    var box = $('competitor-checklist');
    COMPETITOR_ITEMS.forEach(function (item) {
      var label = document.createElement('label');
      label.className = 'check-item';
      label.innerHTML = '<input type="checkbox"><span><strong>' + esc(item[0]) + '</strong><small>' + esc(item[1]) + '</small></span>';
      box.appendChild(label);
    });
  })();

  // ---------- Boot ----------
  loadPrice();
  api('/api/auth/me').then(function (d) {
    var onApp = window.location.pathname.indexOf('/app') === 0;
    var params = new URLSearchParams(window.location.search);
    if (d.user) {
      enterApp(d.user);
      if (params.get('upgraded') === '1') {
        var sid = params.get('session_id');
        history.replaceState({}, '', '/app');
        if (sid) {
          api('/api/billing/verify-session?session_id=' + encodeURIComponent(sid)).then(function (v) {
            if (v.user) { state.user = v.user; renderApp(); }
            setTimeout(function () { alert('Welcome to Premium! Your tools are unlocked.'); }, 400);
          }).catch(function () {
            setTimeout(function () { alert('Payment received! Your Premium status will activate shortly.'); }, 400);
          });
        } else {
          setTimeout(function () { alert('Welcome to Premium! Your tools are unlocked.'); }, 400);
        }
      } else if (params.get('canceled') === '1') {
        setTimeout(function () { alert('Checkout was canceled — no charge was made.'); }, 400);
        history.replaceState({}, '', '/app');
      }
      // Refresh user in case Stripe webhook already updated the subscription.
      api('/api/auth/me').then(function (d2) { if (d2.user) { state.user = d2.user; renderApp(); } }).catch(function () {});
    } else if (onApp) {
      showAuth('signup');
    } else {
      show('view-landing');
    }
  }).catch(function () {
    show('view-landing');
  });
})();
