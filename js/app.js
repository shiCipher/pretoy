/* Pretoy v2 customer app: router, layout and buyer/seller/renter views. */
(function () {
  'use strict';
  const UI = window.PretoyUI, S = window.Store, R = S.RULES;
  const { esc, inr, $, $$ } = UI;
  const App = { views: {}, actions: {}, forms: {} };
  window.PretoyApp = App;

  /* ---------------- routing ---------------- */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '') || '';
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const q = {}; new URLSearchParams(qs || '').forEach((v, k) => { q[k] = v; });
    return { name: parts[0] || 'home', args: parts.slice(1), q };
  }
  App.go = (h) => { if (location.hash === h) App.render(); else location.hash = h; };
  App.requireLogin = (msg) => { if (S.currentUser()) return true; UI.toast(msg || 'Please log in to continue.'); App.go('#/login?next=' + encodeURIComponent(location.hash || '#/')); return false; };
  App.render = () => {
    const route = parseHash();
    const user = S.currentUser();
    const isAdmin = route.name === 'admin';
    if (isAdmin && (!user || user.role !== 'admin')) { UI.toast('Admin access only. Log in with the admin demo account.', 'error'); location.hash = '#/login?next=%23%2Fadmin'; return; }
    const view = isAdmin ? window.PretoyAdmin.render : (App.views[route.name] || App.views.notfound);
    document.body.classList.toggle('is-admin', isAdmin);
    $('#header').innerHTML = header(user, route);
    let html; try { html = view(route, user); } catch (e) { console.error(e); html = `<section class="wrap pad"><h2>Something went wrong</h2><p class="muted">${esc(e.message)}</p></section>`; }
    $('#main').innerHTML = html;
    $('#footer').innerHTML = isAdmin ? '' : footer();
    if (App.after) { const f = App.after; App.after = null; f(); }
    if (!App._keepScroll) window.scrollTo(0, 0); App._keepScroll = false;
    document.title = (App.title || 'Pretoy') + ' · Pretoy'; App.title = '';
  };
  App.rerender = () => { App._keepScroll = true; App.render(); };

  /* ---------------- layout ---------------- */
  function header(user, route) {
    const cartN = S.cart().length;
    const unread = user ? S.db.notifications.filter(n => (n.userId === user.id || (user.role === 'admin' && n.userId === 'admin')) && !n.read).length : 0;
    const nav = [['shop', 'Shop'], ['sell', 'Sell'], ['rent', 'Rent'], ['business', 'For Business'], ['how', 'How it works']];
    return `<div class="topbar">
      <a class="brand" href="#/" aria-label="Pretoy home"><img class="logo" src="img/pretoy-logo.png" alt="Pretoy"></a>
      <nav class="mainnav" id="mainnav">${nav.map(([k, l]) => `<a href="#/${k}" class="${route.name === k ? 'on' : ''}">${l}</a>`).join('')}
        ${user && user.role === 'admin' ? `<a href="#/admin" class="adminlink ${route.name === 'admin' ? 'on' : ''}">Admin desk</a>` : ''}</nav>
      <form class="hsearch" data-form="hsearch" role="search"><input name="q" placeholder="Search toys, brands…" aria-label="Search toys" value="${esc(route.name === 'shop' ? route.q.q || '' : '')}"></form>
      <div class="icons">
        <a href="#/wishlist" class="ico" title="Wishlist" aria-label="Wishlist">♡</a>
        ${user ? `<a href="#/notifications" class="ico" title="Notifications" aria-label="Notifications">🔔${unread ? `<b class="dot">${unread}</b>` : ''}</a>` : ''}
        <a href="#/cart" class="ico" title="Cart" aria-label="Cart">🛒${cartN ? `<b class="dot">${cartN}</b>` : ''}</a>
        ${user ? `<div class="acct"><button class="avatar" data-act="toggle-menu" aria-label="Account menu">${esc(user.name.charAt(0))}</button>
          <div class="menu" id="acctmenu"><div class="menu-head"><b>${esc(user.name)}</b><small>${esc(user.email)}</small></div>
          ${user.role === 'admin' ? '<a href="#/admin">Admin desk</a>' : ''}<a href="#/orders">My orders</a><a href="#/my-sales">My sales & listings</a><a href="#/rent">My rental box</a><a href="#/wishlist">Wishlist</a><a href="#/account">Account & privacy</a><button data-act="logout">Log out</button></div></div>`
          : `<a href="#/login" class="btn sm dark">Log in</a>`}
        <button class="burger" data-act="burger" aria-label="Menu">☰</button>
      </div></div>`;
  }
  function footer() {
    return `<div class="wrap foot"><div><a class="brand footlogo" href="#/" aria-label="Pretoy home"><img src="img/pretoy-logo.png" alt="Pretoy"></a><p>Premium toys, second childhood. Certified pre-loved toys, delivered across India.</p></div>
      <div><h4>Shop</h4><a href="#/shop">All toys</a><a href="#/shop?src=certified">Pretoy Certified</a><a href="#/shop?src=p2p">Community listings</a><a href="#/rent">Toy rental</a></div>
      <div><h4>Sell</h4><a href="#/sell">Instant valuation</a><a href="#/list">List it yourself</a><a href="#/my-sales">Track a pickup</a><a href="#/business">Bulk & CSR</a></div>
      <div><h4>Trust</h4><a href="#/verify">Verify a certificate</a><a href="#/how">Quality Seal</a><a href="#/privacy">Privacy notice (DPDP)</a><a href="#/terms">Terms & returns</a></div></div>
      <div class="wrap legal"><span>© ${new Date().getFullYear()} Pretoy · Proof-of-concept · All payments run in test mode, no money moves.</span><span>Grievance Officer: grievance@pretoy.in</span></div>`;
  }

  /* ---------------- product card ---------------- */
  function card(p) {
    const user = S.currentUser(); const fav = user && user.wishlist.includes(p.id);
    return `<article class="card"><a href="#/toy/${p.id}" class="card-link" aria-label="${esc(p.name)}">${UI.art(p)}</a>
      <button class="fav ${fav ? 'on' : ''}" data-act="fav" data-id="${p.id}" aria-label="Save to wishlist">${fav ? '♥' : '♡'}</button>
      <div class="tags">${p.source === 'p2p' ? '<span class="badge p2p">Community</span>' : `<span class="badge seal">✓ Quality Seal</span>`}${p.rentable ? '<span class="badge rent">Rentable</span>' : ''}</div>
      <div class="card-body"><small>${esc(p.brand)} · ${esc(p.age)}</small><h3><a href="#/toy/${p.id}">${esc(p.name)}</a></h3>
        <div class="price"><b>${inr(p.price)}</b>${p.mrp ? `<del>${inr(p.mrp)}</del><em>${UI.off(p.mrp, p.price)}% off</em>` : ''}</div>
        <div class="card-foot">${p.grade ? `<span class="g g-${p.grade}">Grade ${p.grade}</span>` : `<span class="g g-p">${esc(p.condition || 'Seller described')}</span>`}
        <button class="btn sm dark" data-act="add-cart" data-id="${p.id}">Add to cart</button></div></div></article>`;
  }
  App.card = card;
  const live = () => S.db.products.filter(p => p.status === 'live');

  /* ---------------- HOME ---------------- */
  App.views.home = () => {
    const p = live(); const certified = p.filter(x => x.source === 'certified');
    const sold = S.db.orders.reduce((a, o) => a + o.items.length, 0) + 1240;
    App.title = 'Certified pre-loved toys';
    return `<section class="hero"><div class="wrap hero-grid"><div>
      <p class="eyebrow">Premium toys, second childhood</p><h1>Good toys deserve <em>more play.</em></h1>
      <p class="lead">Premium pre-loved toys, inspected on 5 points, deep-cleaned and certified with the Pretoy Quality Seal. Up to 70% below MRP, with 15-day easy returns.</p>
      <div class="row gap wrapit"><a class="btn dark lg" href="#/shop">Shop certified toys</a><a class="btn light lg" href="#/sell">Get an instant valuation</a></div>
      <div class="trust"><span>🛡️ 5-point Quality Seal</span><span>↩︎ 15-day returns</span><span>🚚 Free home pickup</span><span>🎁 Gift-ready boxes</span></div></div>
      <div class="hero-art"><div class="sun"></div><div class="hero-card"><img src="img/pretoy-mark.png" alt="" class="heromark"><b>LOVED BEFORE.<br>READY AGAIN.</b><small class="sealchip">✓ PTY QUALITY SEAL</small></div><div class="float f1">♻</div><div class="float f2">✳</div><div class="float f3">🪀</div></div></div></section>
    <section class="wrap pad"><div class="impact">
      <div><b>${sold.toLocaleString('en-IN')}+</b><span>toys rehomed</span></div><div><b>${(sold * 0.42).toFixed(0)} kg</b><span>plastic kept from landfill</span></div>
      <div><b>${inr(sold * 1150)}</b><span>saved by parents</span></div><div><b>4.8 ★</b><span>average rating</span></div></div></section>
    <section class="wrap pad"><div class="sec-head"><div><p class="eyebrow">Shop by category</p><h2>Find their next favourite</h2></div><a href="#/shop" class="link">See all toys →</a></div>
      <div class="cats">${R.categories.map(c => { const n = p.filter(x => x.category === c).length; const e = { Building: '🧱', Vehicles: '🚗', Learning: '🔤', Puzzles: '🧩', 'Soft Toys': '🧸', 'Pretend Play': '🍳', Figures: '🦖', Musical: '🎵', Books: '📚', Outdoor: '⚽', Creative: '🎨', 'Baby & Toddler': '🍼' }[c];
        return `<a class="cat" href="#/shop?cat=${encodeURIComponent(c)}"><span>${e}</span><b>${c}</b><small>${n} toys</small></a>`; }).join('')}</div></section>
    <section class="wrap pad"><div class="sec-head"><div><p class="eyebrow">Fresh from the workshop</p><h2>Just certified</h2></div><a href="#/shop?sort=new" class="link">See all →</a></div>
      <div class="grid">${certified.slice(0, 8).map(card).join('')}</div></section>
    <section class="band"><div class="wrap pad split"><div><p class="eyebrow">The Pretoy Quality Seal</p><h2>Five checks. Every single toy.</h2>
      <p class="lead">Each certified toy gets a public certificate you can verify. Scan it, share it, trust it.</p><a href="#/verify" class="btn light">Verify a certificate</a></div>
      <div class="sealgrid">${R.seal.map(s => `<div><span>${s.icon}</span><b>${s.name}</b><small>${s.desc}</small></div>`).join('')}</div></div></section>
    <section class="wrap pad"><div class="three">
      <a class="promo" href="#/sell" style="--c:#e9eee5"><span>💸</span><h3>Sell to Pretoy</h3><p>Instant valuation of 20–35% of MRP, free home pickup, payout by UPI or +10% as store credit.</p><b>Value my toy →</b></a>
      <a class="promo" href="#/list" style="--c:#f6e7dc"><span>🤝</span><h3>List it yourself</h3><p>Set your own price on the community marketplace. We only take 10–15% when it sells.</p><b>Create a listing →</b></a>
      <a class="promo" href="#/rent" style="--c:#e6e3f2"><span>📦</span><h3>Rent a toy box</h3><p>From ₹499 a month: fresh, sanitised toys at your door, swap whenever they get bored.</p><b>See plans →</b></a></div></section>
    <section class="wrap pad"><div class="sec-head"><div><p class="eyebrow">From the community</p><h2>Parent-to-parent finds</h2></div><a href="#/shop?src=p2p" class="link">Browse community →</a></div>
      <div class="grid">${p.filter(x => x.source === 'p2p').slice(0, 4).map(card).join('')}</div></section>
    <section class="wrap pad"><div class="cta"><div><h2>Gifting for a team, school or CSR drive?</h2><p>Bulk bundles of certified toys with impact reporting.</p></div><a href="#/business" class="btn light lg">Explore business bundles</a></div></section>`;
  };

  /* ---------------- SHOP ---------------- */
  App.views.shop = (route) => {
    const q = route.q; App.title = 'Shop';
    let items = live();
    const term = (q.q || '').toLowerCase();
    if (term) items = items.filter(p => `${p.name} ${p.brand} ${p.category} ${p.description}`.toLowerCase().includes(term));
    if (q.cat) items = items.filter(p => p.category === q.cat);
    if (q.age) items = items.filter(p => p.age === q.age);
    if (q.grade) items = items.filter(p => p.grade === q.grade);
    if (q.src) items = items.filter(p => p.source === q.src);
    if (q.rent === '1') items = items.filter(p => p.rentable);
    if (q.max) items = items.filter(p => p.price <= Number(q.max));
    const sort = q.sort || 'pop';
    items.sort({ pop: (a, b) => b.views - a.views, new: (a, b) => b.createdAt.localeCompare(a.createdAt), low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, off: (a, b) => UI.off(b.mrp, b.price) - UI.off(a.mrp, a.price) }[sort] || (() => 0));
    const sel = (name, opts, label) => `<label>${label}<select name="${name}" data-act-change="filter"><option value="">All</option>${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${q[name] === v ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select></label>`;
    return `<section class="wrap pad"><div class="sec-head"><div><p class="eyebrow">The Pretoy edit</p><h2>${q.cat ? esc(q.cat) : term ? 'Results for “' + esc(q.q) + '”' : 'All toys'}</h2><p class="muted">${items.length} toys available</p></div></div>
      <div class="shop"><aside class="filters" id="filters"><form data-form="filters">
        <label>Search<input name="q" value="${esc(q.q || '')}" placeholder="e.g. LEGO"></label>
        ${sel('cat', R.categories, 'Category')}${sel('age', R.ages, 'Age')}
        ${sel('grade', [['A', 'A · Like New'], ['B', 'B · Gently Loved'], ['C', 'C · Well Played']], 'Quality grade')}
        ${sel('src', [['certified', 'Pretoy Certified'], ['p2p', 'Community (P2P)']], 'Sold by')}
        <label>Max price: <b id="maxv">${q.max ? inr(q.max) : 'any'}</b><input type="range" name="max" min="200" max="4000" step="100" value="${q.max || 4000}" data-act-change="filter"></label>
        <label class="check"><input type="checkbox" name="rent" ${q.rent === '1' ? 'checked' : ''} data-act-change="filter"> Available to rent</label>
        <div class="row gap"><button class="btn dark sm">Apply</button><a href="#/shop" class="btn ghost sm">Clear</a></div></form></aside>
      <div><div class="row between toolbar"><button class="btn ghost sm only-m" data-act="toggle-filters">Filters</button>
        <div class="chips">${['All', ...R.categories.slice(0, 7)].map(c => `<a class="chip ${(c === 'All' && !q.cat) || q.cat === c ? 'on' : ''}" href="#/shop${c === 'All' ? '' : '?cat=' + encodeURIComponent(c)}">${c}</a>`).join('')}</div>
        <label class="sortby">Sort <select data-act-change="sort">${[['pop', 'Popular'], ['new', 'Newest'], ['low', 'Price: low to high'], ['high', 'Price: high to low'], ['off', 'Biggest discount']].map(([v, l]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      ${items.length ? `<div class="grid">${items.map(card).join('')}</div>` : `<div class="empty"><span>🔍</span><h3>No toys match yet</h3><p>Try clearing a filter, or <a href="#/sell">sell us a toy like this</a>.</p></div>`}</div></div></section>`;
  };

  /* ---------------- TOY DETAIL ---------------- */
  App.views.toy = (route, user) => {
    const p = S.product(route.args[0]);
    if (!p || (p.status !== 'live' && !(user && (user.role === 'admin' || user.id === p.sellerId)))) return `<section class="wrap pad"><div class="empty"><span>🧸</span><h3>This toy has found a new home</h3><p><a href="#/shop">Browse similar toys</a></p></div></section>`;
    p.views = (p.views || 0) + 1; S.save(); App.title = p.name;
    const fav = user && user.wishlist.includes(p.id);
    const reviews = S.db.reviews.filter(r => r.productId === p.id);
    const similar = live().filter(x => x.id !== p.id && x.category === p.category).slice(0, 4);
    const comm = p.source === 'p2p';
    const sealBlock = p.seal ? `<div class="sealbox"><div class="row between"><h3>🛡️ Pretoy Quality Seal</h3><a href="#/certificate/${p.certCode}" class="link">View certificate ${esc(p.certCode)} →</a></div>
      ${R.seal.map(s => `<div class="sealrow"><span>${s.icon} ${s.name}</span><div class="bar"><i style="width:${p.seal[s.key] * 20}%"></i></div><b>${p.seal[s.key]}/5</b></div>`).join('')}
      <small class="muted">Inspected by ${esc(p.inspector)} on ${UI.date(p.inspectedAt)}. ${esc(p.seal.notes || '')}</small></div>`
      : `<div class="sealbox p2pbox"><h3>🤝 Community listing</h3><p>Listed by <b>${esc(S.sellerName(p.sellerId))}</b>. Condition is described by the seller: <b>${esc(p.condition || '')}</b>.</p>
      <p class="muted">Pretoy Buyer Protection covers this order: if the toy isn't as described, return it within ${R.returnDays} days for a full refund.</p></div>`;
    return `<section class="wrap pad"><nav class="crumbs"><a href="#/shop">Shop</a> / <a href="#/shop?cat=${encodeURIComponent(p.category)}">${esc(p.category)}</a> / <span>${esc(p.name)}</span></nav>
      <div class="pdp"><div class="gallery">${UI.art(p, 'big')}${p.images.length > 1 ? `<div class="thumbs">${p.images.map((im, i) => `<img src="${im}" alt="photo ${i + 1}" data-act="thumb" data-src="${i}">`).join('')}</div>` : ''}</div>
      <div class="pinfo"><div class="tags">${comm ? '<span class="badge p2p">Community listing</span>' : '<span class="badge seal">✓ Pretoy Certified</span>'} ${UI.gradeBadge(p.grade)} ${p.rentable ? '<span class="badge rent">Also available to rent</span>' : ''}</div>
        <h1 class="ptitle">${esc(p.name)}</h1><p class="muted">${esc(p.brand)} · ${esc(p.category)} · Ages ${esc(p.age)}</p>
        <div class="bigprice"><b>${inr(p.price)}</b>${p.mrp ? `<del>MRP ${inr(p.mrp)}</del><em>You save ${inr(p.mrp - p.price)} (${UI.off(p.mrp, p.price)}%)</em>` : ''}</div>
        <p>${esc(p.description)}</p>
        ${p.status === 'live' ? `<div class="row gap wrapit"><button class="btn dark lg" data-act="add-cart" data-id="${p.id}">Add to cart</button><button class="btn terra lg" data-act="buy-now" data-id="${p.id}">Buy now</button>
        <button class="btn ghost lg" data-act="fav" data-id="${p.id}">${fav ? '♥ Saved' : '♡ Save'}</button></div>` : `<p class="note">Status: ${UI.statusPill(p.status)}</p>`}
        <ul class="perks"><li>↩︎ ${R.returnDays}-day easy returns</li><li>🎁 Add a gift box from ₹99 at checkout</li><li>🚚 Free delivery above ${inr(R.freeShippingAbove)}</li><li>♻ One-of-a-kind: only 1 in stock</li></ul>
        ${sealBlock}</div></div>
      <div class="reviews"><h3>Reviews ${reviews.length ? `<small>${(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)} ★</small>` : ''}</h3>
        ${reviews.length ? reviews.map(r => `<div class="review"><b>${UI.stars(r.rating)}</b> <span>${esc(r.name)}</span><p>${esc(r.text)}</p></div>`).join('') : `<p class="muted">Each toy is one of a kind. Reviews from buyers of this toy appear here after delivery.</p>`}</div>
      ${similar.length ? `<h3 class="mt">You may also like</h3><div class="grid">${similar.map(card).join('')}</div>` : ''}</section>`;
  };

  /* ---------------- CERTIFICATE + VERIFY ---------------- */
  App.views.certificate = (route) => {
    const code = decodeURIComponent(route.args[0] || '');
    const p = S.db.products.find(x => x.certCode && x.certCode.toUpperCase() === code.toUpperCase());
    App.title = 'Certificate ' + code;
    if (!p) return `<section class="wrap pad narrow"><div class="empty"><span>⚠️</span><h3>Certificate “${esc(code)}” not found</h3><p>Check the code on the toy's tag and try again.</p><a href="#/verify" class="btn dark">Verify another</a></div></section>`;
    return `<section class="wrap pad narrow"><div class="cert" id="cert"><div class="cert-head"><img class="certlogo" src="img/pretoy-logo.png" alt="Pretoy"><div class="stamp">✓ VERIFIED</div></div>
      <p class="eyebrow">Certificate of Quality</p><h2>${esc(p.name)}</h2><p class="muted">${esc(p.brand)} · ${esc(p.category)} · Ages ${esc(p.age)}</p>
      <div class="cert-meta"><div><small>Certificate no.</small><b>${esc(p.certCode)}</b></div><div><small>Grade</small><b>${p.grade} · ${R.gradeLabels[p.grade]}</b></div><div><small>Inspected</small><b>${UI.date(p.inspectedAt)}</b></div><div><small>Inspector</small><b>${esc(p.inspector)}</b></div></div>
      <table class="cert-table"><thead><tr><th>Check</th><th>What we verified</th><th>Score</th><th>Result</th></tr></thead><tbody>
      ${R.seal.map(s => `<tr><td>${s.icon} <b>${s.name}</b></td><td>${s.desc}</td><td>${p.seal[s.key]}/5</td><td class="pass">✓ Pass</td></tr>`).join('')}</tbody></table>
      <p><b>Inspector notes:</b> ${esc(p.seal.notes || '—')}</p>
      <p class="muted small">This certificate confirms the toy passed Pretoy's 5-point inspection on the date shown. Verify at pretoy.in/verify with the certificate number. Grade scale: A ≥ 4.5 average, B ≥ 3.6, C below; Safety and Hygiene must score 3 or more to pass.</p></div>
      <div class="row gap center mt"><button class="btn dark" data-act="print">Print / save as PDF</button>${p.status === 'live' ? `<a class="btn ghost" href="#/toy/${p.id}">View toy</a>` : ''}</div></section>`;
  };
  App.views.verify = () => { App.title = 'Verify a certificate'; const ex = live().find(p => p.certCode);
    return `<section class="wrap pad narrow center-text"><p class="eyebrow">Trust, verified</p><h2>Verify a Quality Seal certificate</h2><p class="muted">Enter the code printed on the toy's tag or box.</p>
      <form class="row gap center mt" data-form="verify"><input name="code" placeholder="e.g. ${ex ? esc(ex.certCode) : 'PTY-24000-A'}" required class="wide-in"><button class="btn dark">Verify</button></form>
      ${ex ? `<p class="small muted mt">Try the demo certificate <a href="#/certificate/${ex.certCode}">${esc(ex.certCode)}</a></p>` : ''}</section>`; };

  /* ---------------- CART + CHECKOUT ---------------- */
  function cartItems() { return S.cart().map(id => S.product(id)).filter(p => p && p.status === 'live'); }
  function totals(items, giftId, coupon) {
    const subtotal = items.reduce((a, p) => a + p.price, 0);
    const gift = R.gift.find(g => g.id === giftId) || R.gift[0];
    const shipping = subtotal === 0 || subtotal >= R.freeShippingAbove ? 0 : R.shippingFee;
    let discount = 0, couponMsg = '';
    const c = coupon && R.coupons[coupon.toUpperCase()];
    if (coupon && !c) couponMsg = 'That code is not valid.';
    else if (c) { if (c.min && subtotal < c.min) couponMsg = `Needs a subtotal of ${inr(c.min)} or more.`; else { discount = c.pct ? Math.round(subtotal * c.pct / 100) : Math.min(c.flat, subtotal); couponMsg = '✓ ' + c.desc; } }
    const u = S.currentUser(); const credit = App.checkout.useCredit && u ? Math.min(u.storeCredit || 0, subtotal + shipping + gift.price - discount) : 0;
    return { subtotal, gift, shipping, discount, couponMsg, credit, total: Math.max(0, subtotal + shipping + gift.price - discount - credit) };
  }
  App.checkout = { gift: 'none', note: '', coupon: '', useCredit: false };
  App.views.cart = (route, user) => {
    App.title = 'Your cart'; const items = cartItems(); const ck = App.checkout; const t = totals(items, ck.gift, ck.coupon);
    if (!items.length) return `<section class="wrap pad"><div class="empty"><span>🛒</span><h3>Your cart is empty</h3><p>Every Pretoy toy is one of a kind, so grab favourites before they're gone.</p><a href="#/shop" class="btn dark">Start shopping</a></div></section>`;
    return `<section class="wrap pad"><h2>Your cart</h2><div class="checkout"><div>
      ${items.map(p => `<div class="line">${UI.art(p, 'sm')}<div class="grow"><a href="#/toy/${p.id}"><b>${esc(p.name)}</b></a><small>${p.source === 'p2p' ? 'Community listing · ' + esc(S.sellerName(p.sellerId)) : 'Pretoy Certified · Grade ' + p.grade}</small></div><b>${inr(p.price)}</b><button class="x" data-act="rm-cart" data-id="${p.id}" aria-label="Remove">×</button></div>`).join('')}
      <div class="panel mt"><h3>🎁 Make it a gift</h3><div class="gifts">${R.gift.map(g => `<label class="giftopt ${ck.gift === g.id ? 'on' : ''}"><input type="radio" name="gift" value="${g.id}" ${ck.gift === g.id ? 'checked' : ''} data-act-change="gift"><b>${g.name}</b><span>${g.price ? inr(g.price) : 'Free'}</span><small>${g.desc}</small></label>`).join('')}</div>
        ${ck.gift !== 'none' ? `<label class="mt">Gift message (printed on the card)<textarea maxlength="200" data-act-change="giftnote" placeholder="Happy birthday! Love, …">${esc(ck.note)}</textarea></label><p class="small muted">Prices are hidden on the packing slip for gift orders.</p>` : ''}</div></div>
      <aside class="panel summary"><h3>Order summary</h3>
        <div class="sumrow"><span>Subtotal (${items.length} ${items.length > 1 ? 'toys' : 'toy'})</span><b>${inr(t.subtotal)}</b></div>
        <div class="sumrow"><span>Delivery</span><b>${t.shipping ? inr(t.shipping) : 'Free'}</b></div>
        ${t.gift.price ? `<div class="sumrow"><span>${t.gift.name}</span><b>${inr(t.gift.price)}</b></div>` : ''}
        ${t.discount ? `<div class="sumrow good"><span>Coupon ${esc(ck.coupon.toUpperCase())}</span><b>−${inr(t.discount)}</b></div>` : ''}
        ${user && user.storeCredit ? `<label class="check"><input type="checkbox" data-act-change="credit" ${ck.useCredit ? 'checked' : ''}> Use store credit (${inr(user.storeCredit)} available)</label>` : ''}
        ${t.credit ? `<div class="sumrow good"><span>Store credit</span><b>−${inr(t.credit)}</b></div>` : ''}
        <form class="row gap coupon" data-form="coupon"><input name="code" placeholder="Coupon code" value="${esc(ck.coupon)}"><button class="btn ghost sm">Apply</button></form>
        ${t.couponMsg ? `<p class="small ${t.discount ? 'good' : 'bad'}">${esc(t.couponMsg)}</p>` : '<p class="small muted">Try FIRSTPLAY10, CIRCULAR15 or GIFT99</p>'}
        <div class="sumrow total"><span>Total</span><b>${inr(t.total)}</b></div>
        ${t.subtotal < R.freeShippingAbove ? `<p class="small muted">Add ${inr(R.freeShippingAbove - t.subtotal)} more for free delivery.</p>` : ''}
        <button class="btn dark lg full" data-act="to-checkout">Proceed to checkout</button><p class="small muted center-text">🔒 Test-mode payments. No real money is charged.</p></aside></div></section>`;
  };
  App.views.checkout = (route, user) => {
    if (!App.requireLogin('Log in or create an account to check out.')) return '';
    const items = cartItems(); if (!items.length) { setTimeout(() => App.go('#/cart')); return ''; }
    App.title = 'Checkout'; const t = totals(items, App.checkout.gift, App.checkout.coupon); const a = user.addresses[0] || {};
    return `<section class="wrap pad"><h2>Checkout</h2><form class="checkout" data-form="place-order"><div>
      <div class="panel"><h3>1. Delivery address</h3>
        ${user.addresses.length ? user.addresses.map((ad, i) => `<label class="addr"><input type="radio" name="addr" value="${ad.id}" ${i === 0 ? 'checked' : ''}> <b>${esc(ad.label)}</b> ${esc(ad.line)}, ${esc(ad.city)} ${esc(ad.pin)}</label>`).join('') + `<label class="addr"><input type="radio" name="addr" value="new"> Use a new address</label>` : '<input type="hidden" name="addr" value="new">'}
        <div class="form-grid ${user.addresses.length ? 'newaddr' : ''}"><label class="wide">Address<input name="line" placeholder="House, street, area" ${user.addresses.length ? '' : 'required'}></label>
          <label>City<input name="city" value="${esc(a.city || '')}"></label><label>PIN code<input name="pin" pattern="[0-9]{6}" placeholder="560001"></label>
          <label>Phone<input name="phone" value="${esc(user.phone)}" required pattern="[0-9]{10}" title="10-digit mobile number"></label><label class="check"><input type="checkbox" name="saveaddr" checked> Save this address</label></div></div>
      <div class="panel mt"><h3>2. Payment <span class="pill st-test">Test mode</span></h3>
        <div class="paytabs">${[['upi', 'UPI'], ['card', 'Card'], ['cod', 'Cash on delivery']].map(([v, l], i) => `<label class="payopt"><input type="radio" name="pay" value="${v}" ${i === 0 ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        <p class="small muted">UPI: any ID like <code>name@okaxis</code> succeeds, <code>fail@upi</code> simulates a failure. Card: <code>4242 4242 4242 4242</code> succeeds, <code>4000 0000 0000 0002</code> is declined.</p></div>
      <div class="panel mt"><h3>3. Review</h3>${items.map(p => `<div class="line slim">${UI.art(p, 'xs')}<span class="grow">${esc(p.name)}</span><b>${inr(p.price)}</b></div>`).join('')}
        ${App.checkout.gift !== 'none' ? `<p class="small">🎁 ${esc(t.gift.name)}${App.checkout.note ? ': “' + esc(App.checkout.note) + '”' : ''}</p>` : ''}</div></div>
      <aside class="panel summary"><h3>Pay ${inr(t.total)}</h3>
        <div class="sumrow"><span>Subtotal</span><b>${inr(t.subtotal)}</b></div><div class="sumrow"><span>Delivery</span><b>${t.shipping ? inr(t.shipping) : 'Free'}</b></div>
        ${t.gift.price ? `<div class="sumrow"><span>Gift box</span><b>${inr(t.gift.price)}</b></div>` : ''}${t.discount ? `<div class="sumrow good"><span>Discount</span><b>−${inr(t.discount)}</b></div>` : ''}${t.credit ? `<div class="sumrow good"><span>Store credit</span><b>−${inr(t.credit)}</b></div>` : ''}
        <div class="sumrow total"><span>Total</span><b>${inr(t.total)}</b></div>
        <label class="check small"><input type="checkbox" name="agree" required> I agree to the <a href="#/terms">Terms</a>, including the ${R.returnDays}-day return policy.</label>
        <button class="btn dark lg full">Place order</button><a href="#/cart" class="btn ghost full mt">Back to cart</a></aside></form></section>`;
  };

  /* simulated payment gateway */
  App.pay = (amount, method, label) => new Promise((resolve, reject) => {
    if (method === 'cod' || amount === 0) return resolve({ method: method === 'cod' ? 'Cash on delivery' : 'Store credit', ref: 'TEST-' + (method === 'cod' ? 'COD' : 'CREDIT') + '-' + Date.now().toString().slice(-6), status: method === 'cod' ? 'DUE_ON_DELIVERY' : 'PAID' });
    const m = UI.modal(`<div class="paygate"><div class="row between"><b>🔒 PretoyPay <span class="pill st-test">TEST MODE</span></b><span>${inr(amount)}</span></div><p class="small muted">${esc(label)}</p>
      <form id="payf">${method === 'upi' ? `<label>UPI ID<input name="v" placeholder="name@okaxis" required pattern="[^@\\s]+@[^@\\s]+"></label>` :
        `<label>Card number<input name="v" placeholder="4242 4242 4242 4242" required inputmode="numeric"></label><div class="form-grid"><label>Expiry<input placeholder="12/29" required></label><label>CVV<input placeholder="123" required maxlength="4"></label></div>`}
      <button class="btn dark full lg">Pay ${inr(amount)}</button><p class="small muted center-text">No real payment is made. This screen simulates a gateway such as Razorpay in test mode.</p></form><div id="payproc" hidden class="center-text"><div class="spinner"></div><p>Processing payment…</p></div></div>`);
    m.querySelector('#payf').onsubmit = e => { e.preventDefault(); const v = e.target.v.value.replace(/\s/g, '').toLowerCase();
      e.target.hidden = true; m.querySelector('#payproc').hidden = false;
      setTimeout(() => { UI.closeModal(); if (v === 'fail@upi' || v === '4000000000000002') reject(new Error(method === 'upi' ? 'UPI payment failed (test failure ID).' : 'Card declined by issuing bank (test card).'));
        else resolve({ method: method === 'upi' ? 'UPI' : 'Card', ref: 'TEST-' + method.toUpperCase() + '-' + Date.now().toString().slice(-6), status: 'PAID', detail: method === 'card' ? '•••• ' + v.slice(-4) : v }); }, 1300); };
    m.querySelector('.modal-x').onclick = () => { UI.closeModal(); reject(new Error('Payment cancelled.')); };
  });

  /* ---------------- ORDERS ---------------- */
  const ORDER_FLOW = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  App.ORDER_FLOW = ORDER_FLOW;
  App.returnWindowLeft = o => { if (!o.deliveredAt) return null; return Math.ceil(R.returnDays - (Date.now() - new Date(o.deliveredAt)) / 86400000); };
  App.views.orders = (route, user) => {
    if (!App.requireLogin()) return ''; App.title = 'My orders';
    const list = S.db.orders.filter(o => o.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return `<section class="wrap pad"><h2>My orders</h2>${list.length ? list.map(o => `<a class="orderrow" href="#/order/${o.id}"><div class="minis">${o.items.map(i => `<span class="mini" style="--tile:${i.color}">${i.emoji}</span>`).join('')}</div>
      <div class="grow"><b>${o.items.map(i => esc(i.name)).join(', ')}</b><small>${o.id} · ${UI.date(o.createdAt)} · ${inr(o.total)}</small></div>${UI.statusPill(o.ret ? 'RETURN_' + o.ret.status : o.status)}<span class="chev">›</span></a>`).join('')
      : `<div class="empty"><span>📦</span><h3>No orders yet</h3><a class="btn dark" href="#/shop">Find a toy</a></div>`}</section>`;
  };
  App.views.order = (route, user) => {
    if (!App.requireLogin()) return ''; const o = S.db.orders.find(x => x.id === route.args[0] && (x.userId === user.id || user.role === 'admin'));
    if (!o) return App.views.notfound(); App.title = 'Order ' + o.id;
    const idx = ORDER_FLOW.indexOf(o.status); const left = App.returnWindowLeft(o);
    const reviewed = id => S.db.reviews.some(r => r.productId === id && r.userId === user.id);
    return `<section class="wrap pad"><nav class="crumbs"><a href="#/orders">My orders</a> / <span>${o.id}</span></nav>
      <div class="row between wrapit"><div><h2>Order ${o.id}</h2><p class="muted">Placed ${UI.dateTime(o.createdAt)} · Paid by ${esc(o.payment.method)} (${esc(o.payment.ref)})</p></div>
      <div class="row gap"><button class="btn ghost" data-act="invoice" data-id="${o.id}">Invoice</button>${['PLACED', 'CONFIRMED'].includes(o.status) ? `<button class="btn ghost" data-act="cancel-order" data-id="${o.id}">Cancel order</button>` : ''}</div></div>
      ${o.status === 'CANCELLED' ? `<div class="note bad">This order was cancelled. ${o.payment.status === 'REFUNDED' ? 'Your refund of ' + inr(o.total) + ' has been processed (test mode).' : ''}</div>` :
      `<ol class="timeline">${ORDER_FLOW.map((s, i) => { const h = o.history.find(x => x.status === s); return `<li class="${i <= idx ? 'done' : ''} ${i === idx ? 'now' : ''}"><i></i><b>${s.replace(/_/g, ' ').toLowerCase()}</b><small>${h ? UI.dateTime(h.at) : ''}</small></li>`; }).join('')}</ol>`}
      ${o.ret ? `<div class="note"><b>Return ${o.ret.status.toLowerCase()}</b> · Reason: ${esc(o.ret.reason)}. ${o.ret.status === 'REQUESTED' ? 'Pickup will be scheduled within 48 hours.' : o.ret.status === 'REFUNDED' ? 'Refund of ' + inr(o.ret.amount) + ' sent to ' + esc(o.ret.to) + '.' : o.ret.status === 'REJECTED' ? esc(o.ret.adminNote || '') : ''}</div>` : ''}
      <div class="checkout mt"><div class="panel">${o.items.map(i => `<div class="line"><span class="mini lg" style="--tile:${i.color}">${i.emoji}</span><div class="grow"><b>${esc(i.name)}</b><small>${i.source === 'p2p' ? 'Community listing' : 'Pretoy Certified · Grade ' + i.grade}</small></div><b>${inr(i.price)}</b>
        ${o.status === 'DELIVERED' && !reviewed(i.productId) ? `<button class="btn sm ghost" data-act="review" data-id="${i.productId}">Review</button>` : ''}</div>`).join('')}
        ${o.gift.tier !== 'none' ? `<p>🎁 ${esc((R.gift.find(g => g.id === o.gift.tier) || {}).name)}${o.gift.note ? ': “' + esc(o.gift.note) + '”' : ''}</p>` : ''}
        ${o.status === 'DELIVERED' && !o.ret ? (left > 0 ? `<div class="note"><b>↩︎ Easy returns: ${left} day${left > 1 ? 's' : ''} left.</b> Not quite right? Return it for a full refund. <button class="btn sm dark" data-act="return" data-id="${o.id}">Request a return</button></div>` : `<p class="small muted">The ${R.returnDays}-day return window has closed.</p>`) : ''}</div>
      <aside class="panel summary"><h3>Summary</h3><div class="sumrow"><span>Subtotal</span><b>${inr(o.subtotal)}</b></div><div class="sumrow"><span>Delivery</span><b>${o.shipping ? inr(o.shipping) : 'Free'}</b></div>
        ${o.gift.price ? `<div class="sumrow"><span>Gift box</span><b>${inr(o.gift.price)}</b></div>` : ''}${o.discount ? `<div class="sumrow good"><span>Discount</span><b>−${inr(o.discount)}</b></div>` : ''}${o.credit ? `<div class="sumrow good"><span>Store credit</span><b>−${inr(o.credit)}</b></div>` : ''}
        <div class="sumrow total"><span>Total</span><b>${inr(o.total)}</b></div><h4>Delivering to</h4><p class="small">${esc(o.address.line)}, ${esc(o.address.city)} ${esc(o.address.pin)}</p>
        ${o.courier ? `<p class="small">Courier: ${esc(o.courier)} · AWB ${esc(o.awb)}</p>` : ''}</aside></div></section>`;
  };

  /* ---------------- SELL: instant valuation + pickup ---------------- */
  App.sellDraft = { mrp: '', condition: 'good', completeness: 'complete', box: false, year: new Date().getFullYear() - 1, brand: '' };
  App.views.sell = (route, user) => {
    App.title = 'Sell your toys'; const d = App.sellDraft; const v = S.instantValuation(d);
    return `<section class="hero slim"><div class="wrap"><p class="eyebrow">Pass it on</p><h1>Turn outgrown toys into <em>cash or credit.</em></h1><p class="lead">Get an instant valuation, pick a pickup slot and we'll do the rest: collection, inspection and payout within 48 hours of collection.</p></div></section>
    <section class="wrap pad"><div class="steps4">${[['1', 'Value it', 'Answer 5 quick questions for an instant price range.'], ['2', 'Book a pickup', 'Choose a slot. Our partner collects from your door, free.'], ['3', 'We inspect', 'Our team checks it on 5 points and confirms the final offer.'], ['4', 'Get paid', 'UPI or bank transfer, or +10% bonus as Pretoy store credit.']].map(s => `<div><span>${s[0]}</span><b>${s[1]}</b><small>${s[2]}</small></div>`).join('')}</div>
    <form class="sellgrid mt" data-form="submit-toy"><div class="panel"><h3>Tell us about the toy</h3><div class="form-grid">
      <label class="wide">Toy name<input name="toyName" required placeholder="e.g. LEGO City Fire Station"></label>
      <label>Brand<input name="brand" value="${esc(d.brand)}" data-act-input="val" placeholder="LEGO, Hape, Fisher-Price…" list="brands"></label><datalist id="brands">${R.premiumBrands.map(b => `<option value="${b.replace(/\b\w/g, c => c.toUpperCase())}">`).join('')}</datalist>
      <label>Category<select name="category" required>${R.categories.map(c => `<option>${c}</option>`).join('')}</select></label>
      <label>Age group<select name="age">${R.ages.map(c => `<option>${c}</option>`).join('')}</select></label>
      <label>Original price / MRP (₹)<input name="mrp" type="number" min="200" max="100000" required value="${esc(d.mrp)}" data-act-input="val" placeholder="2499"></label>
      <label>Year bought<select name="year" data-act-change="val">${Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map(y => `<option ${Number(d.year) === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <label>Condition<select name="condition" data-act-change="val">${[['like-new', 'Like new: barely played'], ['good', 'Good: light signs of play'], ['fair', 'Fair: visible wear, works fine'], ['worn', 'Well worn: needs some care']].map(([k, l]) => `<option value="${k}" ${d.condition === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Parts<select name="completeness" data-act-change="val">${[['complete', 'All parts present'], ['minor', 'A few small parts missing'], ['major', 'Major parts missing']].map(([k, l]) => `<option value="${k}" ${d.completeness === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="check wide"><input type="checkbox" name="box" ${d.box ? 'checked' : ''} data-act-change="val"> I still have the original box</label>
      <label class="wide">Anything we should know?<textarea name="description" placeholder="Missing pieces, scratches, does it need batteries…"></textarea></label>
      <label class="wide">Photos (up to 4, helps us confirm your offer faster)<input type="file" name="photos" accept="image/*" multiple data-act-change="photos"></label><div class="wide previews" id="previews"></div></div></div>
    <div><div class="panel valuation" id="valuation">${valuationCard(v, d)}</div>
      <div class="panel mt"><h3>Book a free home pickup</h3><div class="form-grid">
        <label>Date<input type="date" name="pdate" required min="${S.daysAhead(1)}" max="${S.daysAhead(14)}" value="${S.daysAhead(2)}"></label>
        <label>Slot<select name="pslot">${R.pickupSlots.map(s => `<option>${s}</option>`).join('')}</select></label>
        <label class="wide">Pickup address<input name="paddr" required value="${user && user.addresses[0] ? esc(user.addresses[0].line + ', ' + user.addresses[0].city + ' ' + user.addresses[0].pin) : ''}" placeholder="Flat, street, area, city, PIN"></label>
        <label class="wide">How would you like to be paid?<select name="payout"><option value="upi">UPI transfer</option><option value="bank">Bank transfer (NEFT)</option><option value="credit">Pretoy store credit (+10% bonus)</option></select></label></div>
        <label class="check small"><input type="checkbox" name="consent" required> I own this toy and consent to Pretoy processing my name, phone and address to arrange pickup and payout (<a href="#/privacy">Privacy notice</a>).</label>
        <button class="btn dark lg full">${user ? 'Submit & book pickup' : 'Log in to submit'}</button>
        <p class="small muted center-text">Prefer to set your own price? <a href="#/list">List it on the community marketplace</a>.</p></div></div></form></section>`;
  };
  function valuationCard(v, d) {
    if (!Number(d.mrp)) return `<h3>Instant valuation</h3><p class="muted">Enter the MRP to see what Pretoy can pay you. We pay ${R.valuationMin * 100}–${R.valuationMax * 100}% of MRP depending on condition.</p><div class="bigv dim">₹ —</div>`;
    return `<h3>Instant valuation</h3><div class="bigv">${inr(v.low)} – ${inr(v.high)}</div><p class="small muted">${Math.round(v.pct * 100)}% of MRP ${inr(d.mrp)} · or up to <b>${inr(v.credit)}</b> as store credit</p>
      <div class="meter"><i style="left:${(v.pct - 0.2) / 0.15 * 100}%"></i><span>20%</span><span>35%</span></div>${v.notes.length ? `<ul class="small">${v.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <p class="small muted">Final offer is confirmed after a quick photo review or at pickup inspection.</p>`;
  }
  App.valuationCard = valuationCard;

  /* ---------------- P2P listing ---------------- */
  App.views.list = (route, user) => {
    App.title = 'List a toy';
    return `<section class="wrap pad"><div class="sellgrid"><div><p class="eyebrow">Community marketplace</p><h2>List it yourself</h2><p class="lead">Set your own price and sell directly to other parents. Listings are reviewed by our team within 24 hours. You only pay a commission when it sells.</p>
      <div class="panel"><h3>Commission</h3><table class="mini-table"><tr><td>Under ₹1,000</td><td><b>15%</b></td></tr><tr><td>₹1,000 – ₹2,999</td><td><b>12%</b></td></tr><tr><td>₹3,000 and above</td><td><b>10%</b></td></tr></table>
      <p class="small muted">Buyers get Pretoy Buyer Protection and ${R.returnDays}-day returns. Want the Quality Seal instead? <a href="#/sell">Sell it to Pretoy</a>.</p></div></div>
      <form class="panel" data-form="p2p"><h3>Your listing</h3><div class="form-grid">
        <label class="wide">Title<input name="name" required maxlength="80" placeholder="e.g. Wooden Train Set with 20 tracks"></label>
        <label>Brand<input name="brand" placeholder="Brand"></label><label>Category<select name="category">${R.categories.map(c => `<option>${c}</option>`).join('')}</select></label>
        <label>Age group<select name="age">${R.ages.map(c => `<option>${c}</option>`).join('')}</select></label><label>Condition<select name="condition"><option>Like new</option><option>Good</option><option>Fair</option></select></label>
        <label>MRP (₹)<input name="mrp" type="number" min="0" placeholder="Optional"></label><label>Your price (₹)<input name="price" type="number" min="100" required data-act-input="p2pcalc" placeholder="1200"></label>
        <div class="wide earn" id="earn">Enter a price to see your earnings.</div>
        <label class="wide">Description<textarea name="description" required placeholder="What's included, how it's been used…"></textarea></label>
        <label class="wide">Photos (up to 4)<input type="file" name="photos" accept="image/*" multiple data-act-change="photos"></label><div class="wide previews" id="previews"></div>
        <label class="check wide small"><input type="checkbox" name="consent" required> I confirm this toy is safe, clean and described honestly, and agree to the <a href="#/terms">community seller terms</a>.</label></div>
        <button class="btn dark lg full">${user ? 'Submit listing for review' : 'Log in to list'}</button></form></div></section>`;
  };

  /* ---------------- MY SALES ---------------- */
  const SUB_FLOW = ['SUBMITTED', 'OFFER_MADE', 'ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'INSPECTED', 'LISTED', 'PAID'];
  App.SUB_FLOW = SUB_FLOW;
  App.views['my-sales'] = (route, user) => {
    if (!App.requireLogin()) return ''; App.title = 'My sales';
    const subs = S.db.submissions.filter(s => s.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const listings = S.db.products.filter(p => p.source === 'p2p' && p.sellerId === user.id);
    const p2pSold = S.db.payouts.filter(p => p.userId === user.id);
    const earned = p2pSold.reduce((a, p) => a + p.amount, 0) + subs.filter(s => s.status === 'PAID').reduce((a, s) => a + (s.finalAmount || s.offer || 0), 0);
    const pending = subs.filter(s => ['ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'INSPECTED', 'LISTED'].includes(s.status)).reduce((a, s) => a + (s.offer || 0), 0);
    return `<section class="wrap pad"><div class="row between wrapit"><h2>My sales & listings</h2><div class="row gap"><a href="#/sell" class="btn dark">Sell to Pretoy</a><a href="#/list" class="btn ghost">New community listing</a></div></div>
      <div class="kpis"><div><small>Earned so far</small><b>${inr(earned)}</b></div><div><small>Pending payout</small><b>${inr(pending)}</b></div><div><small>Store credit</small><b>${inr(user.storeCredit)}</b></div><div><small>Live listings</small><b>${listings.filter(l => l.status === 'live').length}</b></div></div>
      <h3 class="mt">Toys sold to Pretoy</h3>${subs.length ? subs.map(s => subCard(s)).join('') : '<p class="muted">Nothing yet. <a href="#/sell">Get an instant valuation</a>.</p>'}
      <h3 class="mt">Community listings</h3>${listings.length ? `<div class="table-wrap"><table><thead><tr><th>Toy</th><th>Price</th><th>Commission</th><th>You earn</th><th>Status</th><th></th></tr></thead><tbody>
      ${listings.map(l => `<tr><td><a href="#/toy/${l.id}"><b>${esc(l.name)}</b></a><small>${UI.date(l.createdAt)} · ${l.views} views</small></td><td>${inr(l.price)}</td><td>${Math.round(l.commissionPct * 100)}%</td><td>${inr(l.price * (1 - l.commissionPct))}</td><td>${UI.statusPill(l.status)}${l.rejectReason ? `<small>${esc(l.rejectReason)}</small>` : ''}</td>
        <td class="actions">${['live', 'pending'].includes(l.status) ? `<button class="btn sm ghost" data-act="p2p-price" data-id="${l.id}">Edit price</button><button class="btn sm ghost" data-act="p2p-delist" data-id="${l.id}">Delist</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No community listings yet.</p>'}</section>`;
  };
  function subCard(s) {
    const idx = SUB_FLOW.indexOf(s.status); const closed = ['DECLINED', 'REJECTED', 'RECYCLED', 'CANCELLED'].includes(s.status);
    return `<div class="panel subcard"><div class="row between wrapit"><div class="row gap">${s.photos[0] ? `<img class="thumb" src="${s.photos[0]}" alt="">` : '<span class="mini lg" style="--tile:#eee6d8">🧸</span>'}<div><b>${esc(s.toyName)}</b><small class="block muted">${s.id} · ${esc(s.brand || '')} · MRP ${inr(s.mrp)} · Valued ${inr(s.valuation.low)}–${inr(s.valuation.high)}</small></div></div>${UI.statusPill(s.status)}</div>
      ${closed ? `<p class="small muted">${esc(s.closeNote || '')}</p>` : `<div class="progress">${SUB_FLOW.map((st, i) => `<span class="${i <= idx ? 'done' : ''}" title="${st}">${st.replace(/_/g, ' ').toLowerCase()}</span>`).join('')}</div>`}
      ${s.status === 'OFFER_MADE' ? `<div class="note"><b>Pretoy offers ${inr(s.offer)}</b>${s.payoutMethod === 'credit' ? ` (${inr(Math.round(s.offer * 1.1))} as store credit)` : ''}. ${esc(s.offerNote || '')}<div class="row gap mt"><button class="btn dark sm" data-act="accept-offer" data-id="${s.id}">Accept & confirm pickup</button><button class="btn ghost sm" data-act="decline-offer" data-id="${s.id}">Decline</button></div></div>` : ''}
      ${s.pickup && ['SUBMITTED', 'OFFER_MADE', 'ACCEPTED', 'PICKUP_SCHEDULED'].includes(s.status) ? `<p class="small">🚚 Pickup ${UI.date(s.pickup.date)}, ${esc(s.pickup.slot)} · ${esc(s.pickup.address)} <button class="btn sm ghost" data-act="reschedule" data-id="${s.id}">Reschedule</button></p>` : ''}
      ${s.status === 'PAID' ? `<p class="small good">✓ Paid ${inr(s.finalAmount || s.offer)} via ${esc(s.payoutRef || s.payoutMethod)}</p>` : ''}
      ${s.productId && S.product(s.productId) ? `<p class="small">Now listed: <a href="#/toy/${s.productId}">${esc(S.product(s.productId).name)}</a></p>` : ''}</div>`;
  }

  /* ---------------- RENT ---------------- */
  App.views.rent = (route, user) => {
    App.title = 'Toy rental';
    const sub = user && S.db.rentals.find(r => r.userId === user.id && r.status !== 'CANCELLED');
    const plan = sub && R.rentalPlans.find(p => p.id === sub.plan);
    const rentable = live().filter(p => p.rentable);
    if (sub) {
      const inBox = sub.toys.map(id => S.product(id)).filter(Boolean);
      return `<section class="wrap pad"><div class="row between wrapit"><div><p class="eyebrow">Your subscription</p><h2>${plan.name} · ${inr(plan.price)}/month</h2><p class="muted">Next billing ${UI.date(sub.nextBilling)} · ${sub.swapsUsed}/${plan.swaps} swaps used this month · ${UI.statusPill(sub.status)}</p></div>
        <div class="row gap"><button class="btn ghost" data-act="rent-swap" ${inBox.length ? '' : 'disabled'}>Request a swap</button><button class="btn ghost" data-act="rent-cancel">Cancel plan</button></div></div>
        <h3 class="mt">In your box (${inBox.length}/${plan.toys})</h3>${inBox.length ? `<div class="grid">${inBox.map(p => `<article class="card">${UI.art(p)}<div class="card-body"><h3>${esc(p.name)}</h3><small>${esc(p.age)}</small><div class="card-foot"><span class="pill st-${sub.boxStatus === 'DELIVERED' ? 'delivered' : 'confirmed'}">${(sub.boxStatus || 'PREPARING').toLowerCase()}</span><button class="btn sm ghost" data-act="rent-remove" data-id="${p.id}">Return</button></div></div></article>`).join('')}</div>` : '<p class="muted">Your box is empty. Pick toys below.</p>'}
        ${inBox.length < plan.toys ? `<h3 class="mt">Add toys to your box</h3><div class="grid">${rentable.filter(p => !sub.toys.includes(p.id)).map(p => `<article class="card">${UI.art(p)}<div class="card-body"><small>${esc(p.age)}</small><h3>${esc(p.name)}</h3><div class="card-foot"><span class="g g-${p.grade}">Grade ${p.grade}</span><button class="btn sm dark" data-act="rent-add" data-id="${p.id}">Add to box</button></div></div></article>`).join('')}</div>` : ''}</section>`;
    }
    return `<section class="hero slim"><div class="wrap"><p class="eyebrow">Toy rental subscription</p><h1>Endless play, <em>zero clutter.</em></h1><p class="lead">A box of sanitised, Quality-Seal certified toys every month. Swap when they're bored, keep the ones they love.</p></div></section>
      <section class="wrap pad"><div class="plans">${R.rentalPlans.map(p => `<div class="plan ${p.popular ? 'pop' : ''}">${p.popular ? '<span class="ribbon">Most popular</span>' : ''}<h3>${p.name}</h3><div class="planprice">${inr(p.price)}<small>/month</small></div><ul>${p.perks.map(x => `<li>✓ ${x}</li>`).join('')}</ul><button class="btn ${p.popular ? 'dark' : 'ghost'} full" data-act="rent-sub" data-id="${p.id}">Choose ${p.name}</button></div>`).join('')}</div>
      <p class="small muted center-text mt">Cancel anytime. Refundable deposit waived during the POC. Billing runs in test mode.</p>
      <h3 class="mt">Toys available to rent right now</h3><div class="grid">${rentable.slice(0, 8).map(card).join('')}</div></section>`;
  };

  /* ---------------- BUSINESS ---------------- */
  App.views.business = () => {
    App.title = 'For business';
    return `<section class="hero slim"><div class="wrap"><p class="eyebrow">Pretoy for Business</p><h1>Bulk toys with <em>real impact.</em></h1><p class="lead">CSR donations, preschool kits and festive gifting. Every toy certified, every bundle reported in kg of waste avoided.</p></div></section>
      <section class="wrap pad"><div class="bundles">${R.bundles.map(b => `<div class="panel bundle"><span class="bemoji">${b.emoji}</span><h3>${b.name}</h3><p>${b.desc}</p><p><b>From ${inr(b.from)}</b> <small class="muted">${b.unit}</small></p><button class="btn ghost sm" data-act="pick-bundle" data-id="${b.id}">Get a quote</button></div>`).join('')}</div>
      <div class="sellgrid mt"><div><h2>Request a quote</h2><p class="muted">Our partnerships team replies within one working day with a proposal, sample impact report and delivery plan.</p>
        <ul class="perks"><li>📊 Impact certificate for CSR-2 filings</li><li>🏷️ Co-branded gift boxes</li><li>🚚 Pan-India delivery to multiple sites</li><li>🧾 GST invoice</li></ul></div>
      <form class="panel" data-form="lead" id="leadform"><div class="form-grid"><label class="wide">Organisation<input name="org" required></label><label>Your name<input name="name" required></label><label>Work email<input name="email" type="email" required></label>
        <label>Phone<input name="phone" pattern="[0-9]{10}" placeholder="10 digits"></label><label>Bundle<select name="bundle" id="bundlesel">${R.bundles.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select></label>
        <label>Quantity (bundles/boxes)<input name="qty" type="number" min="1" value="1" required></label><label class="wide">Tell us more<textarea name="message" placeholder="Occasion, locations, timeline…"></textarea></label></div>
        <label class="check small"><input type="checkbox" name="consent" required> I agree to be contacted about this request.</label><button class="btn dark lg full">Send request</button></form></div></section>`;
  };

  /* ---------------- HOW IT WORKS ---------------- */
  App.views.how = () => {
    App.title = 'How it works';
    return `<section class="hero slim"><div class="wrap"><p class="eyebrow">How Pretoy works</p><h1>From one home <em>to another.</em></h1><p class="lead">Pretoy is a C2B2C platform: we buy pre-loved toys from parents, restore and certify them, then resell at 50–70% below MRP.</p></div></section>
      <section class="wrap pad"><div class="steps4">${[['01', 'We collect', 'Free doorstep pickup after an instant valuation of 20–35% of MRP.'], ['02', 'We inspect', 'Every toy goes through the 5-point Quality Seal: Safety, Hygiene, Parts, Function, Packaging.'], ['03', 'We restore', 'Deep-cleaning, sanitising, part replacement and repacking in plastic-light boxes.'], ['04', 'Play begins again', 'Listed with a verifiable certificate, delivered with 15-day returns.']].map(s => `<div><span>${s[0]}</span><b>${s[1]}</b><small>${s[2]}</small></div>`).join('')}</div>
      <h2 class="mt">The grading scale</h2><div class="three">${['A', 'B', 'C'].map(g => `<div class="panel"><span class="g g-${g}">Grade ${g}</span><h3>${R.gradeLabels[g]}</h3><p class="muted">${{ A: 'Average seal score 4.5 or more. Looks and works like new. Priced around 50% of MRP.', B: 'Average 3.6 to 4.4. Light signs of play, fully functional. Around 40% of MRP.', C: 'Below 3.6 with Safety and Hygiene still passing. Cosmetic wear, great value at around 30% of MRP.' }[g]}</p></div>`).join('')}</div>
      <h2 class="mt">Four ways to take part</h2><div class="bundles"><a class="panel" href="#/shop"><h3>🛍️ Buy certified</h3><p class="muted">Quality Seal, grade and public certificate on every toy.</p></a><a class="panel" href="#/sell"><h3>💸 Sell to Pretoy</h3><p class="muted">Instant valuation, free pickup, fast payout.</p></a><a class="panel" href="#/list"><h3>🤝 Sell peer-to-peer</h3><p class="muted">Your price, 10–15% commission, buyer protection.</p></a><a class="panel" href="#/rent"><h3>📦 Rent</h3><p class="muted">₹499–999 a month, swap anytime.</p></a></div>
      <h2 class="mt">FAQs</h2><div class="faq">${[['Are pre-loved toys safe?', 'Every certified toy must pass Safety and Hygiene with a score of 3/5 or more, or it is recycled through our partner instead of resold.'], ['What if I don’t like it?', `Return any toy within ${R.returnDays} days of delivery for a full refund. We pick it up from your door.`], ['How is the valuation calculated?', 'It starts from the MRP and adjusts for condition, missing parts, original box, age and brand, within a 20–35% band.'], ['How are community listings different?', 'They are sold by other parents at their own price, with a seller-described condition rather than a Quality Seal. Pretoy holds payment until delivery and covers returns.'], ['Where is my data stored?', 'In this proof-of-concept, all data stays in your browser’s local storage. See the Privacy notice for how a live version would handle data under the DPDP Act, 2023.']].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>`;
  };

  /* ---------------- AUTH ---------------- */
  App.views.login = (route) => {
    App.title = 'Log in'; const next = route.q.next || '#/';
    return `<section class="wrap pad auth"><div class="panel"><img class="authlogo" src="img/pretoy-mark.png" alt=""><h2>Welcome back</h2><p class="muted">Log in to buy, sell, rent and track orders.</p>
      <form data-form="login" data-next="${esc(next)}"><label>Email<input name="email" type="email" required autocomplete="username"></label><label>Password<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="btn dark lg full">Log in</button></form><div class="row between small mt"><a href="#/forgot">Forgot password?</a><a href="#/register?next=${encodeURIComponent(next)}">Create an account</a></div></div>
      <div class="panel demo"><h3>Demo accounts</h3><p class="small muted">One click to log in as each role.</p>
        ${[['buyer@pretoy.in', 'buyer123', '🛍️ Buyer', 'Has a delivered order (try a return) and one in transit'], ['seller@pretoy.in', 'seller123', '💸 Seller', 'Has an offer waiting, a pickup and community listings'], ['admin@pretoy.in', 'admin123', '🛠️ Admin', 'Runs inspections, pricing, orders, returns and more']].map(([e, p, l, d]) =>
        `<button class="demoacct" data-act="demo-login" data-email="${e}" data-pw="${p}"><b>${l}</b><small>${e} · ${p}</small><small class="muted">${d}</small></button>`).join('')}</div></section>`;
  };
  App.views.register = (route) => {
    App.title = 'Create account';
    return `<section class="wrap pad auth one"><div class="panel"><img class="authlogo" src="img/pretoy-mark.png" alt=""><h2>Create your Pretoy account</h2><p class="muted">One account to buy, sell, list and rent.</p>
      <form data-form="register" data-next="${esc(route.q.next || '#/')}"><label>Full name<input name="name" required autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Mobile<input name="phone" pattern="[0-9]{10}" placeholder="10-digit mobile" autocomplete="tel"></label><label>Password<input name="password" type="password" minlength="6" required autocomplete="new-password"><small class="muted">At least 6 characters.</small></label>
      <fieldset class="consent"><legend>Your consent (DPDP Act, 2023)</legend>
        <label class="check"><input type="checkbox" name="terms" required> I accept the <a href="#/terms" target="_blank">Terms of use</a>. <small>(required)</small></label>
        <label class="check"><input type="checkbox" name="privacy" required> I have read the <a href="#/privacy" target="_blank">Privacy notice</a> and consent to Pretoy processing my personal data to run my account, orders, pickups and payouts. <small>(required)</small></label>
        <label class="check"><input type="checkbox" name="marketing"> Send me offers and new-arrival alerts. <small>(optional, withdraw anytime)</small></label>
        <label class="check"><input type="checkbox" name="adult" required> I am 18 or older. Pretoy does not knowingly collect children's data. <small>(required)</small></label></fieldset>
      <button class="btn dark lg full">Create account</button></form><p class="small center-text mt">Already have an account? <a href="#/login">Log in</a></p></div></section>`;
  };
  App.views.forgot = () => { App.title = 'Reset password';
    return `<section class="wrap pad auth one"><div class="panel"><h2>Reset your password</h2><p class="muted">In this POC we skip the email link: confirm your email and choose a new password. A notice is logged to the simulated outbox.</p>
      <form data-form="forgot"><label>Email<input name="email" type="email" required></label><label>New password<input name="password" type="password" minlength="6" required></label><button class="btn dark lg full">Reset password</button></form></div></section>`; };

  /* ---------------- ACCOUNT / PRIVACY ---------------- */
  App.views.account = (route, user) => {
    if (!App.requireLogin()) return ''; App.title = 'Account';
    const log = S.db.consentLog.filter(c => c.userId === user.id);
    return `<section class="wrap pad"><h2>Account & privacy</h2><div class="acctgrid">
      <form class="panel" data-form="profile"><h3>Profile</h3><label>Name<input name="name" value="${esc(user.name)}" required></label><label>Email<input value="${esc(user.email)}" disabled></label><label>Mobile<input name="phone" value="${esc(user.phone)}" pattern="[0-9]{10}"></label><button class="btn dark">Save profile</button></form>
      <div class="panel"><h3>Saved addresses</h3>${user.addresses.map(a => `<div class="line slim"><span class="grow"><b>${esc(a.label)}</b> ${esc(a.line)}, ${esc(a.city)} ${esc(a.pin)}</span><button class="x" data-act="rm-addr" data-id="${a.id}" aria-label="Remove">×</button></div>`).join('') || '<p class="muted">No saved addresses.</p>'}
        <form data-form="addr" class="form-grid mt"><label>Label<input name="label" value="Home" required></label><label>PIN<input name="pin" required pattern="[0-9]{6}"></label><label class="wide">Address<input name="line" required></label><label>City<input name="city" required></label><div class="row end"><button class="btn ghost sm">Add address</button></div></form></div>
      <form class="panel" data-form="password"><h3>Change password</h3><label>Current password<input type="password" name="old" required></label><label>New password<input type="password" name="new" minlength="6" required></label><button class="btn ghost">Update password</button></form>
      <div class="panel privacy"><h3>🔐 Privacy centre <small class="muted">(DPDP Act, 2023)</small></h3>
        <p class="small muted">You're the Data Principal. You can see, correct, withdraw or erase your data at any time.</p>
        <label class="check"><input type="checkbox" checked disabled> Account, orders, pickups & payouts <small>(needed to provide the service)</small></label>
        <label class="check"><input type="checkbox" data-act-change="marketing" ${user.consent.marketing ? 'checked' : ''}> Offers & new-arrival alerts</label>
        <details><summary>Consent history (${log.length})</summary><ul class="small">${log.map(c => `<li>${UI.dateTime(c.at)}: ${esc(c.action)} ${esc(c.scope)}</li>`).join('')}</ul></details>
        <div class="row gap wrapit mt"><button class="btn ghost sm" data-act="my-data">Download my data</button><button class="btn danger sm" data-act="erase-me">Erase my account</button></div>
        <p class="small muted">Grievance Officer: grievance@pretoy.in · Response within 7 days. You may also approach the Data Protection Board of India.</p></div></div></section>`;
  };
  App.views.notifications = (route, user) => {
    if (!App.requireLogin()) return ''; App.title = 'Notifications';
    const list = S.db.notifications.filter(n => n.userId === user.id || (user.role === 'admin' && n.userId === 'admin'));
    setTimeout(() => { list.forEach(n => { n.read = true; }); S.save(); const d = $('.ico .dot', $('#header')); if (d && d.parentElement.title === 'Notifications') d.remove(); }, 600);
    return `<section class="wrap pad narrow"><h2>Notifications</h2>${list.length ? list.map(n => `<a class="notif ${n.read ? '' : 'unread'}" href="${esc(n.link || '#/notifications')}"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${UI.ago(n.at)}${n.userId === 'admin' ? ' · Admin' : ''}</small></a>`).join('') : '<div class="empty"><span>🔔</span><h3>You’re all caught up</h3></div>'}</section>`;
  };
  App.views.wishlist = (route, user) => {
    if (!App.requireLogin('Log in to see your wishlist.')) return ''; App.title = 'Wishlist';
    const items = user.wishlist.map(id => S.product(id)).filter(Boolean);
    return `<section class="wrap pad"><h2>Your wishlist</h2>${items.length ? `<div class="grid">${items.map(p => p.status === 'live' ? card(p) : `<article class="card sold">${UI.art(p)}<div class="card-body"><h3>${esc(p.name)}</h3><p class="muted small">This one has found a new home.</p><button class="btn sm ghost" data-act="fav" data-id="${p.id}">Remove</button></div></article>`).join('')}</div>` : '<div class="empty"><span>♡</span><h3>Nothing saved yet</h3><a class="btn dark" href="#/shop">Browse toys</a></div>'}</section>`;
  };
  App.views.privacy = () => { App.title = 'Privacy notice'; return `<section class="wrap pad narrow prose"><p class="eyebrow">Digital Personal Data Protection Act, 2023</p><h2>Privacy notice</h2>
    <p><b>Who we are.</b> Pretoy ("we") is the Data Fiduciary for personal data collected on this platform.</p>
    <p><b>What we collect and why.</b> Name, email, mobile and address to run your account, deliver orders, collect toys you sell and pay you out. Payment details are handled by the payment gateway, not stored by us. Toy photos you upload are used only to value and list the toy.</p>
    <p><b>Consent.</b> We process data only for the purposes you consented to. Marketing messages are optional and can be withdrawn from <a href="#/account">Account → Privacy centre</a> at any time, as easily as you gave it.</p>
    <p><b>Your rights.</b> Access a summary of your data, correct or update it, erase it, nominate a person to act for you, and raise a grievance. Use the Privacy centre or email grievance@pretoy.in.</p>
    <p><b>Children.</b> Accounts are for adults (18+). We do not knowingly collect children's data or track children, and we do not run targeted advertising at children.</p>
    <p><b>Retention.</b> We keep data only as long as needed for the purpose and legal obligations (e.g. tax invoices), then erase it.</p>
    <p><b>Security.</b> Passwords are stored as salted hashes. In this proof-of-concept, all data lives only in your browser's local storage on this device. Nothing is sent to a server.</p>
    <p><b>Grievance Officer.</b> grievance@pretoy.in. If unresolved, you may approach the Data Protection Board of India.</p></section>`; };
  App.views.terms = () => { App.title = 'Terms'; return `<section class="wrap pad narrow prose"><h2>Terms, returns & seller policy</h2>
    <h3>15-day returns</h3><p>Any toy can be returned within ${R.returnDays} days of delivery, in the condition received, for a full refund to the original payment method or as store credit. Gift-box charges are non-refundable once opened. We arrange pickup free of charge.</p>
    <h3>Quality Seal</h3><p>Certified toys are inspected on Safety, Hygiene, Parts, Function and Packaging. If a certified toy fails any of these on arrival, we refund in full and cover return shipping.</p>
    <h3>Selling to Pretoy</h3><p>Instant valuations are estimates between 20% and 35% of MRP. The final offer is confirmed after inspection. If a toy fails Safety or Hygiene, we offer free responsible recycling or return it to you.</p>
    <h3>Community (P2P) sellers</h3><p>Commission is 15% under ₹1,000, 12% from ₹1,000 to ₹2,999 and 10% from ₹3,000. Payouts are released after the buyer's return window closes. Listings must be honest, safe and clean; Pretoy may remove listings that are not.</p>
    <h3>Rentals</h3><p>Plans renew monthly and can be cancelled anytime. Normal wear is covered; loss or major damage beyond the plan's damage cover may be charged.</p>
    <h3>Proof-of-concept</h3><p>This is a demonstration. Payments run in test mode and no real money, pickups or deliveries take place.</p></section>`; };
  App.views.notfound = () => `<section class="wrap pad"><div class="empty"><span>🧭</span><h3>Page not found</h3><a class="btn dark" href="#/">Go home</a></div></section>`;

  /* ---------------- event wiring ---------------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    const menu = $('#acctmenu'); if (menu && !e.target.closest('.acct')) menu.classList.remove('open');
    if (e.target.closest('.mainnav a')) $('#mainnav') && $('#mainnav').classList.remove('open');
    if (!el) return;
    const fn = App.actions[el.dataset.act] || (window.PretoyAdmin && window.PretoyAdmin.actions[el.dataset.act]);
    if (fn) { e.preventDefault(); Promise.resolve(fn(el, e)).catch(err => { console.error(err); UI.toast(err.message || 'Something went wrong', 'error'); }); }
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    const fn = App.forms[f.dataset.form] || (window.PretoyAdmin && window.PretoyAdmin.forms[f.dataset.form]);
    if (fn) { e.preventDefault(); const btn = f.querySelector('button:not([type=button])'); if (btn) btn.disabled = true;
      Promise.resolve(fn(f, UI.form(f))).catch(err => { console.error(err); UI.toast(err.message || 'Something went wrong', 'error'); }).finally(() => { if (btn && document.body.contains(btn)) btn.disabled = false; }); }
  });
  const onChange = e => { const el = e.target; const k = el.dataset && (e.type === 'input' ? el.dataset.actInput : el.dataset.actChange); if (!k) return;
    const fn = App.actions['ch-' + k] || (window.PretoyAdmin && window.PretoyAdmin.actions['ch-' + k]); if (fn) Promise.resolve(fn(el, e)).catch(err => UI.toast(err.message, 'error')); };
  document.addEventListener('change', onChange); document.addEventListener('input', onChange);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeModal(); });
  window.addEventListener('hashchange', App.render);

  window.addEventListener('DOMContentLoaded', async () => {
    try { await S.init(); } catch (e) { $('#main').innerHTML = `<section class="wrap pad"><h2>Storage unavailable</h2><p>Pretoy needs browser local storage. Please allow site data or open the app from a regular (non-private) window.</p></section>`; return; }
    App.render();
    let seen = false; try { seen = localStorage.getItem('pretoy.v2.notice') === '1'; } catch (e) { /* ignore */ }
    if (!seen) { const b = document.createElement('div'); b.className = 'cookie'; b.innerHTML = `<p>🍪 Pretoy stores your account, cart and orders in this browser's local storage (no server, no trackers). See our <a href="#/privacy">Privacy notice</a>.</p><button class="btn sm dark">Got it</button>`;
      b.querySelector('button').onclick = () => { try { localStorage.setItem('pretoy.v2.notice', '1'); } catch (e) { /* ignore */ } b.remove(); }; document.body.appendChild(b); }
  });
})();
