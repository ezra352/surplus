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
        addMsg('ai', 'Hi! I\'m your AI seller copilot. Ask me about reimbursements, listings, product research, profit math, inventory, or PPC — or pick a tool above.');
      }
    }
  }

  function refreshUsage() {
    api('/api/chat/limit').then(function (d) {
      var pill = $('usage-pill');
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

  // ---------- Listing generator → copilot ----------
  $('btn-listing-gen').addEventListener('click', function () {
    var name = $('list-name').value.trim();
    var feats = $('list-features').value.trim();
    var kws = $('list-keywords').value.trim();
    if (!name) { alert('Please enter your product name first.'); return; }
    var prompt = 'Write an optimized Amazon listing for this product.\n\nProduct: ' + name +
      (feats ? '\nKey features:\n' + feats : '') +
      (kws ? '\nTarget keywords: ' + kws : '') +
      '\n\nGive me: 1) an optimized title (under 200 characters), 2) five bullet points, 3) a product description, 4) backend search terms. Follow Amazon listing policy.';
    goToChatTab();
    sendChat(prompt);
  });

  // ---------- Research templates → copilot ----------
  document.querySelectorAll('.template').forEach(function (btn) {
    btn.addEventListener('click', function () {
      goToChatTab();
      sendChat(btn.getAttribute('data-prompt'));
    });
  });

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
