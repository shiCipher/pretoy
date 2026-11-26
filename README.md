# Pretoy v2: proof-of-concept

Pretoy is a C2B2C marketplace for certified pre-loved toys. This version runs entirely in the browser. It has **no server, no database and nothing to install**, and costs nothing to run or host.

## Run it (10 seconds)

1. Unzip or copy the `pretoy-v2` folder anywhere, for example your Desktop.
2. Double-click **`index.html`**. It opens in Chrome, Edge, Firefox or Safari.

That's it. Everything you do is saved in the browser's local storage on that computer.

> Optional: if your browser blocks local files, run `python3 -m http.server 8080` inside the folder and open http://localhost:8080.

## Demo accounts

| Role | Email | Password | What to try |
|---|---|---|---|
| Buyer | buyer@pretoy.in | buyer123 | Checkout with gift box and coupon, return a delivered order, rent a toy box |
| Seller | seller@pretoy.in | seller123 | Accept an offer, value and submit a toy with photos, list a toy peer-to-peer |
| Admin | admin@pretoy.in | admin123 | Make offers, run the 5-point Quality Seal inspection, publish, pay sellers, moderate P2P, ship orders, approve refunds |

The login page has one-click buttons for each. You can also register a new account.

## Where are the passwords and data?

- All data (users, toys, orders, photos) lives in the browser's `localStorage` under the key `pretoy.v2.db`.
- Passwords are stored only as salted SHA-256 hashes, never in plain text.
- **Admin → Data & backup → Export** saves everything to a `.json` file. Keep it in any folder (for example `Desktop/Pretoy-Data`). **Import** loads it again on another browser or computer. **Reset** restores the demo.
- Each browser keeps its own copy. Data does not sync between devices unless you export and import.

## Features

**Buyers**
- Home page, shop with search, category, age, grade, seller type, price and rental filters, and sorting
- Toy pages with grade, savings, Quality Seal scores, reviews and similar toys
- Public, printable **Quality Seal certificates** with a verify-by-code page
- Wishlist, cart, coupons (`FIRSTPLAY10`, `CIRCULAR15`, `GIFT99`), store credit
- **Gift boxes** at ₹99 / ₹149 / ₹199 with a gift message
- **Test-mode payments**: UPI (`fail@upi` fails), card (`4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined), cash on delivery
- Order tracking timeline, printable invoice, cancel, **15-day returns** with refund to the original method or store credit, reviews after delivery

**Sellers**
- **Instant valuation** (20–35% of MRP), adjusted for condition, parts, box, age and brand
- Photo upload (resized in the browser), **home pickup scheduling** with date and slot, reschedule
- Payout by UPI, bank, or store credit with a 10% bonus
- Accept or decline offers, track every stage, see earnings
- **Peer-to-peer listings** with tiered commission (15% / 12% / 10%), moderated by admin

**Rentals and business**
- **Rental subscriptions** at ₹499 / ₹749 / ₹999 a month: fill your box, swap, return, cancel
- **Bulk, CSR and corporate bundles** with a quote form that feeds the admin lead pipeline

**Admin desk**
- Dashboard: GMV, AOV, refurbishment margin, P2P commission, gift-box attach rate, rental MRR, plastic diverted, category and grade charts, acquisition funnel, a to-do list
- Acquisition queue: offer, reject, collect, **5-point Quality Seal inspection** (Safety, Hygiene, Parts, Function, Packaging) with automatic grading and suggested price, publish with a certificate, recycle failures, pay sellers
- Inventory (price, unlist or relist, rental pool), P2P moderation, orders and returns, rentals, leads, users, simulated email/SMS outbox, data backup

**Trust and compliance**
- In-app notifications and a logged email outbox
- **DPDP Act 2023**: explicit consent at signup, consent history, marketing opt-in and opt-out, download my data, erase my account, privacy notice, grievance officer, storage notice

## Host it free (optional)

The folder is a static website, so any free static host works:
- **GitHub Pages**: push the folder to a repository, then Settings → Pages → deploy from branch.
- **Netlify Drop** or **Cloudflare Pages**: drag the folder onto app.netlify.com/drop.

Each visitor gets their own data in their own browser.

## Files

```
index.html        page shell
css/app.css       all styles (responsive and printable)
js/store.js       data layer, business rules (RULES), seed data, hashing
js/ui.js          helpers: formatting, modals, toasts, photo resizing
js/app.js         router, layout and customer pages
js/actions.js     customer actions (cart, checkout, returns, selling, rentals, account)
js/admin.js       admin desk
```

Prices, commissions, plans and coupons are all in `RULES` at the top of `js/store.js`.

## Limits of this POC

No real payments, couriers, emails or SMS: all of these are simulated. Data is per browser. Before going live, add a backend, real authentication, a payment gateway (such as Razorpay), and logistics and messaging providers.
