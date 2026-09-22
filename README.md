# Nilho website

Plain HTML/CSS/JS. Foco is hosted on Vercel at getfoco.co; Nilho remains on Netlify. The static design, NFC demo and storytelling remain intact. Two Vercel Functions handle orders and Wompi callbacks, with a private Vercel Blob ledger. No frontend framework or marketing SDK was added.

## Local checks

```sh
npm ci
npm test
npm run build
npm run preview:receipt
python3 -m http.server 8766 --bind 127.0.0.1
```

Checkout: `http://127.0.0.1:8766/foco/#comprar`. Synthetic email preview: `http://127.0.0.1:8766/.artifacts/receipt-preview.html`. Python serves static files only, not the API. The receipt preview is excluded from the production build. Never expose this source-directory development server publicly.

## Current purchase flow — production enabled

The owner approved **one server-created, single-use Wompi link per order**, replacing three reusable links. Amounts still come from `foco/checkout-config.mjs`: 11000000, 20000000 and 25000000 centavos. Wompi collects the address once. Links expire after one hour; their SKU is the order UUID, while the stored order and link description retain FOCO-01/02/03.

The server records accepted policy versions, timestamp, archived HTML and hashes with the order before creating the link. It verifies Wompi's callback signature and independently retrieves the transaction using the private API. Only an APPROVED transaction matching the saved link, environment, COP amount and order can generate a Resend receipt. Redirect parameters never confirm payment. Private Vercel Blob storage contains a minimal order/consent/receipt ledger; there is no customer-account database or duplicated shipping form.

**Published with owner approval on 2026-09-21:** production checkout and email switches are enabled, with production-only Wompi and Resend credentials. The live site preserves the latest film, desk scene and glass overlay. Sandbox approved/declined payments, consent archives, delivered receipt and duplicate callback protection passed. Production routes, pricing and invalid-request rejection passed; no real-money purchase, settlement or refund has been performed by this task. See the dated release evidence in `docs/foco-order-receipts-review.md`.

The owner confirmed the commercial terms and authorized launch after being informed that Wompi still displays merchant review for withdrawals. The carrier remains deferred; send its name with tracking. No IVA is added to the agreed prices. The email is a purchase receipt, not a DIAN invoice or a finding of tax exemption.

## Hosting and runtime configuration

Foco production runs on Vercel's **getfoco** project in **juanfgaviriacs-projects**, at https://getfoco.co. Nilho's corporate site remains on Netlify. The Vercel migration section below is the current configuration; the original Netlify launch and sandbox evidence is retained in [release notes](docs/foco-order-receipts-review.md). Do not redeploy the historical Netlify sandbox with the new sender: its key is scoped to nilho.co. New sandbox work needs isolated Vercel test credentials, storage and a test recipient.

## Policy archives and prices

`checkout-config.mjs` owns executable prices; `commerce-config.mjs` owns seller/product/stock information. `scripts/policies.mjs` generates fully rendered policy archives in `foco/compra/versiones/`. Build fails if existing archived content changes: bump the appropriate version and preserve the previous file. Receipts retain their original offer, seller and policy links even after prices change. Never overwrite an archive after a sale.

Stock remains manual (30 initially, pause at five). It is **not** automatically reserved or decremented; pending payments and still-active links require reconciliation. The three legacy reusable production offers were deactivated during launch. New issued single-use links must still be paused explicitly when stopping sales; disabling the website alone cannot stop them.

### Foco on getfoco.co (Vercel)

The `getfoco` project belongs to `juanfgaviriacs-projects`. `npm run build:vercel`
builds only Foco; the original `npm run build` still builds the Nilho corporate
site for Netlify. Keep both sites' existing editorial/UI changes when merging.

Canonical routes: `/`, `/soporte/`, `/privacidad/`, `/terminos/`, `/compra/`,
`/compra/privacidad/`, `/pago/`. Legacy `/foco/` page paths redirect to these;
`/foco/` assets remain available. Preserve query strings, particularly Wompi's
transaction `id`. Never treat that id as proof of payment.

Vercel Production needs `WOMPI_ENVIRONMENT=prod`, the three `WOMPI_*` credentials,
`RESEND_API_KEY` limited to sending from getfoco.co, a private production
`BLOB_READ_WRITE_TOKEN`, and the two `FOCO_*_ENABLED=true` gates. Set these only
server-side. Preview uses separate test credentials/storage and a fixed
`FOCO_TEST_EMAIL_TO`. Production credentials fail closed outside `VERCEL_ENV=production`.

Orders, consent and receipt leases use private Vercel Blob storage with uncached
origin reads, atomic creates, and ETag conditional writes. Never substitute
cached reads or unconditional writes for that contract. Checkout requests are
limited to ten per IP per minute; rate-limit keys use an HMAC, not raw IPs.

Wompi production events go to `https://getfoco.co/api/foco/wompi`; new payment
links return to `https://getfoco.co/pago/`. The old nilho.co event endpoint proxies POST requests to Vercel and preserves response status. Its checkout endpoint returns 410, and old pages redirect to getfoco.co. The former production ledger was empty at cutover; historical sandbox records stay on Netlify. Never run two independent writers against separate order ledgers.
Do not delete historical policy archives or sandbox evidence.

`team@getfoco.co` sends receipts through Resend; Namecheap forwards incoming
mail to `team@nilho.co`. That forwarding does not configure Gmail/Mail's "send as"
identity; support replies sent manually still need that client setup.

Before cutover: verify DNS/TLS, checkout totals, signed event handling, private
storage isolation, receipt deduplication, email delivery, and old page redirects.
The browser's success URL is not a paid order. Fulfil only Wompi APPROVED orders.
