/* Pretoy v2 admin desk: dashboard, acquisitions, Quality Seal inspection, inventory, P2P moderation,
   orders & returns, rentals, business leads, users, simulated outbox and data tools. */
(function () {
  'use strict';
  const UI = window.PretoyUI, S = window.Store, R = S.RULES, App = window.PretoyApp;
  const { esc, inr, $ } = UI;
  const Admin = { actions: {}, forms: {} }; const A = Admin.actions, F = Admin.forms;
  window.PretoyAdmin = Admin;
  const adminNotify = (title, body, link) => S.db.notifications.unshift({ id: S.nextId('N'), userId: 'admin', title, body, link: link || '', at: S.now(), read: false });

  const SECTIONS = [['', '📊', 'Dashboard'], ['submissions', '📥', 'Acquisitions'], ['inventory', '🧸', 'Inventory'], ['p2p', '🤝', 'P2P moderation'], ['orders', '📦', 'Orders & returns'], ['rentals', '🔄', 'Rentals'], ['leads', '🏢', 'Business leads'], ['users', '👥', 'Users'], ['outbox', '✉️', 'Notifications outbox'], ['data', '💾', 'Data & backup']];

  Admin.render = (route) => {
    const sec = route.args[0] || ''; const view = Admin.views[sec] || Admin.views[''];
    const counts = { submissions: S.db.submissions.filter(s => ['SUBMITTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'INSPECTED'].includes(s.status)).length, p2p: S.db.products.filter(p => p.source === 'p2p' && p.status === 'pending').length,
      orders: S.db.orders.filter(o => ['CONFIRMED', 'PACKED'].includes(o.status) || (o.ret && o.ret.status === 'REQUESTED')).length, leads: S.db.leads.filter(l => l.status === 'NEW').length };
    App.title = 'Admin · ' + (SECTIONS.find(s => s[0] === sec) || SECTIONS[0])[2];
    return `<div class="admin"><aside class="aside"><p class="eyebrow">Operations</p>${SECTIONS.map(([k, i, l]) => `<a href="#/admin${k ? '/' + k : ''}" class="${sec === k ? 'on' : ''}"><span>${i}</span>${l}${counts[k] ? `<b>${counts[k]}</b>` : ''}</a>`).join('')}<a href="#/">← Back to store</a></aside>
      <div class="adminmain">${view(route)}</div></div>`;
  };
  Admin.views = {};

  /* ---------- Dashboard ---------- */
  Admin.views[''] = () => {
    const db = S.db; const paid = db.orders.filter(o => o.status !== 'CANCELLED');
    const gmv = paid.reduce((a, o) => a + o.total, 0); const items = paid.reduce((a, o) => a + o.items.length, 0);
    const certifiedSold = paid.flatMap(o => o.items).filter(i => i.source === 'certified');
    const acqCost = certifiedSold.reduce((a, i) => { const s = db.submissions.find(x => x.productId === i.productId); return a + (s ? (s.finalAmount || s.offer || 0) : i.price * 0.55); }, 0);
    const p2pRev = paid.flatMap(o => o.items).filter(i => i.source === 'p2p').reduce((a, i) => a + i.price * S.p2pCommission(i.price), 0);
    const giftRev = paid.reduce((a, o) => a + (o.gift.price || 0), 0); const rentRev = db.rentals.filter(r => r.status === 'ACTIVE').reduce((a, r) => a + (R.rentalPlans.find(p => p.id === r.plan) || {}).price, 0);
    const margin = certifiedSold.reduce((a, i) => a + i.price, 0) - acqCost;
    const liveP = db.products.filter(p => p.status === 'live');
    const byCat = R.categories.map(c => [c, liveP.filter(p => p.category === c).length]).filter(x => x[1]); const maxCat = Math.max(1, ...byCat.map(x => x[1]));
    const funnel = App.SUB_FLOW.map(s => [s, db.submissions.filter(x => App.SUB_FLOW.indexOf(x.status) >= App.SUB_FLOW.indexOf(s)).length]); const maxF = Math.max(1, funnel[0][1]);
    const grades = ['A', 'B', 'C'].map(g => [g, liveP.filter(p => p.grade === g).length]);
    const recent = db.notifications.filter(n => n.userId === 'admin').slice(0, 7);
    return `<div class="row between wrapit"><div><h2>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋</h2><p class="muted">Here's how Pretoy is doing today.</p></div><a class="btn ghost" href="#/admin/submissions">Open acquisition queue</a></div>
      <div class="kpis"><div><small>GMV</small><b>${inr(gmv)}</b><em>${paid.length} orders</em></div><div><small>Avg order value</small><b>${inr(paid.length ? gmv / paid.length : 0)}</b><em>${items} toys sold</em></div>
        <div><small>Refurb gross margin</small><b>${inr(margin)}</b><em>resale − acquisition</em></div><div><small>P2P commission</small><b>${inr(p2pRev)}</b><em>10–15% take rate</em></div>
        <div><small>Gift-box revenue</small><b>${inr(giftRev)}</b><em>add-on attach ${paid.length ? Math.round(paid.filter(o => o.gift.price).length / paid.length * 100) : 0}%</em></div><div><small>Rental MRR</small><b>${inr(rentRev)}</b><em>${db.rentals.filter(r => r.status === 'ACTIVE').length} subscribers</em></div>
        <div><small>Live listings</small><b>${liveP.length}</b><em>${liveP.filter(p => p.source === 'p2p').length} community</em></div><div><small>Plastic diverted</small><b>${(items * 0.42 + 520).toFixed(0)} kg</b><em>est. 0.42 kg/toy</em></div></div>
      <div class="dash"><div class="panel"><h3>Inventory by category</h3>${byCat.map(([c, n]) => `<div class="hbar"><span>${c}</span><div><i style="width:${n / maxCat * 100}%"></i></div><b>${n}</b></div>`).join('')}</div>
        <div class="panel"><h3>Acquisition funnel</h3>${funnel.map(([s, n]) => `<div class="hbar"><span>${s.replace(/_/g, ' ').toLowerCase()}</span><div><i class="terra" style="width:${n / maxF * 100}%"></i></div><b>${n}</b></div>`).join('')}</div>
        <div class="panel"><h3>Live stock by grade</h3><div class="gradebars">${grades.map(([g, n]) => `<div><b>${n}</b><span class="g g-${g}">Grade ${g}</span><small>${R.gradeLabels[g]}</small></div>`).join('')}</div>
          <h3 class="mt">Needs attention</h3><ul class="todo">${todo().join('') || '<li class="muted">All clear ✨</li>'}</ul></div>
        <div class="panel"><h3>Recent activity</h3>${recent.map(n => `<a class="act" href="${esc(n.link)}"><b>${esc(n.title)}</b><small>${esc(n.body)} · ${UI.ago(n.at)}</small></a>`).join('')}</div></div>`;
  };
  function todo() { const db = S.db; const t = [];
    const c = (n, l, h) => { if (n) t.push(`<li><a href="${h}"><b>${n}</b> ${l} →</a></li>`); };
    c(db.submissions.filter(s => s.status === 'SUBMITTED').length, 'submissions need an offer', '#/admin/submissions?f=SUBMITTED');
    c(db.submissions.filter(s => s.status === 'PICKUP_SCHEDULED').length, 'pickups to collect', '#/admin/submissions?f=PICKUP_SCHEDULED');
    c(db.submissions.filter(s => s.status === 'COLLECTED').length, 'toys waiting for Quality Seal inspection', '#/admin/submissions?f=COLLECTED');
    c(db.products.filter(p => p.source === 'p2p' && p.status === 'pending').length, 'community listings to moderate', '#/admin/p2p');
    c(db.orders.filter(o => o.status === 'CONFIRMED').length, 'orders to pack', '#/admin/orders');
    c(db.orders.filter(o => o.ret && o.ret.status === 'REQUESTED').length, 'return requests', '#/admin/orders?f=returns');
    c(db.leads.filter(l => l.status === 'NEW').length, 'new business leads', '#/admin/leads'); return t; }

  /* ---------- Acquisitions ---------- */
  Admin.views.submissions = (route) => {
    const f = route.q.f || ''; let list = S.db.submissions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)); if (f) list = list.filter(s => s.status === f);
    const statuses = [...App.SUB_FLOW, 'DECLINED', 'REJECTED', 'RECYCLED'];
    return `<h2>Acquisition queue</h2><p class="muted">Offer → pickup → collect → 5-point inspection → grade & price → publish → pay seller.</p>
      <div class="chips mt"><a class="chip ${!f ? 'on' : ''}" href="#/admin/submissions">All (${S.db.submissions.length})</a>${statuses.map(s => { const n = S.db.submissions.filter(x => x.status === s).length; return n ? `<a class="chip ${f === s ? 'on' : ''}" href="#/admin/submissions?f=${s}">${s.replace(/_/g, ' ').toLowerCase()} (${n})</a>` : ''; }).join('')}</div>
      <div class="table-wrap"><table><thead><tr><th>Toy</th><th>Seller</th><th>MRP</th><th>Valuation</th><th>Offer</th><th>Pickup</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(s => { const u = S.user(s.userId) || {}; return `<tr><td><div class="row gap">${s.photos[0] ? `<img class="thumb sm" src="${s.photos[0]}" alt="">` : ''}<div><b>${esc(s.toyName)}</b><small>${s.id} · ${esc(s.brand || '')} · ${esc(s.condition)}</small></div></div></td><td>${esc(u.name)}<small>${esc(u.phone || '')}</small></td><td>${inr(s.mrp)}</td>
        <td>${inr(s.valuation.low)}–${inr(s.valuation.high)}</td><td>${s.offer ? inr(s.offer) : '—'}</td><td><small>${s.pickup ? UI.date(s.pickup.date) + '<br>' + esc(s.pickup.slot) : '—'}</small></td><td>${UI.statusPill(s.status)}</td>
        <td class="actions">${subActions(s)}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">Nothing here.</td></tr>'}</tbody></table></div>`;
  };
  function subActions(s) { const b = (act, l, cls) => `<button class="btn sm ${cls || 'ghost'}" data-act="${act}" data-id="${s.id}">${l}</button>`;
    return ({ SUBMITTED: b('a-offer', 'Make offer', 'dark') + b('a-reject', 'Reject'), OFFER_MADE: '<small class="muted">Waiting for seller</small>' + b('a-offer', 'Revise'), ACCEPTED: b('a-collect', 'Mark collected', 'dark'),
      PICKUP_SCHEDULED: b('a-collect', 'Mark collected', 'dark'), COLLECTED: b('a-inspect', 'Inspect (Quality Seal)', 'dark'), INSPECTED: b('a-inspect', 'Re-inspect'), LISTED: b('a-payout', 'Pay seller', 'dark') }[s.status] || '') + b('a-sub-view', 'View'); }
  A['a-sub-view'] = (el) => { const s = S.db.submissions.find(x => x.id === el.dataset.id); const u = S.user(s.userId) || {};
    UI.modal(`<h3>${esc(s.toyName)} <small class="muted">${s.id}</small></h3>${s.photos.length ? `<div class="previews">${s.photos.map(p => `<img src="${p}" alt="">`).join('')}</div>` : '<p class="small muted">No photos uploaded.</p>'}
      <p><b>Seller:</b> ${esc(u.name)} · ${esc(u.email)} · ${esc(u.phone || '')}</p><p><b>Details:</b> ${esc(s.brand)} · ${esc(s.category)} · ${esc(s.age)} · bought ${s.year} · ${esc(s.condition)} · parts: ${esc(s.completeness)}${s.box ? ' · has box' : ''}</p>
      <p><b>Notes:</b> ${esc(s.description || '—')}</p><p><b>Payout preference:</b> ${esc(s.payoutMethod)}</p>${s.pickup ? `<p><b>Pickup:</b> ${UI.date(s.pickup.date)}, ${esc(s.pickup.slot)}, ${esc(s.pickup.address)}</p>` : ''}
      <h4>History</h4><ul class="small">${s.history.map(h => `<li>${UI.dateTime(h.at)}: ${esc(h.status.replace(/_/g, ' ').toLowerCase())} ${h.note ? '· ' + esc(h.note) : ''}</li>`).join('')}</ul>`, { wide: true }); };
  A['a-offer'] = (el) => { const s = S.db.submissions.find(x => x.id === el.dataset.id);
    UI.modal(`<h3>Offer for ${esc(s.toyName)}</h3><p class="small muted">Instant valuation ${inr(s.valuation.low)}–${inr(s.valuation.high)} (${R.valuationMin * 100}–${R.valuationMax * 100}% of MRP ${inr(s.mrp)}).</p>
      <form data-form="a-offer" data-id="${s.id}"><label>Offer amount (₹)<input type="number" name="amount" required min="0" value="${s.offer || s.valuation.high}"></label><label>Note to seller<input name="note" value="Based on your photos and description."></label><button class="btn dark full">Send offer</button></form>`); };
  F['a-offer'] = (f, d) => { const s = S.db.submissions.find(x => x.id === f.dataset.id); s.offer = Number(d.amount); s.offerNote = d.note; s.status = 'OFFER_MADE'; s.history.push({ status: 'OFFER_MADE', at: S.now(), note: inr(s.offer) });
    S.notify(s.userId, 'New offer for ' + s.toyName, `Pretoy offers ${inr(s.offer)}. Accept or decline from My Sales.`, '#/my-sales'); S.save(); UI.closeModal(); UI.toast('Offer sent to seller'); App.rerender(); };
  A['a-reject'] = async (el) => { const s = S.db.submissions.find(x => x.id === el.dataset.id); const why = await UI.prompt('Reject submission', 'Reason shown to seller', 'This toy is not something we can refurbish right now.'); if (why == null) return;
    s.status = 'REJECTED'; s.closeNote = why; s.history.push({ status: 'REJECTED', at: S.now(), note: why }); S.notify(s.userId, 'Update on ' + s.toyName, why + ' You can still list it on the community marketplace.', '#/list'); S.save(); App.rerender(); };
  A['a-collect'] = (el) => { const s = S.db.submissions.find(x => x.id === el.dataset.id); s.status = 'COLLECTED'; s.history.push({ status: 'COLLECTED', at: S.now(), note: 'Collected by pickup partner' });
    S.notify(s.userId, 'We’ve collected ' + s.toyName + ' 📦', 'It’s off to our workshop for its 5-point inspection.', '#/my-sales'); S.save(); UI.toast('Marked collected'); App.rerender(); };
  A['a-inspect'] = (el) => { const s = S.db.submissions.find(x => x.id === el.dataset.id); const seal = s.seal || {};
    UI.modal(`<h3>🛡️ Quality Seal inspection</h3><p class="muted">${esc(s.toyName)} · MRP ${inr(s.mrp)} · seller described: ${esc(s.condition)}, parts ${esc(s.completeness)}</p>
      <form data-form="a-inspect" data-id="${s.id}" id="inspf">${R.seal.map(x => `<div class="sealin"><div><b>${x.icon} ${x.name}</b><small>${x.desc}</small></div><div class="scores">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="${x.key}" value="${n}" ${Number(seal[x.key] || 5) === n ? 'checked' : ''} data-act-change="grade"><span>${n}</span></label>`).join('')}</div></div>`).join('')}
      <label>Inspector notes (printed on certificate)<input name="notes" value="${esc(seal.notes || 'Deep-cleaned, sanitised and tested.')}"></label>
      <div class="form-grid"><label>Listing title<input name="name" value="${esc(s.toyName)}" required></label><label>Inspector<input name="inspector" value="${esc(S.currentUser().name)}" required></label>
      <label>Resale price (₹)<input name="price" type="number" id="pricein" required min="0"></label><label>Emoji / art<input name="emoji" value="🧸" maxlength="4"></label>
      <label class="check"><input type="checkbox" name="rentable" checked> Also available to rent</label></div>
      <div id="gradeout" class="note"></div><div class="row gap end"><button type="button" class="btn ghost" data-act="a-recycle" data-id="${s.id}">Fails: recycle</button><button class="btn dark">Certify & publish</button></div></form>`, { wide: true });
    A['ch-grade'](); };
  A['ch-grade'] = () => { const f = $('#inspf'); if (!f) return; const d = UI.form(f); const g = S.gradeFromSeal(d); const s = S.db.submissions.find(x => x.id === f.dataset.id); const out = $('#gradeout');
    if (g === 'FAIL') { out.className = 'note bad'; out.innerHTML = '<b>Fails the Quality Seal.</b> Safety and Hygiene must score 3 or more. Recycle or return to seller.'; return; }
    const price = Math.round(s.mrp * R.resaleByGrade[g] / 10) * 10 - 1; $('#pricein').value = $('#pricein').dataset.touched ? $('#pricein').value : price;
    const margin = Number($('#pricein').value) - (s.offer || 0);
    out.className = 'note'; out.innerHTML = `Computed grade <span class="g g-${g}">Grade ${g} · ${R.gradeLabels[g]}</span> · suggested price <b>${inr(price)}</b> (${Math.round(R.resaleByGrade[g] * 100)}% of MRP, ${UI.off(s.mrp, price)}% off). Gross margin vs. offer: <b>${inr(margin)}</b>`; };
  document.addEventListener('input', e => { if (e.target.id === 'pricein') { e.target.dataset.touched = '1'; A['ch-grade'](); } });
  F['a-inspect'] = (f, d) => { const s = S.db.submissions.find(x => x.id === f.dataset.id); const g = S.gradeFromSeal(d); if (g === 'FAIL') throw new Error('This toy fails Safety or Hygiene and cannot be certified.');
    const seal = { safety: +d.safety, hygiene: +d.hygiene, parts: +d.parts, function: +d.function, packaging: +d.packaging, notes: d.notes };
    const colors = ['#f6d6a8', '#cfe0f5', '#f7d7d9', '#e3efd3', '#d8ecf0', '#f5e4c9', '#efe1f0', '#e6eadb'];
    const p = { id: S.nextId('P'), name: d.name, brand: s.brand || 'Pre-loved', category: s.category, age: s.age, mrp: s.mrp, price: Number(d.price), grade: g, emoji: d.emoji || '🧸', color: colors[S.db.products.length % colors.length],
      description: (s.description ? s.description + ' ' : '') + 'Inspected, sanitised and certified by Pretoy.', images: s.photos.slice(), source: 'certified', status: 'live', seal,
      certCode: 'PTY-' + (26000 + S.db.products.length * 7) + '-' + g, inspectedAt: S.now(), inspector: d.inspector, rentable: !!d.rentable, createdAt: S.now(), views: 0, fromSubmission: s.id };
    S.db.products.push(p); s.seal = seal; s.productId = p.id; s.status = 'LISTED'; s.history.push({ status: 'INSPECTED', at: S.now(), note: 'Grade ' + g }, { status: 'LISTED', at: S.now(), note: p.certCode });
    S.notify(s.userId, s.toyName + ' passed inspection ✓', `Grade ${g}: ${R.gradeLabels[g]}. Your payout of ${inr(s.offer)} is being processed.`, '#/my-sales');
    S.save(); UI.closeModal(); UI.toast('Certified ' + p.certCode + ' and published'); App.rerender(); };
  A['a-recycle'] = async (el) => { const s = S.db.submissions.find(x => x.id === el.dataset.id); UI.closeModal(); if (!await UI.confirm('Mark as failed?', 'The toy goes to our recycling partner. The seller is still paid the agreed goodwill amount.', 'Recycle')) return;
    s.status = 'RECYCLED'; s.closeNote = 'Did not pass Safety/Hygiene. Sent for responsible recycling. A goodwill amount of ' + inr(Math.round((s.offer || 0) * 0.3)) + ' was credited.'; const u = S.user(s.userId); u.storeCredit += Math.round((s.offer || 0) * 0.3);
    s.history.push({ status: 'RECYCLED', at: S.now() }); S.notify(s.userId, 'Inspection update: ' + s.toyName, s.closeNote, '#/my-sales'); S.save(); App.rerender(); };
  A['a-payout'] = (el) => { const s = S.db.submissions.find(x => x.id === el.dataset.id); const u = S.user(s.userId); const credit = s.payoutMethod === 'credit'; const amt = credit ? Math.round(s.offer * 1.1) : s.offer;
    s.status = 'PAID'; s.finalAmount = amt; s.payoutRef = credit ? 'store credit' : (s.payoutMethod === 'bank' ? 'NEFT' : 'UPI') + ' TEST-' + Date.now().toString().slice(-6); if (credit) u.storeCredit += amt;
    s.history.push({ status: 'PAID', at: S.now(), note: inr(amt) + ' via ' + s.payoutRef }); S.notify(s.userId, 'Payout sent 💸', `${inr(amt)} for ${s.toyName} via ${s.payoutRef}.`, '#/my-sales'); S.save(); UI.toast('Seller paid ' + inr(amt)); App.rerender(); };

  /* ---------- Inventory ---------- */
  Admin.views.inventory = (route) => { const q = (route.q.q || '').toLowerCase(); const st = route.q.s || 'live';
    let list = S.db.products.filter(p => p.source === 'certified'); if (st !== 'all') list = list.filter(p => p.status === st); if (q) list = list.filter(p => (p.name + p.brand + p.certCode).toLowerCase().includes(q));
    return `<div class="row between wrapit"><h2>Certified inventory</h2><form class="row gap" data-form="a-invsearch"><input name="q" placeholder="Search name, brand, certificate" value="${esc(route.q.q || '')}"><button class="btn ghost sm">Search</button></form></div>
      <div class="chips mt">${['live', 'sold', 'rented', 'unlisted', 'all'].map(s => `<a class="chip ${st === s ? 'on' : ''}" href="#/admin/inventory?s=${s}">${s} (${s === 'all' ? S.db.products.filter(p => p.source === 'certified').length : S.db.products.filter(p => p.source === 'certified' && p.status === s).length})</a>`).join('')}</div>
      <div class="table-wrap"><table><thead><tr><th>Toy</th><th>Grade</th><th>MRP</th><th>Price</th><th>Certificate</th><th>Rent</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr><td><div class="row gap"><span class="mini" style="--tile:${p.color}">${p.emoji}</span><div><a href="#/toy/${p.id}"><b>${esc(p.name)}</b></a><small>${p.id} · ${esc(p.category)} · ${p.views} views</small></div></div></td><td><span class="g g-${p.grade}">${p.grade}</span></td><td>${inr(p.mrp)}</td><td>${inr(p.price)}<small>${UI.off(p.mrp, p.price)}% off</small></td>
        <td><a href="#/certificate/${p.certCode}">${esc(p.certCode)}</a></td><td><input type="checkbox" data-act-change="a-rentable" data-id="${p.id}" ${p.rentable ? 'checked' : ''} aria-label="Rentable"></td><td>${UI.statusPill(p.status)}</td>
        <td class="actions"><button class="btn sm ghost" data-act="a-price" data-id="${p.id}">Price</button>${p.status === 'live' ? `<button class="btn sm ghost" data-act="a-unlist" data-id="${p.id}">Unlist</button>` : p.status === 'unlisted' ? `<button class="btn sm ghost" data-act="a-relist" data-id="${p.id}">Relist</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">No products.</td></tr>'}</tbody></table></div>`; };
  F['a-invsearch'] = (f, d) => App.go('#/admin/inventory?s=all&q=' + encodeURIComponent(d.q || ''));
  A['a-price'] = async (el) => { const p = S.product(el.dataset.id); const v = await UI.prompt('Update price', `Price for ${p.name} (MRP ${inr(p.mrp)})`, p.price, 'number'); if (!v) return; p.price = Number(v); S.save(); App.rerender(); };
  A['a-unlist'] = (el) => { S.product(el.dataset.id).status = 'unlisted'; S.save(); App.rerender(); };
  A['a-relist'] = (el) => { S.product(el.dataset.id).status = 'live'; S.save(); App.rerender(); };
  A['ch-a-rentable'] = (el) => { S.product(el.dataset.id).rentable = el.checked; S.save(); UI.toast(el.checked ? 'Available to rent' : 'Removed from rental pool'); };

  /* ---------- P2P moderation ---------- */
  Admin.views.p2p = () => { const pend = S.db.products.filter(p => p.source === 'p2p' && p.status === 'pending'); const rest = S.db.products.filter(p => p.source === 'p2p' && p.status !== 'pending');
    const row = p => `<tr><td><div class="row gap">${p.images[0] ? `<img class="thumb sm" src="${p.images[0]}" alt="">` : `<span class="mini" style="--tile:${p.color}">${p.emoji}</span>`}<div><b>${esc(p.name)}</b><small>${esc(p.brand)} · ${esc(p.category)} · ${esc(p.condition)}</small></div></div></td><td>${esc(S.sellerName(p.sellerId))}</td><td>${inr(p.price)}</td><td>${Math.round(p.commissionPct * 100)}% · ${inr(p.price * p.commissionPct)}</td><td>${UI.statusPill(p.status)}</td>
      <td class="actions">${p.status === 'pending' ? `<button class="btn sm dark" data-act="a-approve" data-id="${p.id}">Approve</button><button class="btn sm ghost" data-act="a-decline" data-id="${p.id}">Reject</button>` : p.status === 'live' ? `<button class="btn sm ghost" data-act="a-takedown" data-id="${p.id}">Take down</button>` : ''}<a class="btn sm ghost" href="#/toy/${p.id}">View</a></td></tr>`;
    const head = '<thead><tr><th>Listing</th><th>Seller</th><th>Price</th><th>Commission</th><th>Status</th><th></th></tr></thead>';
    return `<h2>Community (P2P) moderation</h2><p class="muted">Check photos and description for safety, honesty and prohibited items before approving.</p>
      <h3 class="mt">Awaiting review (${pend.length})</h3><div class="table-wrap"><table>${head}<tbody>${pend.map(row).join('') || '<tr><td colspan="6" class="muted">Queue is empty ✨</td></tr>'}</tbody></table></div>
      <h3 class="mt">All community listings</h3><div class="table-wrap"><table>${head}<tbody>${rest.map(row).join('')}</tbody></table></div>`; };
  A['a-approve'] = (el) => { const p = S.product(el.dataset.id); p.status = 'live'; p.createdAt = S.now(); S.notify(p.sellerId, 'Your listing is live ✓', p.name + ' is now visible to buyers.', '#/toy/' + p.id); S.save(); UI.toast('Approved'); App.rerender(); };
  A['a-decline'] = async (el) => { const p = S.product(el.dataset.id); const why = await UI.prompt('Reject listing', 'Reason shown to seller', 'Photos are unclear, please re-upload clear photos.'); if (why == null) return;
    p.status = 'rejected'; p.rejectReason = why; S.notify(p.sellerId, 'Listing not approved', p.name + ': ' + why, '#/my-sales'); S.save(); App.rerender(); };
  A['a-takedown'] = (el) => { const p = S.product(el.dataset.id); p.status = 'delisted'; S.notify(p.sellerId, 'Listing removed', p.name + ' was removed by Pretoy moderation.', '#/my-sales'); S.save(); App.rerender(); };

  /* ---------- Orders & returns ---------- */
  Admin.views.orders = (route) => { const f = route.q.f || ''; let list = S.db.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (f === 'returns') list = list.filter(o => o.ret); else if (f) list = list.filter(o => o.status === f);
    return `<h2>Orders & returns</h2><div class="chips mt"><a class="chip ${!f ? 'on' : ''}" href="#/admin/orders">All (${S.db.orders.length})</a>${App.ORDER_FLOW.concat('CANCELLED').map(s => { const n = S.db.orders.filter(o => o.status === s).length; return n ? `<a class="chip ${f === s ? 'on' : ''}" href="#/admin/orders?f=${s}">${s.replace(/_/g, ' ').toLowerCase()} (${n})</a>` : ''; }).join('')}<a class="chip ${f === 'returns' ? 'on' : ''}" href="#/admin/orders?f=returns">returns (${S.db.orders.filter(o => o.ret).length})</a></div>
      <div class="table-wrap"><table><thead><tr><th>Order</th><th>Buyer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(o => { const u = S.user(o.userId) || {}; const nxt = App.ORDER_FLOW[App.ORDER_FLOW.indexOf(o.status) + 1];
        return `<tr><td><a href="#/order/${o.id}"><b>${o.id}</b></a><small>${UI.dateTime(o.createdAt)}</small>${o.gift.price ? '<small>🎁 gift</small>' : ''}</td><td>${esc(u.name)}<small>${esc(o.address.city)}</small></td><td>${o.items.map(i => esc(i.name)).join('<br>')}</td><td>${inr(o.total)}</td><td><small>${esc(o.payment.method)}<br>${esc(o.payment.status)}</small></td>
        <td>${UI.statusPill(o.status)}${o.ret ? `<br>${UI.statusPill('RETURN_' + o.ret.status)}<small>${esc(o.ret.reason)}</small>` : ''}</td>
        <td class="actions">${nxt && o.status !== 'CANCELLED' ? `<button class="btn sm dark" data-act="a-advance" data-id="${o.id}">Mark ${nxt.replace(/_/g, ' ').toLowerCase()}</button>` : ''}${o.ret && o.ret.status === 'REQUESTED' ? `<button class="btn sm dark" data-act="a-refund" data-id="${o.id}">Approve & refund</button><button class="btn sm ghost" data-act="a-rejret" data-id="${o.id}">Reject return</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">No orders.</td></tr>'}</tbody></table></div>`; };
  A['a-advance'] = (el) => { const o = S.db.orders.find(x => x.id === el.dataset.id); const nxt = App.ORDER_FLOW[App.ORDER_FLOW.indexOf(o.status) + 1]; if (!nxt) return;
    o.status = nxt; o.history.push({ status: nxt, at: S.now() });
    if (nxt === 'SHIPPED') { o.courier = ['Delhivery', 'Blue Dart', 'Shadowfax'][o.id.length % 3]; o.awb = 'AWB' + Date.now().toString().slice(-9); }
    if (nxt === 'DELIVERED') { o.deliveredAt = S.now(); if (o.payment.status === 'DUE_ON_DELIVERY') o.payment.status = 'PAID';
      o.items.filter(i => i.source === 'p2p').forEach(i => { const p = S.product(i.productId); S.db.payouts.push({ id: S.nextId('PO'), userId: p.sellerId, productId: p.id, amount: Math.round(i.price * (1 - p.commissionPct)), at: S.now(), releaseAfter: new Date(Date.now() + R.returnDays * 86400000).toISOString() }); }); }
    const msg = { PACKED: 'Your toys are packed and ready 📦', SHIPPED: 'Your order is on the way 🚚', OUT_FOR_DELIVERY: 'Out for delivery today! 🛵', DELIVERED: 'Delivered 🎉 Enjoy playtime!' }[nxt];
    S.notify(o.userId, msg + ' · ' + o.id, nxt === 'DELIVERED' ? `Not happy? Return within ${R.returnDays} days.` : o.courier ? `${o.courier} · ${o.awb}` : '', '#/order/' + o.id); S.save(); App.rerender(); };
  A['a-refund'] = (el) => { const o = S.db.orders.find(x => x.id === el.dataset.id); o.ret.status = 'REFUNDED'; o.ret.refundedAt = S.now(); o.status = 'RETURNED'; o.history.push({ status: 'RETURNED', at: S.now() });
    if (o.ret.toCredit) S.user(o.userId).storeCredit += o.ret.amount; else o.payment.status = 'REFUNDED';
    o.items.forEach(i => { const p = S.product(i.productId); if (p) { p.status = p.source === 'certified' ? 'live' : 'delisted'; } S.db.payouts = S.db.payouts.filter(po => po.productId !== i.productId); });
    S.notify(o.userId, 'Refund processed ✓', `${inr(o.ret.amount)} refunded to ${o.ret.to} for ${o.id}.`, '#/order/' + o.id); S.save(); UI.toast('Refunded and restocked'); App.rerender(); };
  A['a-rejret'] = async (el) => { const o = S.db.orders.find(x => x.id === el.dataset.id); const why = await UI.prompt('Reject return', 'Reason shown to buyer', 'Item returned in a different condition than delivered.'); if (why == null) return;
    o.ret.status = 'REJECTED'; o.ret.adminNote = why; S.notify(o.userId, 'Return not approved', why, '#/order/' + o.id); S.save(); App.rerender(); };

  /* ---------- Rentals ---------- */
  Admin.views.rentals = () => `<h2>Rental subscriptions</h2><div class="kpis">${R.rentalPlans.map(p => `<div><small>${p.name}</small><b>${S.db.rentals.filter(r => r.plan === p.id && r.status === 'ACTIVE').length}</b><em>${inr(p.price)}/mo</em></div>`).join('')}<div><small>Toys in rental pool</small><b>${S.db.products.filter(p => p.rentable && ['live', 'rented'].includes(p.status)).length}</b><em>${S.db.products.filter(p => p.status === 'rented').length} out now</em></div></div>
    <div class="table-wrap"><table><thead><tr><th>ID</th><th>Subscriber</th><th>Plan</th><th>Toys in box</th><th>Box</th><th>Next billing</th><th>Status</th><th></th></tr></thead><tbody>
    ${S.db.rentals.map(r => { const u = S.user(r.userId) || {}; const p = R.rentalPlans.find(x => x.id === r.plan); return `<tr><td>${r.id}</td><td>${esc(u.name)}</td><td>${p.name}</td><td>${r.toys.map(id => esc((S.product(id) || {}).name)).join('<br>') || '—'}</td><td>${UI.statusPill(r.boxStatus || 'PREPARING')}</td><td>${UI.date(r.nextBilling)}</td><td>${UI.statusPill(r.status)}</td>
      <td class="actions">${r.status === 'ACTIVE' && r.toys.length && r.boxStatus !== 'DELIVERED' ? `<button class="btn sm dark" data-act="a-box" data-id="${r.id}">Mark box delivered</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">No subscribers yet. Try subscribing from the Rent page.</td></tr>'}</tbody></table></div>`;
  A['a-box'] = (el) => { const r = S.db.rentals.find(x => x.id === el.dataset.id); r.boxStatus = 'DELIVERED'; S.notify(r.userId, 'Your rental box has arrived 📦', 'Have fun! Swap anytime from your Rental box page.', '#/rent'); S.save(); App.rerender(); };

  /* ---------- Leads ---------- */
  Admin.views.leads = () => `<h2>Business & CSR leads</h2><div class="table-wrap"><table><thead><tr><th>Organisation</th><th>Contact</th><th>Bundle</th><th>Qty</th><th>Est. value</th><th>Message</th><th>Status</th></tr></thead><tbody>
    ${S.db.leads.map(l => { const b = R.bundles.find(x => x.id === l.bundle) || {}; return `<tr><td><b>${esc(l.org)}</b><small>${UI.date(l.at)}</small></td><td>${esc(l.name)}<small>${esc(l.email)} ${esc(l.phone || '')}</small></td><td>${b.emoji || ''} ${esc(b.name || l.bundle)}</td><td>${l.qty}</td><td>${inr((b.from || 0) * l.qty)}</td><td><small>${esc(l.message || '')}</small></td>
      <td><select data-act-change="a-lead" data-id="${l.id}">${['NEW', 'CONTACTED', 'PROPOSAL_SENT', 'WON', 'LOST'].map(s => `<option ${l.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">No leads yet.</td></tr>'}</tbody></table></div>`;
  A['ch-a-lead'] = (el) => { S.db.leads.find(l => l.id === el.dataset.id).status = el.value; S.save(); UI.toast('Lead updated'); };

  /* ---------- Users ---------- */
  Admin.views.users = () => `<h2>Users</h2><div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Orders</th><th>Sold to us</th><th>Listings</th><th>Store credit</th><th>Marketing consent</th><th>Joined</th></tr></thead><tbody>
    ${S.db.users.map(u => `<tr><td><b>${esc(u.name)}</b>${u.deleted ? '<small>erased</small>' : ''}</td><td>${esc(u.email)}</td><td>${UI.statusPill(u.role)}</td><td>${S.db.orders.filter(o => o.userId === u.id).length}</td><td>${S.db.submissions.filter(s => s.userId === u.id).length}</td><td>${S.db.products.filter(p => p.sellerId === u.id).length}</td><td>${inr(u.storeCredit)}</td><td>${u.consent.marketing ? '✓' : '—'}</td><td>${UI.date(u.createdAt)}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">Passwords are stored only as salted SHA-256 hashes, never in plain text.</p>`;

  /* ---------- Outbox ---------- */
  Admin.views.outbox = () => `<h2>Notifications outbox</h2><p class="muted">Every email/SMS the platform would send. In this POC they are logged here instead of being delivered.</p>
    ${S.db.outbox.slice(0, 80).map(m => `<div class="mail"><div class="row between"><b>${esc(m.subject)}</b><small>${UI.dateTime(m.at)}</small></div><small class="muted">To: ${esc(m.to)} · ${m.channel}</small><p>${esc(m.body)}</p></div>`).join('') || '<p class="muted">Nothing sent yet.</p>'}`;

  /* ---------- Data ---------- */
  Admin.views.data = () => `<h2>Data & backup</h2><div class="acctgrid"><div class="panel"><h3>💾 Where is the data?</h3><p>Everything is stored in this browser's <code>localStorage</code> (about <b>${S.storageUsedKB()} KB</b> used of ~5,000 KB). There is no server or database.</p>
      <p class="small muted">Use Export to save a backup JSON to any folder (for example a <code>Pretoy-Data</code> folder on your Desktop), and Import to load it on another computer or browser.</p>
      <div class="row gap wrapit"><button class="btn dark" data-act="a-export">Export backup (.json)</button><label class="btn ghost">Import backup<input type="file" accept="application/json,.json" hidden data-act-change="a-import"></label></div></div>
    <div class="panel"><h3>🔄 Reset demo</h3><p>Restore the original demo accounts, toys, orders and submissions. All changes in this browser are lost.</p><button class="btn danger" data-act="a-reset">Reset demo data</button></div>
    <div class="panel"><h3>🎟️ Active coupons</h3>${Object.entries(R.coupons).map(([k, c]) => `<p><code>${k}</code> ${esc(c.desc)}</p>`).join('')}</div>
    <div class="panel"><h3>⚙️ Business rules</h3><ul class="small"><li>Instant valuation: ${R.valuationMin * 100}–${R.valuationMax * 100}% of MRP</li><li>Resale: A ${R.resaleByGrade.A * 100}%, B ${R.resaleByGrade.B * 100}%, C ${R.resaleByGrade.C * 100}% of MRP</li><li>P2P commission: 15% / 12% / 10%</li><li>Gift boxes: ₹99 / ₹149 / ₹199</li><li>Rentals: ₹499 / ₹749 / ₹999 per month</li><li>Returns: ${R.returnDays} days · free shipping above ${inr(R.freeShippingAbove)}</li></ul><p class="small muted">Edit these in <code>js/store.js</code> (RULES).</p></div></div>`;
  A['a-export'] = () => { UI.download('pretoy-backup-' + new Date().toISOString().slice(0, 10) + '.json', S.exportJSON()); UI.toast('Backup downloaded'); };
  A['ch-a-import'] = (el) => { const f = el.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { S.importJSON(r.result); UI.toast('Backup imported'); App.render(); } catch (e) { UI.toast(e.message, 'error'); } }; r.readAsText(f); };
  A['a-reset'] = async () => { if (!await UI.confirm('Reset all demo data?', 'This restores the original demo and logs you out.', 'Reset')) return; await S.reset(); UI.toast('Demo data restored'); App.go('#/login'); };

  // admin bell notifications are marked read from the shared Notifications page
  Admin.adminNotify = adminNotify;
})();
