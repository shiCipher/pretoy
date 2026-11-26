/* Pretoy v2 data layer: everything lives in the browser's localStorage.
   No server, no database. Export/Import lets you keep a JSON backup in any folder. */
(function () {
  'use strict';
  const KEY = 'pretoy.v2.db';
  const SESSION_KEY = 'pretoy.v2.session';
  const VERSION = 3;

  /* ---------- business rules (from the BPP proposal) ---------- */
  const RULES = {
    valuationMin: 0.20, valuationMax: 0.35,          // instant valuation band, % of MRP
    resaleByGrade: { A: 0.50, B: 0.40, C: 0.30 },    // resale at 50-70% below MRP
    gradeLabels: { A: 'Like New', B: 'Gently Loved', C: 'Well Played' },
    returnDays: 15,
    freeShippingAbove: 999, shippingFee: 79,
    gift: [
      { id: 'none', name: 'No gift wrap', price: 0, desc: '' },
      { id: 'classic', name: 'Classic Kraft Box', price: 99, desc: 'Recycled kraft box, twine & a handwritten tag' },
      { id: 'premium', name: 'Premium Gift Box', price: 149, desc: 'Printed keepsake box, tissue & greeting card' },
      { id: 'deluxe', name: 'Deluxe Surprise Box', price: 199, desc: 'Premium box, card, stickers & a mini activity sheet' }
    ],
    rentalPlans: [
      { id: 'starter', name: 'Starter Box', price: 499, toys: 2, swaps: 1, perks: ['2 toys at a time', '1 free swap a month', 'Sanitised before every delivery'] },
      { id: 'explorer', name: 'Explorer Box', price: 749, toys: 4, swaps: 2, perks: ['4 toys at a time', '2 free swaps a month', 'Age-based curation', 'Damage cover up to ₹500'], popular: true },
      { id: 'super', name: 'Super Play Box', price: 999, toys: 6, swaps: 4, perks: ['6 toys at a time', 'Unlimited* swaps (4 pickups)', 'Priority on new arrivals', 'Damage cover up to ₹1,000', 'Buy any rented toy at 20% off'] }
    ],
    bundles: [
      { id: 'csr', name: 'CSR Donation Bundle', emoji: '🎁', from: 15000, unit: '25 certified toys', desc: 'Sanitised, Quality-Seal certified toys delivered to an NGO, anganwadi or school of your choice, with an impact report for your CSR filing.' },
      { id: 'school', name: 'Preschool & Daycare Kit', emoji: '🏫', from: 9999, unit: '20 learning toys', desc: 'Age-banded learning, puzzles and pretend-play sets for classrooms, with a quarterly refresh option.' },
      { id: 'festive', name: 'Festive Corporate Gifting', emoji: '🪔', from: 599, unit: 'per gift box', desc: 'Employee-family gifting for Diwali, Christmas or Children’s Day, in branded Pretoy gift boxes.' },
      { id: 'hotel', name: 'Hotel & Clinic Play Corner', emoji: '🏨', from: 4999, unit: 'per month', desc: 'A rotating, regularly sanitised toy corner for waiting rooms, resorts and family lounges.' }
    ],
    coupons: { FIRSTPLAY10: { pct: 10, desc: '10% off your first order' }, CIRCULAR15: { pct: 15, min: 2000, desc: '15% off orders above ₹2,000' }, GIFT99: { flat: 99, desc: 'Free Classic gift box (₹99 off)' } },
    pickupSlots: ['9 AM – 12 PM', '12 PM – 3 PM', '3 PM – 6 PM', '6 PM – 8 PM'],
    seal: [
      { key: 'safety', name: 'Safety', icon: '🛡️', desc: 'No sharp edges, loose small parts, toxic paint or battery leaks. Checked against IS 9873 / BIS age guidance.' },
      { key: 'hygiene', name: 'Hygiene', icon: '🧼', desc: 'Deep-cleaned and sanitised with child-safe, fragrance-free disinfectant; soft toys steam-treated.' },
      { key: 'parts', name: 'Parts', icon: '🧩', desc: 'All pieces counted against the original set list; replacements are noted on the certificate.' },
      { key: 'function', name: 'Function', icon: '⚙️', desc: 'Moving parts, lights, sounds and mechanisms tested end to end; fresh batteries where needed.' },
      { key: 'packaging', name: 'Packaging', icon: '📦', desc: 'Repacked in a clean, plastic-light Pretoy box with the original manual where available.' }
    ],
    categories: ['Building', 'Vehicles', 'Learning', 'Puzzles', 'Soft Toys', 'Pretend Play', 'Figures', 'Musical', 'Books', 'Outdoor', 'Creative', 'Baby & Toddler'],
    ages: ['0–2 years', '2–4 years', '3–6 years', '5–8 years', '8–12 years', '12+ years'],
    premiumBrands: ['lego', 'fisher-price', 'hape', 'melissa & doug', 'hot wheels', 'barbie', 'chicco', 'funskool', 'vtech', 'playmobil', 'ravensburger', 'nerf']
  };

  function p2pCommission(price) { return price < 1000 ? 0.15 : price < 3000 ? 0.12 : 0.10; }

  function instantValuation(input) {
    const mrp = Number(input.mrp) || 0;
    let pct = { 'like-new': 0.33, good: 0.28, fair: 0.22, worn: 0.20 }[input.condition] || 0.25;
    const notes = [];
    if (input.completeness === 'complete') { pct += 0.01; notes.push('All parts present +1%'); }
    else if (input.completeness === 'minor') { pct -= 0.02; notes.push('Minor parts missing −2%'); }
    else if (input.completeness === 'major') { pct -= 0.05; notes.push('Major parts missing −5%'); }
    if (input.box) { pct += 0.01; notes.push('Original box +1%'); }
    const age = new Date().getFullYear() - (Number(input.year) || new Date().getFullYear());
    if (age >= 4) { pct -= 0.02; notes.push('Older than 4 years −2%'); }
    if (RULES.premiumBrands.includes(String(input.brand || '').trim().toLowerCase())) { pct += 0.02; notes.push('Premium brand +2%'); }
    pct = Math.min(RULES.valuationMax, Math.max(RULES.valuationMin, pct));
    const low = Math.round(mrp * Math.max(RULES.valuationMin, pct - 0.03) / 10) * 10;
    const high = Math.round(mrp * pct / 10) * 10;
    return { pct, low, high, notes, credit: Math.round(high * 1.10 / 10) * 10 };
  }

  function gradeFromSeal(seal) {
    const scores = RULES.seal.map(s => Number(seal[s.key]) || 0);
    if (scores.some(v => v < 1)) return null;
    if ((Number(seal.safety) || 0) < 3 || (Number(seal.hygiene) || 0) < 3) return 'FAIL';
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avg >= 4.5 ? 'A' : avg >= 3.6 ? 'B' : 'C';
  }

  /* ---------- password hashing (demo-grade, never store plain text) ---------- */
  async function hash(text) {
    try {
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* fall through */ }
    let h1 = 0x811c9dc5, h2 = 0x1234567;
    for (let i = 0; i < text.length; i++) { h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619); h2 = Math.imul(h2 + text.charCodeAt(i), 2654435761); }
    return 'f' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }
  function salt() { return Math.random().toString(36).slice(2, 10); }

  /* ---------- storage ---------- */
  let db = null;
  function now() { return new Date().toISOString(); }
  function daysAgo(n, h) { const d = new Date(); d.setDate(d.getDate() - n); if (h != null) d.setHours(h, 15, 0, 0); return d.toISOString(); }
  function daysAhead(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const parsed = JSON.parse(raw); if (parsed.version === VERSION) { db = parsed; return db; } } } catch (e) { console.warn('Pretoy: could not read storage', e); }
    return null;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { console.error(e); alertStorageFull(); return false; }
  }
  function alertStorageFull() { if (window.PretoyUI) window.PretoyUI.toast('Browser storage is full. Remove some photos or reset demo data from Admin → Data.', 'error'); }
  function nextId(prefix) { db.seq[prefix] = (db.seq[prefix] || 1000) + 1; return prefix + db.seq[prefix]; }

  /* ---------- seed data ---------- */
  async function seed() {
    db = { version: VERSION, seq: {}, users: [], products: [], submissions: [], orders: [], rentals: [], leads: [], notifications: [], outbox: [], reviews: [], consentLog: [], carts: {}, payouts: [], createdAt: now() };
    const mk = async (name, email, pw, role, extra) => {
      const s = salt();
      const u = Object.assign({ id: nextId('U'), name, email, phone: '', role, salt: s, pwHash: await hash(s + pw), createdAt: daysAgo(40),
        consent: { terms: true, privacy: true, marketing: false, at: daysAgo(40) }, addresses: [], wishlist: [], storeCredit: 0, roles: ['buyer', 'seller'] }, extra || {});
      db.users.push(u); db.consentLog.push({ userId: u.id, action: 'granted', scope: 'terms, privacy', at: u.consent.at }); return u;
    };
    const admin = await mk('Pretoy Ops', 'admin@pretoy.in', 'admin123', 'admin', { roles: ['admin'], phone: '9800000001' });
    const buyer = await mk('Ananya Rao', 'buyer@pretoy.in', 'buyer123', 'customer', { phone: '9876543210',
      addresses: [{ id: 'A1', label: 'Home', line: '42, 3rd Cross, Indiranagar', city: 'Bengaluru', pin: '560038' }], consent: { terms: true, privacy: true, marketing: true, at: daysAgo(40) } });
    const seller = await mk('Rohit Mehta', 'seller@pretoy.in', 'seller123', 'customer', { phone: '9123456780', storeCredit: 250,
      addresses: [{ id: 'A1', label: 'Home', line: 'Flat 12B, Prestige Lakeside, Whitefield', city: 'Bengaluru', pin: '560066' }] });
    await mk('Meera Iyer', 'meera@example.com', 'meera123', 'customer', {});

    const T = [
      ['LEGO Classic Creative Brick Box', 'LEGO', 'Building', '5–8 years', 2999, 'A', '🧱', '#f6d6a8', 'A 484-piece box of classic bricks in 35 colours, with idea booklet. Counted, washed and dried brick by brick.', true],
      ['Hot Wheels City Track Set', 'Hot Wheels', 'Vehicles', '5–8 years', 2499, 'B', '🏎️', '#cfe0f5', 'Loop-the-loop track with launcher and 2 die-cast cars. Light scuffs on one car, everything works.', false],
      ['Fisher-Price Rainbow Stacker', 'Fisher-Price', 'Baby & Toddler', '0–2 years', 899, 'A', '🌈', '#f7d7d9', 'Five colourful rings on a rocking base. Steam-sanitised and BPA-free.', true],
      ['Ravensburger Safari Puzzle (100 pc)', 'Ravensburger', 'Puzzles', '5–8 years', 1199, 'A', '🧩', '#e3efd3', 'All 100 pieces verified on our counting board. Box has slight corner wear.', true],
      ['Jellycat Bashful Bunny', 'Jellycat', 'Soft Toys', '0–2 years', 2399, 'B', '🐰', '#f3e6da', 'Super-soft medium bunny, steam-cleaned at 60°C and air dried. Slight fur pilling.', false],
      ['Magna-Tiles Clear Colours (32 pc)', 'Magna-Tiles', 'Building', '3–6 years', 4499, 'A', '🔷', '#d8ecf0', 'Magnetic building tiles, all 32 present. Magnets tested for secure seating.', true],
      ['Melissa & Doug Wooden Kitchen', 'Melissa & Doug', 'Pretend Play', '3–6 years', 6999, 'B', '🍳', '#f5e4c9', 'Wooden play kitchen with knobs that click, oven door and sink. Minor paint touch-ups with child-safe paint.', false],
      ['Schleich Dinosaur Set', 'Schleich', 'Figures', '3–6 years', 2199, 'C', '🦕', '#dfe8cf', 'Six hand-painted dinosaurs. Some paint wear on the T-Rex, otherwise sturdy and safe.', true],
      ['Hape Rainbow Xylophone', 'Hape', 'Musical', '2–4 years', 1599, 'A', '🎶', '#f6dcc4', 'Tuned metal keys on a wooden frame with two mallets. Sounds bright and clean.', true],
      ['Ladybird Bedtime Storybook Bundle', 'Ladybird', 'Books', '3–6 years', 1299, 'B', '📚', '#efe1f0', 'Bundle of 8 picture books, pages intact, lightly read. Cleaned covers.', false],
      ['Kids Balance Bike', 'R for Rabbit', 'Outdoor', '2–4 years', 3999, 'B', '🚲', '#e6eadb', 'Lightweight balance bike with adjustable seat. New grips fitted, bolts torque-checked.', false],
      ['Funskool Doctor Set', 'Funskool', 'Pretend Play', '3–6 years', 799, 'A', '🩺', '#d9ecdf', 'Stethoscope, thermometer and 8 play tools in a carry case. Every piece present.', true],
      ['Brio Wooden Railway Starter', 'Brio', 'Vehicles', '3–6 years', 3499, 'A', '🚂', '#f1dcc9', 'Figure-8 track with engine and two carriages. Wood sanded and re-oiled.', true],
      ['VTech Sort & Discover Activity Cube', 'VTech', 'Learning', '0–2 years', 2299, 'B', '🎲', '#dde6f6', 'Five-sided activity cube with lights and sounds. Fresh batteries installed.', true],
      ['Crayola Art Studio Case', 'Crayola', 'Creative', '5–8 years', 1499, 'C', '🎨', '#f7e5c9', 'Folding art case. Consumables replaced with new crayons and markers; case shows wear.', false],
      ['Playmobil Fire Station', 'Playmobil', 'Figures', '5–8 years', 5499, 'B', '🚒', '#f4d3cc', 'Fire station with figures, truck and working siren. Two tiny accessories replaced.', false],
      ['Nerf Elite Blaster', 'Nerf', 'Outdoor', '8–12 years', 1899, 'B', '🎯', '#e9e2d0', 'Blaster tested over 50 shots. Comes with 12 fresh darts.', false],
      ['Montessori Shape Sorter', 'Hape', 'Learning', '0–2 years', 999, 'A', '🔺', '#e6dff2', 'Wooden sorter with 12 shapes in natural dyes. Sanded and food-grade wax finished.', true]
    ];
    const inspectors = ['Kavya S.', 'Imran K.', 'Divya P.'];
    T.forEach((t, i) => {
      const [name, brand, category, age, mrp, grade, emoji, color, description, rentable] = t;
      const base = { A: [5, 5, 5, 5, 4], B: [4, 5, 4, 4, 4], C: [4, 4, 3, 4, 3] }[grade];
      const seal = { safety: base[0], hygiene: base[1], parts: base[2], function: base[3], packaging: base[4], notes: grade === 'C' ? 'Visible cosmetic wear, fully safe and functional.' : 'Passed all checks.' };
      const id = nextId('P');
      db.products.push({ id, name, brand, category, age, mrp, price: Math.round(mrp * RULES.resaleByGrade[grade] / 10) * 10 - 1, grade, emoji, color, description,
        images: [], source: 'certified', status: 'live', seal, certCode: 'PTY-' + (24000 + i * 37) + '-' + grade, inspectedAt: daysAgo(i + 2), inspector: inspectors[i % 3],
        rentable, createdAt: daysAgo(i + 1), views: 20 + ((i * 13) % 70) });
    });
    // P2P community listings
    const P = [
      ['Barbie Dreamhouse Furniture Pack', 'Barbie', 'Pretend Play', '3–6 years', 2599, 1200, '🏠', '#f8d6e6', 'Used for a year, all furniture pieces present. Seller-described condition.', 'live'],
      ['Wooden Abacus', 'Generic', 'Learning', '3–6 years', 650, 300, '🧮', '#ead9c6', 'Classic counting abacus, beads slide smoothly.', 'live'],
      ['Remote-Control Monster Truck', 'Maisto', 'Vehicles', '8–12 years', 3200, 1500, '🚙', '#d6e3ef', 'Works great, battery holds ~20 min. Small scratch on the bonnet.', 'live'],
      ['Chess & Ludo Combo Board', 'Funskool', 'Learning', '8–12 years', 499, 250, '♟️', '#e2e2d6', 'All pieces, board slightly faded.', 'pending']
    ];
    P.forEach((t, i) => {
      const [name, brand, category, age, mrp, price, emoji, color, description, status] = t;
      db.products.push({ id: nextId('P'), name, brand, category, age, mrp, price, grade: null, emoji, color, description, images: [], source: 'p2p', sellerId: seller.id,
        status, commissionPct: p2pCommission(price), condition: i === 2 ? 'Good' : 'Like new', createdAt: daysAgo(i + 1), views: 10 + i * 7 });
    });

    // Seller submissions at different stages
    const sub = (o) => { const s = Object.assign({ id: nextId('S'), userId: seller.id, photos: [], history: [], createdAt: daysAgo(o.ago || 1) }, o); db.submissions.push(s); return s; };
    const v1 = instantValuation({ mrp: 3999, condition: 'good', completeness: 'complete', box: true, year: 2024, brand: 'LEGO' });
    sub({ toyName: 'LEGO City Police Station', brand: 'LEGO', category: 'Building', age: '5–8 years', mrp: 3999, year: 2024, condition: 'good', completeness: 'complete', box: true,
      description: 'Built twice, all bags kept separately, manual included.', valuation: v1, status: 'SUBMITTED', ago: 0,
      pickup: { date: daysAhead(2), slot: RULES.pickupSlots[1], address: 'Flat 12B, Prestige Lakeside, Whitefield, Bengaluru 560066' }, payoutMethod: 'upi',
      history: [{ status: 'SUBMITTED', at: daysAgo(0, 9), note: 'Instant valuation ₹' + v1.low + '–₹' + v1.high }] });
    const v2 = instantValuation({ mrp: 1999, condition: 'like-new', completeness: 'complete', box: false, year: 2025, brand: 'Hape' });
    sub({ toyName: 'Hape Pound & Tap Bench', brand: 'Hape', category: 'Musical', age: '0–2 years', mrp: 1999, year: 2025, condition: 'like-new', completeness: 'complete', box: false,
      description: 'Barely used gift.', valuation: v2, offer: v2.high, status: 'OFFER_MADE', ago: 2,
      pickup: { date: daysAhead(3), slot: RULES.pickupSlots[0], address: 'Flat 12B, Prestige Lakeside, Whitefield, Bengaluru 560066' }, payoutMethod: 'credit',
      history: [{ status: 'SUBMITTED', at: daysAgo(2, 11), note: '' }, { status: 'OFFER_MADE', at: daysAgo(1, 16), note: 'Offer ₹' + v2.high + ' after photo review' }] });
    const v3 = instantValuation({ mrp: 2799, condition: 'good', completeness: 'minor', box: false, year: 2023, brand: 'Fisher-Price' });
    sub({ toyName: 'Fisher-Price Laugh & Learn Puppy', brand: 'Fisher-Price', category: 'Learning', age: '0–2 years', mrp: 2799, year: 2023, condition: 'good', completeness: 'minor', box: false,
      description: 'Collar missing, sounds work.', valuation: v3, offer: v3.high, status: 'COLLECTED', ago: 6,
      pickup: { date: daysAhead(-1).slice(0, 10), slot: RULES.pickupSlots[2], address: 'Flat 12B, Prestige Lakeside, Whitefield, Bengaluru 560066' }, payoutMethod: 'upi',
      history: [{ status: 'SUBMITTED', at: daysAgo(6, 10) }, { status: 'OFFER_MADE', at: daysAgo(5, 12) }, { status: 'ACCEPTED', at: daysAgo(5, 18) }, { status: 'PICKUP_SCHEDULED', at: daysAgo(5, 18) }, { status: 'COLLECTED', at: daysAgo(1, 15), note: 'Collected by Pretoy Pickup Partner' }] });

    // Orders
    const prod = (n) => db.products[n];
    const order = (o) => { const ord = Object.assign({ id: nextId('ORD'), userId: buyer.id, address: buyer.addresses[0], gift: { tier: 'none', price: 0, note: '' }, discount: 0, coupon: '' }, o);
      ord.subtotal = ord.items.reduce((a, b) => a + b.price, 0); ord.shipping = ord.subtotal >= RULES.freeShippingAbove ? 0 : RULES.shippingFee;
      ord.total = ord.subtotal + ord.shipping + ord.gift.price - ord.discount; db.orders.push(ord); ord.items.forEach(it => { const p = db.products.find(x => x.id === it.productId); if (p) p.status = 'sold'; }); return ord; };
    const it = (p) => ({ productId: p.id, name: p.name, price: p.price, emoji: p.emoji, color: p.color, source: p.source, grade: p.grade });
    // Add two extra sold products so the shop keeps its full range
    const extraSold = [['Chicco Musical Walker', 'Chicco', 'Baby & Toddler', '0–2 years', 3299, 'B', '🚼', '#e5ecd9'], ['Wooden Tangram Puzzle', 'Generic', 'Puzzles', '5–8 years', 599, 'A', '🔶', '#f3e2c4']];
    const extra = extraSold.map((t, i) => { const [name, brand, category, age, mrp, grade, emoji, color] = t; const p = { id: nextId('P'), name, brand, category, age, mrp, price: Math.round(mrp * RULES.resaleByGrade[grade] / 10) * 10 - 1, grade, emoji, color,
      description: 'Certified pre-loved toy.', images: [], source: 'certified', status: 'live', seal: { safety: 5, hygiene: 5, parts: 4, function: 5, packaging: 4, notes: 'Passed all checks.' },
      certCode: 'PTY-2' + (5100 + i) + '-' + grade, inspectedAt: daysAgo(20), inspector: inspectors[i], rentable: false, createdAt: daysAgo(21), views: 40 }; db.products.push(p); return p; });
    order({ items: [it(extra[0])], status: 'DELIVERED', createdAt: daysAgo(6, 10), deliveredAt: daysAgo(3, 14), gift: { tier: 'premium', price: 149, note: 'Happy 1st birthday, Kabir! 🎈' },
      payment: { method: 'UPI', ref: 'TEST-UPI-77812', status: 'PAID' }, history: [{ status: 'PLACED', at: daysAgo(6, 10) }, { status: 'CONFIRMED', at: daysAgo(6, 11) }, { status: 'PACKED', at: daysAgo(5, 9) }, { status: 'SHIPPED', at: daysAgo(5, 17) }, { status: 'DELIVERED', at: daysAgo(3, 14) }] });
    order({ items: [it(extra[1])], status: 'SHIPPED', createdAt: daysAgo(2, 19), payment: { method: 'Card', ref: 'TEST-CARD-4242', status: 'PAID' },
      history: [{ status: 'PLACED', at: daysAgo(2, 19) }, { status: 'CONFIRMED', at: daysAgo(2, 19) }, { status: 'PACKED', at: daysAgo(1, 10) }, { status: 'SHIPPED', at: daysAgo(0, 8) }] });

    db.reviews.push({ id: nextId('R'), productId: extra[0].id, userId: buyer.id, name: 'Ananya R.', rating: 5, text: 'Looked brand new and the gift box was gorgeous. My son loves it!', at: daysAgo(2) });
    db.leads.push({ id: nextId('L'), org: 'Infosys Foundation (demo)', name: 'Priya N.', email: 'csr@example.com', phone: '9000000000', bundle: 'csr', qty: 4, message: 'Children’s Day donation drive for 3 schools in Mysuru.', status: 'NEW', at: daysAgo(1, 12) });
    const n = (userId, title, body, link, ago) => db.notifications.push({ id: nextId('N'), userId, title, body, link: link || '', at: daysAgo(ago || 0, 9), read: false });
    n(seller.id, 'New offer for Hape Pound & Tap Bench', 'Pretoy has offered ₹' + v2.high + '. Accept or decline from My Sales.', '#/my-sales', 1);
    n(buyer.id, 'Your order is on the way 🚚', 'Wooden Tangram Puzzle has shipped.', '#/orders', 0);
    n('admin', 'New CSR enquiry', 'Infosys Foundation (demo) asked about the CSR Donation Bundle.', '#/admin/leads', 1);
    n('admin', 'P2P listing awaiting review', 'Chess & Ludo Combo Board needs moderation.', '#/admin/p2p', 0);
    save();
  }

  /* ---------- public API ---------- */
  const Store = {
    RULES, p2pCommission, instantValuation, gradeFromSeal, hash, salt, nextId, now, daysAhead,
    get db() { return db; },
    async init() { if (!load()) await seed(); return db; },
    save,
    async reset() { localStorage.removeItem(KEY); localStorage.removeItem(SESSION_KEY); await seed(); },
    exportJSON() { return JSON.stringify(db, null, 2); },
    importJSON(text) { const d = JSON.parse(text); if (!d || !Array.isArray(d.products) || !Array.isArray(d.users)) throw new Error('Not a Pretoy backup file'); d.version = VERSION; db = d; save(); },
    storageUsedKB() { try { return Math.round((localStorage.getItem(KEY) || '').length / 1024); } catch (e) { return 0; } },

    /* session */
    currentUser() { const id = localStorage.getItem(SESSION_KEY); return id ? db.users.find(u => u.id === id) || null : null; },
    async login(email, pw) {
      const u = db.users.find(x => x.email.toLowerCase() === String(email).trim().toLowerCase());
      if (!u || u.deleted) throw new Error('No account found with that email.');
      if (u.pwHash !== await hash(u.salt + pw)) throw new Error('Incorrect password. Try again.');
      localStorage.setItem(SESSION_KEY, u.id); u.lastLogin = now(); save(); return u;
    },
    logout() { localStorage.removeItem(SESSION_KEY); },
    async register(data) {
      const email = String(data.email).trim().toLowerCase();
      if (db.users.some(u => u.email.toLowerCase() === email)) throw new Error('An account with this email already exists.');
      if (!data.terms || !data.privacy) throw new Error('Please accept the Terms and the Privacy Notice to continue.');
      const s = salt();
      const u = { id: nextId('U'), name: data.name.trim(), email, phone: data.phone || '', role: 'customer', roles: ['buyer', 'seller'], salt: s, pwHash: await hash(s + data.password),
        createdAt: now(), consent: { terms: true, privacy: true, marketing: !!data.marketing, at: now() }, addresses: [], wishlist: [], storeCredit: 0 };
      db.users.push(u); db.consentLog.push({ userId: u.id, action: 'granted', scope: 'terms, privacy' + (data.marketing ? ', marketing' : ''), at: now() });
      Store.notify(u.id, 'Welcome to Pretoy 🧸', 'Use code FIRSTPLAY10 for 10% off your first order.', '#/shop');
      localStorage.setItem(SESSION_KEY, u.id); save(); return u;
    },
    async changePassword(user, oldPw, newPw) { if (user.pwHash !== await hash(user.salt + oldPw)) throw new Error('Current password is incorrect.'); user.salt = salt(); user.pwHash = await hash(user.salt + newPw); save(); },
    async resetPassword(email, newPw) { const u = db.users.find(x => x.email.toLowerCase() === email.trim().toLowerCase()); if (!u) throw new Error('No account found with that email.'); u.salt = salt(); u.pwHash = await hash(u.salt + newPw); Store.email(u.email, 'Your Pretoy password was reset', 'If this was not you, contact care@pretoy.in.'); save(); },

    /* notifications + simulated email/SMS */
    notify(userId, title, body, link) {
      db.notifications.unshift({ id: nextId('N'), userId, title, body, link: link || '', at: now(), read: false });
      const u = db.users.find(x => x.id === userId);
      if (u) Store.email(u.email, title, body);
    },
    email(to, subject, body) { db.outbox.unshift({ id: nextId('E'), to, subject, body, at: now(), channel: 'email' }); },

    /* cart (per user, or guest) */
    cartKey() { const u = Store.currentUser(); return u ? u.id : 'guest'; },
    cart() { return db.carts[Store.cartKey()] || (db.carts[Store.cartKey()] = []); },
    addToCart(pid) { const c = Store.cart(); if (!c.includes(pid)) c.push(pid); save(); },
    removeFromCart(pid) { db.carts[Store.cartKey()] = Store.cart().filter(x => x !== pid); save(); },
    mergeGuestCart() { const g = db.carts.guest || []; if (!g.length) return; const c = Store.cart(); g.forEach(p => { if (!c.includes(p)) c.push(p); }); db.carts.guest = []; save(); },

    product(id) { return db.products.find(p => p.id === id); },
    user(id) { return db.users.find(u => u.id === id); },
    sellerName(id) { const u = Store.user(id); return u ? u.name.split(' ')[0] + ' ' + (u.name.split(' ')[1] || '').charAt(0) + '.' : 'Community seller'; }
  };
  window.Store = Store;
})();
