/* Pretoy v2 customer actions and form handlers. */
(function () {
  'use strict';
  const UI = window.PretoyUI, S = window.Store, R = S.RULES, App = window.PretoyApp;
  const { esc, inr, $ } = UI;
  const A = App.actions, F = App.forms;
  const me = () => S.currentUser();
  let pendingPhotos = [];

  /* navigation & header */
  A['toggle-menu'] = () => $('#acctmenu').classList.toggle('open');
  A.burger = () => $('#mainnav').classList.toggle('open');
  A.logout = () => { S.logout(); UI.toast('Logged out. See you soon!'); App.go('#/'); };
  A['close-modal'] = () => UI.closeModal();
  A.print = () => window.print();
  A['toggle-filters'] = () => $('#filters').classList.toggle('open');
  F.hsearch = (f, d) => App.go('#/shop' + (d.q ? '?q=' + encodeURIComponent(d.q) : ''));

  /* shop filters */
  function filterHash() { const f = document.querySelector('[data-form=filters]'); const d = UI.form(f); const p = new URLSearchParams();
    ['q', 'cat', 'age', 'grade', 'src'].forEach(k => { if (d[k]) p.set(k, d[k]); }); if (Number(d.max) < 4000) p.set('max', d.max); if (d.rent) p.set('rent', '1');
    const cur = new URLSearchParams((location.hash.split('?')[1]) || ''); if (cur.get('sort')) p.set('sort', cur.get('sort')); return '#/shop' + (p.toString() ? '?' + p : ''); }
  A['ch-filter'] = (el, e) => { if (el.name === 'max') { $('#maxv').textContent = Number(el.value) >= 4000 ? 'any' : inr(el.value); if (e.type === 'input') return; } if (e.type === 'change') { App._keepScroll = true; location.hash = filterHash(); } };
  F.filters = () => { location.hash = filterHash(); };
  A['ch-sort'] = (el) => { const [p, qs] = location.hash.split('?'); const q = new URLSearchParams(qs || ''); q.set('sort', el.value); App._keepScroll = true; location.hash = p + '?' + q; };

  /* wishlist + cart */
  A.fav = (el) => { const u = me(); if (!u) return App.requireLogin('Log in to save toys to your wishlist.'); const id = el.dataset.id;
    if (u.wishlist.includes(id)) { u.wishlist = u.wishlist.filter(x => x !== id); UI.toast('Removed from wishlist'); } else { u.wishlist.push(id); UI.toast('Saved to wishlist ♥'); } S.save(); App.rerender(); };
  A['add-cart'] = (el) => { const p = S.product(el.dataset.id); if (!p || p.status !== 'live') return UI.toast('Sorry, this toy is no longer available.', 'error');
    const u = me(); if (u && p.sellerId === u.id) return UI.toast('This is your own listing.', 'error');
    if (S.cart().includes(p.id)) return UI.toast('Already in your cart. Each toy is one of a kind!'); S.addToCart(p.id); UI.toast('Added to cart 🛒'); App.rerender(); };
  A['buy-now'] = (el) => { A['add-cart'](el); App.go('#/cart'); };
  A['rm-cart'] = (el) => { S.removeFromCart(el.dataset.id); App.rerender(); };
  A['ch-gift'] = (el) => { App.checkout.gift = el.value; App.rerender(); };
  A['ch-giftnote'] = (el) => { App.checkout.note = el.value; };
  A['ch-credit'] = (el) => { App.checkout.useCredit = el.checked; App.rerender(); };
  F.coupon = (f, d) => { App.checkout.coupon = (d.code || '').toUpperCase(); App.rerender(); };
  A['to-checkout'] = () => App.go('#/checkout');

  F['place-order'] = async (f, d) => {
    const u = me(); const items = S.cart().map(S.product).filter(p => p && p.status === 'live'); if (!items.length) return App.go('#/cart');
    let address = u.addresses.find(a => a.id === d.addr);
    if (!address) { if (!d.line || !d.city || !/^\d{6}$/.test(d.pin || '')) throw new Error('Please enter a full address with a 6-digit PIN code.');
      address = { id: 'A' + Date.now().toString(36), label: 'Home', line: d.line, city: d.city, pin: d.pin }; if (d.saveaddr) u.addresses.push(address); }
    u.phone = d.phone || u.phone;
    const ck = App.checkout; const subtotal = items.reduce((a, p) => a + p.price, 0); const gift = R.gift.find(g => g.id === ck.gift) || R.gift[0];
    const shipping = subtotal >= R.freeShippingAbove ? 0 : R.shippingFee; const c = R.coupons[(ck.coupon || '').toUpperCase()];
    let discount = 0; if (c && !(c.min && subtotal < c.min)) discount = c.pct ? Math.round(subtotal * c.pct / 100) : Math.min(c.flat, subtotal);
    const credit = ck.useCredit ? Math.min(u.storeCredit || 0, subtotal + shipping + gift.price - discount) : 0;
    const total = Math.max(0, subtotal + shipping + gift.price - discount - credit);
    let payment; try { payment = await App.pay(total, d.pay, items.length + ' toy(s) from Pretoy'); } catch (err) { UI.toast(err.message + ' Your cart is saved, try again.', 'error'); return; }
    const o = { id: S.nextId('ORD'), userId: u.id, items: items.map(p => ({ productId: p.id, name: p.name, price: p.price, emoji: p.emoji, color: p.color, source: p.source, grade: p.grade, sellerId: p.sellerId })),
      address, gift: { tier: gift.id, price: gift.price, note: ck.note || '' }, subtotal, shipping, discount, coupon: discount ? ck.coupon : '', credit, total, payment,
      status: 'CONFIRMED', createdAt: S.now(), history: [{ status: 'PLACED', at: S.now() }, { status: 'CONFIRMED', at: S.now() }] };
    S.db.orders.push(o); items.forEach(p => { p.status = 'sold'; p.soldAt = S.now(); });
    if (credit) u.storeCredit -= credit;
    S.db.carts[u.id] = []; App.checkout = { gift: 'none', note: '', coupon: '', useCredit: false };
    S.notify(u.id, 'Order confirmed 🎉 ' + o.id, `${items.length} toy(s), total ${inr(total)}. We'll let you know when it ships.`, '#/order/' + o.id);
    S.db.notifications.unshift({ id: S.nextId('N'), userId: 'admin', title: 'New order ' + o.id, body: `${u.name} · ${inr(total)} · ${items.map(i => i.name).join(', ')}`, link: '#/admin/orders', at: S.now(), read: false });
    items.filter(p => p.source === 'p2p').forEach(p => S.notify(p.sellerId, 'Your listing sold! 🎉', `${p.name} sold for ${inr(p.price)}. You'll earn ${inr(p.price * (1 - p.commissionPct))} after the ${R.returnDays}-day return window.`, '#/my-sales'));
    S.save(); UI.toast('Payment successful. Order placed!'); App.go('#/order/' + o.id);
  };

  /* orders */
  A['cancel-order'] = async (el) => { const o = S.db.orders.find(x => x.id === el.dataset.id); if (!await UI.confirm('Cancel this order?', 'The toy goes back on sale and any payment is refunded (test mode).', 'Cancel order')) return;
    o.status = 'CANCELLED'; o.history.push({ status: 'CANCELLED', at: S.now() }); if (o.payment.status === 'PAID') o.payment.status = 'REFUNDED';
    o.items.forEach(i => { const p = S.product(i.productId); if (p) p.status = 'live'; }); const u = S.user(o.userId); if (o.credit) u.storeCredit += o.credit;
    S.notify(o.userId, 'Order ' + o.id + ' cancelled', 'Your refund has been processed (test mode).', '#/order/' + o.id); S.save(); App.rerender(); };
  A.return = (el) => { const o = S.db.orders.find(x => x.id === el.dataset.id);
    UI.modal(`<h3>Return order ${o.id}</h3><form data-form="return" data-id="${o.id}"><label>Reason<select name="reason" required><option>Not as described</option><option>Missing parts</option><option>Not working properly</option><option>Child lost interest / changed my mind</option><option>Received wrong item</option><option>Other</option></select></label>
      <label>Details<textarea name="details" placeholder="Help us improve…"></textarea></label><label>Refund to<select name="to"><option value="original">Original payment method</option><option value="credit">Store credit (instant)</option></select></label>
      <label>Upload a photo (optional)<input type="file" name="photos" accept="image/*" data-act-change="photos"></label><div class="previews" id="previews"></div>
      <p class="small muted">A free pickup will be scheduled. Refund of ${inr(o.subtotal - o.discount - (o.credit || 0))} once the toy reaches us (gift box and delivery are non-refundable).</p><button class="btn dark full">Submit return request</button></form>`); };
  F.return = (f, d) => { const o = S.db.orders.find(x => x.id === f.dataset.id); const refundable = Math.max(0, o.subtotal - o.discount);
    o.ret = { reason: d.reason + (d.details ? ': ' + d.details : ''), to: d.to === 'credit' ? 'store credit' : o.payment.method, toCredit: d.to === 'credit', status: 'REQUESTED', requestedAt: S.now(), amount: refundable, photos: pendingPhotos.slice() };
    pendingPhotos = []; S.notify(o.userId, 'Return requested for ' + o.id, 'We’ll schedule a free pickup within 48 hours.', '#/order/' + o.id);
    S.db.notifications.unshift({ id: S.nextId('N'), userId: 'admin', title: 'Return request ' + o.id, body: d.reason, link: '#/admin/orders', at: S.now(), read: false });
    S.save(); UI.closeModal(); UI.toast('Return requested. We’ll be in touch.'); App.rerender(); };
  A.review = (el) => { UI.modal(`<h3>Rate this toy</h3><form data-form="review" data-id="${el.dataset.id}"><div class="ratepick">${[5, 4, 3, 2, 1].map(n => `<input type="radio" name="rating" id="r${n}" value="${n}" ${n === 5 ? 'checked' : ''}><label for="r${n}">★</label>`).join('')}</div>
    <label>Your review<textarea name="text" required maxlength="400" placeholder="How was the condition, packaging, play value?"></textarea></label><button class="btn dark full">Post review</button></form>`); };
  F.review = (f, d) => { const u = me(); S.db.reviews.push({ id: S.nextId('R'), productId: f.dataset.id, userId: u.id, name: u.name.split(' ')[0] + ' ' + (u.name.split(' ')[1] || '').charAt(0) + '.', rating: Number(d.rating), text: d.text, at: S.now() });
    S.save(); UI.closeModal(); UI.toast('Thanks for your review!'); App.rerender(); };
  A.invoice = (el) => { const o = S.db.orders.find(x => x.id === el.dataset.id); const u = S.user(o.userId);
    const rows = o.items.map(i => `<tr><td>${esc(i.name)}</td><td>${inr(i.price)}</td></tr>`).join('');
    UI.modal(`<div class="invoice" id="cert"><div class="row between"><img class="certlogo" src="img/pretoy-logo.png" alt="Pretoy"><div class="right"><b>Tax invoice (demo)</b><small class="block">${o.id} · ${UI.date(o.createdAt)}</small></div></div>
      <p class="small"><b>Billed to:</b> ${esc(u.name)}, ${esc(o.address.line)}, ${esc(o.address.city)} ${esc(o.address.pin)}</p>
      <table class="cert-table"><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>${rows}<tr><td>Delivery</td><td>${inr(o.shipping)}</td></tr>${o.gift.price ? `<tr><td>Gift box</td><td>${inr(o.gift.price)}</td></tr>` : ''}${o.discount ? `<tr><td>Discount</td><td>−${inr(o.discount)}</td></tr>` : ''}${o.credit ? `<tr><td>Store credit</td><td>−${inr(o.credit)}</td></tr>` : ''}
      <tr><th>Total (incl. GST, demo)</th><th>${inr(o.total)}</th></tr></tbody></table><p class="small muted">Payment ${esc(o.payment.method)} · Ref ${esc(o.payment.ref)} · Test mode. Pre-owned goods; GST under margin scheme in a live version.</p></div>
      <div class="row end gap"><button class="btn dark" data-act="print">Print / save PDF</button></div>`, { wide: true }); };

  /* photos */
  A['ch-photos'] = async (el) => { try { pendingPhotos = await UI.readPhotos(el.files, 4); const pv = $('#previews'); if (pv) pv.innerHTML = pendingPhotos.map(p => `<img src="${p}" alt="preview">`).join(''); } catch (e) { UI.toast(e.message, 'error'); el.value = ''; } };

  /* sell to Pretoy */
  A['ch-val'] = (el) => { const f = el.form; const d = UI.form(f); Object.assign(App.sellDraft, { mrp: d.mrp, condition: d.condition, completeness: d.completeness, box: d.box, year: d.year, brand: d.brand });
    $('#valuation').innerHTML = App.valuationCard(S.instantValuation(App.sellDraft), App.sellDraft); };
  F['submit-toy'] = (f, d) => {
    if (!App.requireLogin('Log in to submit your toy. Your answers are kept.')) return;
    const u = me(); const v = S.instantValuation(d);
    const s = { id: S.nextId('S'), userId: u.id, toyName: d.toyName, brand: d.brand, category: d.category, age: d.age, mrp: Number(d.mrp), year: Number(d.year), condition: d.condition, completeness: d.completeness, box: d.box,
      description: d.description, photos: pendingPhotos.slice(), valuation: v, status: 'SUBMITTED', payoutMethod: d.payout, createdAt: S.now(),
      pickup: { date: d.pdate, slot: d.pslot, address: d.paddr }, history: [{ status: 'SUBMITTED', at: S.now(), note: `Instant valuation ${inr(v.low)}–${inr(v.high)}` }] };
    S.db.submissions.push(s); pendingPhotos = []; App.sellDraft = { mrp: '', condition: 'good', completeness: 'complete', box: false, year: new Date().getFullYear() - 1, brand: '' };
    S.db.consentLog.push({ userId: u.id, action: 'granted', scope: 'pickup & payout processing for ' + s.id, at: S.now() });
    S.notify(u.id, 'Toy submitted: ' + s.toyName, `Valued at ${inr(v.low)}–${inr(v.high)}. Pickup requested for ${UI.date(s.pickup.date)}, ${s.pickup.slot}. We'll confirm your offer shortly.`, '#/my-sales');
    S.db.notifications.unshift({ id: S.nextId('N'), userId: 'admin', title: 'New submission ' + s.id, body: `${s.toyName} from ${u.name} (MRP ${inr(s.mrp)})`, link: '#/admin/submissions', at: S.now(), read: false });
    S.save(); UI.toast('Submitted! Track it in My sales.'); App.go('#/my-sales');
  };
  A['accept-offer'] = (el) => { const s = S.db.submissions.find(x => x.id === el.dataset.id); s.status = 'PICKUP_SCHEDULED';
    s.history.push({ status: 'ACCEPTED', at: S.now() }, { status: 'PICKUP_SCHEDULED', at: S.now(), note: `${s.pickup.date} ${s.pickup.slot}` });
    S.notify(s.userId, 'Pickup confirmed 🚚', `Our partner will collect ${s.toyName} on ${UI.date(s.pickup.date)}, ${s.pickup.slot}. Keep it ready with all parts.`, '#/my-sales');
    S.db.notifications.unshift({ id: S.nextId('N'), userId: 'admin', title: 'Offer accepted ' + s.id, body: s.toyName + ' · pickup ' + s.pickup.date, link: '#/admin/submissions', at: S.now(), read: false });
    S.save(); UI.toast('Offer accepted. Pickup booked!'); App.rerender(); };
  A['decline-offer'] = async (el) => { if (!await UI.confirm('Decline this offer?', 'Your pickup will be cancelled. You can still list the toy yourself on the community marketplace.', 'Decline')) return;
    const s = S.db.submissions.find(x => x.id === el.dataset.id); s.status = 'DECLINED'; s.closeNote = 'You declined the offer of ' + inr(s.offer) + '.'; s.history.push({ status: 'DECLINED', at: S.now() }); S.save(); App.rerender(); };
  A.reschedule = (el) => { const s = S.db.submissions.find(x => x.id === el.dataset.id);
    UI.modal(`<h3>Reschedule pickup</h3><form data-form="reschedule" data-id="${s.id}"><label>Date<input type="date" name="date" required min="${S.daysAhead(1)}" max="${S.daysAhead(14)}" value="${s.pickup.date}"></label><label>Slot<select name="slot">${R.pickupSlots.map(x => `<option ${x === s.pickup.slot ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label>Address<input name="address" value="${esc(s.pickup.address)}" required></label><button class="btn dark full">Save</button></form>`); };
  F.reschedule = (f, d) => { const s = S.db.submissions.find(x => x.id === f.dataset.id); s.pickup = d; s.history.push({ status: 'RESCHEDULED', at: S.now(), note: d.date + ' ' + d.slot }); S.notify(s.userId, 'Pickup rescheduled', `${s.toyName}: ${UI.date(d.date)}, ${d.slot}`, '#/my-sales'); S.save(); UI.closeModal(); App.rerender(); };

  /* P2P */
  A['ch-p2pcalc'] = (el) => { const p = Number(el.value); const e = $('#earn'); if (!p) { e.textContent = 'Enter a price to see your earnings.'; return; } const c = S.p2pCommission(p);
    e.innerHTML = `Commission ${Math.round(c * 100)}% (${inr(p * c)}) · <b>You earn ${inr(p * (1 - c))}</b>`; };
  F.p2p = (f, d) => {
    if (!App.requireLogin('Log in to create a listing.')) return; const u = me(); const price = Number(d.price);
    const emoji = { Building: '🧱', Vehicles: '🚗', Learning: '🔤', Puzzles: '🧩', 'Soft Toys': '🧸', 'Pretend Play': '🍳', Figures: '🦖', Musical: '🎵', Books: '📚', Outdoor: '⚽', Creative: '🎨', 'Baby & Toddler': '🍼' }[d.category] || '🧸';
    const p = { id: S.nextId('P'), name: d.name, brand: d.brand || 'Unbranded', category: d.category, age: d.age, mrp: Number(d.mrp) || 0, price, grade: null, emoji, color: '#ece5d8', description: d.description,
      images: pendingPhotos.slice(), source: 'p2p', sellerId: u.id, status: 'pending', commissionPct: S.p2pCommission(price), condition: d.condition, createdAt: S.now(), views: 0 };
    S.db.products.push(p); pendingPhotos = [];
    S.db.notifications.unshift({ id: S.nextId('N'), userId: 'admin', title: 'P2P listing awaiting review', body: `${p.name} by ${u.name} at ${inr(price)}`, link: '#/admin/p2p', at: S.now(), read: false });
    S.notify(u.id, 'Listing submitted for review', `${p.name} will go live once our team approves it (usually within 24 hours).`, '#/my-sales');
    S.save(); UI.toast('Listing submitted for review!'); App.go('#/my-sales');
  };
  A['p2p-price'] = async (el) => { const p = S.product(el.dataset.id); const v = await UI.prompt('Edit price', 'New price (₹)', p.price, 'number'); if (!v) return; p.price = Number(v); p.commissionPct = S.p2pCommission(p.price); S.save(); App.rerender(); };
  A['p2p-delist'] = async (el) => { if (!await UI.confirm('Delist this toy?', 'It will be removed from the marketplace.', 'Delist')) return; const p = S.product(el.dataset.id); p.status = 'delisted'; S.save(); App.rerender(); };

  /* rentals */
  A['rent-sub'] = async (el) => {
    if (!App.requireLogin('Log in to start a rental plan.')) return; const plan = R.rentalPlans.find(p => p.id === el.dataset.id); const u = me();
    let pay; try { pay = await App.pay(plan.price, 'upi', plan.name + ' · first month'); } catch (e) { return UI.toast(e.message, 'error'); }
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    S.db.rentals.push({ id: S.nextId('RNT'), userId: u.id, plan: plan.id, status: 'ACTIVE', startedAt: S.now(), nextBilling: d.toISOString(), toys: [], swapsUsed: 0, payments: [pay], boxStatus: 'PREPARING' });
    S.notify(u.id, 'Welcome to ' + plan.name + ' 📦', 'Pick your first toys and we’ll deliver them sanitised and ready.', '#/rent');
    S.db.notifications.unshift({ id: S.nextId('N'), userId: 'admin', title: 'New rental subscriber', body: `${u.name} · ${plan.name}`, link: '#/admin/rentals', at: S.now(), read: false });
    S.save(); UI.toast('Subscribed! Now fill your box.'); App.rerender(); };
  const myRental = () => S.db.rentals.find(r => r.userId === me().id && r.status !== 'CANCELLED');
  A['rent-add'] = (el) => { const r = myRental(); const plan = R.rentalPlans.find(p => p.id === r.plan); if (r.toys.length >= plan.toys) return UI.toast('Your box is full. Return a toy first.', 'error');
    const p = S.product(el.dataset.id); r.toys.push(p.id); p.status = 'rented'; r.boxStatus = 'PREPARING'; S.save(); UI.toast(p.name + ' added to your box'); App.rerender(); };
  A['rent-remove'] = (el) => { const r = myRental(); r.toys = r.toys.filter(x => x !== el.dataset.id); const p = S.product(el.dataset.id); if (p) p.status = 'live'; S.save(); UI.toast('Return pickup booked. Toy will be sanitised and reshelved.'); App.rerender(); };
  A['rent-swap'] = () => { const r = myRental(); const plan = R.rentalPlans.find(p => p.id === r.plan); if (r.swapsUsed >= plan.swaps) return UI.toast('You’ve used all swaps this month.', 'error');
    r.swapsUsed++; r.toys.forEach(id => { const p = S.product(id); if (p) p.status = 'live'; }); r.toys = []; r.boxStatus = 'PREPARING';
    S.notify(r.userId, 'Swap booked 🔄', 'We’ll collect your current toys. Pick new ones for the next delivery.', '#/rent'); S.save(); App.rerender(); };
  A['rent-cancel'] = async () => { if (!await UI.confirm('Cancel your rental plan?', 'We’ll collect any toys in your box. You won’t be billed again.', 'Cancel plan')) return;
    const r = myRental(); r.toys.forEach(id => { const p = S.product(id); if (p) p.status = 'live'; }); r.toys = []; r.status = 'CANCELLED'; S.save(); App.rerender(); };

  /* business */
  A['pick-bundle'] = (el) => { $('#bundlesel').value = el.dataset.id; $('#leadform').scrollIntoView({ behavior: 'smooth' }); };
  F.lead = (f, d) => { const l = { id: S.nextId('L'), org: d.org, name: d.name, email: d.email, phone: d.phone, bundle: d.bundle, qty: Number(d.qty), message: d.message, status: 'NEW', at: S.now() };
    S.db.leads.unshift(l); S.email(d.email, 'We received your Pretoy for Business request', 'Our partnerships team will reply within one working day.');
    S.db.notifications.unshift({ id: S.nextId('N'), userId: 'admin', title: 'New business enquiry', body: `${d.org}: ${(R.bundles.find(b => b.id === d.bundle) || {}).name} × ${d.qty}`, link: '#/admin/leads', at: S.now(), read: false });
    S.save(); f.reset(); UI.toast('Thanks! We’ll reply within one working day.'); };

  /* certificate verify */
  F.verify = (f, d) => App.go('#/certificate/' + encodeURIComponent(d.code.trim().toUpperCase()));

  /* auth */
  F.login = async (f, d) => { const u = await S.login(d.email, d.password); S.mergeGuestCart(); UI.toast('Welcome back, ' + u.name.split(' ')[0] + '!');
    const next = f.dataset.next || '#/'; App.go(u.role === 'admin' && next === '#/' ? '#/admin' : next); };
  A['demo-login'] = async (el) => { const u = await S.login(el.dataset.email, el.dataset.pw); S.mergeGuestCart(); UI.toast('Logged in as ' + u.name);
    const next = new URLSearchParams(location.hash.split('?')[1] || '').get('next'); App.go(next && next !== '#/' ? next : u.role === 'admin' ? '#/admin' : '#/'); };
  F.register = async (f, d) => { const u = await S.register(d); S.mergeGuestCart(); UI.toast('Account created. Welcome, ' + u.name.split(' ')[0] + '!'); App.go(f.dataset.next || '#/'); };
  F.forgot = async (f, d) => { await S.resetPassword(d.email, d.password); UI.toast('Password reset. Please log in.'); App.go('#/login'); };

  /* account */
  F.profile = (f, d) => { const u = me(); u.name = d.name; u.phone = d.phone; S.save(); UI.toast('Profile saved'); App.rerender(); };
  F.addr = (f, d) => { const u = me(); u.addresses.push({ id: 'A' + Date.now().toString(36), label: d.label, line: d.line, city: d.city, pin: d.pin }); S.save(); App.rerender(); };
  A['rm-addr'] = (el) => { const u = me(); u.addresses = u.addresses.filter(a => a.id !== el.dataset.id); S.save(); App.rerender(); };
  F.password = async (f, d) => { await S.changePassword(me(), d.old, d.new); f.reset(); UI.toast('Password updated'); };
  A['ch-marketing'] = (el) => { const u = me(); u.consent.marketing = el.checked; S.db.consentLog.push({ userId: u.id, action: el.checked ? 'granted' : 'withdrawn', scope: 'marketing', at: S.now() }); S.save(); UI.toast(el.checked ? 'Marketing consent given' : 'Marketing consent withdrawn'); App.rerender(); };
  A['my-data'] = () => { const u = me(); const strip = Object.assign({}, u); delete strip.pwHash; delete strip.salt;
    const data = { exportedAt: S.now(), profile: strip, orders: S.db.orders.filter(o => o.userId === u.id), submissions: S.db.submissions.filter(s => s.userId === u.id).map(s => Object.assign({}, s, { photos: s.photos.length + ' photo(s)' })),
      listings: S.db.products.filter(p => p.sellerId === u.id).map(p => Object.assign({}, p, { images: p.images.length + ' image(s)' })), rentals: S.db.rentals.filter(r => r.userId === u.id), consentLog: S.db.consentLog.filter(c => c.userId === u.id), notifications: S.db.notifications.filter(n => n.userId === u.id) };
    UI.download('pretoy-my-data.json', JSON.stringify(data, null, 2)); };
  A['erase-me'] = async () => { const u = me(); if (u.role === 'admin') return UI.toast('The demo admin account can’t be erased.', 'error');
    if (!await UI.confirm('Erase your account?', 'Your profile, addresses, wishlist and listings are erased. Order records are kept anonymised for tax purposes. This cannot be undone.', 'Erase my account')) return;
    S.db.consentLog.push({ userId: u.id, action: 'erasure requested', scope: 'all', at: S.now() });
    Object.assign(u, { name: 'Erased user', email: 'erased-' + u.id + '@pretoy.invalid', phone: '', addresses: [], wishlist: [], deleted: true, consent: { terms: false, privacy: false, marketing: false, at: S.now() } });
    S.db.products.filter(p => p.sellerId === u.id && ['live', 'pending'].includes(p.status)).forEach(p => { p.status = 'delisted'; });
    S.db.notifications = S.db.notifications.filter(n => n.userId !== u.id); S.logout(); S.save(); UI.toast('Your account has been erased.'); App.go('#/'); };
})();
