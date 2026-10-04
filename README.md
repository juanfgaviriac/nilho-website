# Nilho website

Plain HTML/CSS/JS. Foco is hosted on Vercel at getfoco.co; Nilho remains on Netlify. The static design, NFC demo and storytelling remain intact. Vercel Functions connect account checkout to the Foco subscription backend and handle Wompi callbacks and receipts. Supabase stores subscription and dispatch state; private Vercel Blob storage preserves receipts and historical orders. No frontend framework or marketing SDK was added.

## Local checks

```sh
npm ci
npm test
npm run build
npm run preview:receipt
python3 -m http.server 8766 --bind 127.0.0.1
```

Checkout source: `http://127.0.0.1:8766/foco/comprar/`. To preview canonical paths, run `npm run build:vercel` and serve `dist/`; the cart is at `/comprar/`. Synthetic email preview: `http://127.0.0.1:8766/.artifacts/receipt-preview.html`. Python serves static files only, not the API. The receipt preview is excluded from the production build. Never expose this source-directory development server publicly.

## Current purchase flow — subscriptions released 2026-10-04

The production offer at `/comprar/` uses one Foco account across the website and app. Web plans cost COP 14,900 monthly, 39,900 quarterly and 119,900 annually. Wompi authorizes the stored payment method; the server charges only a verified agreement and confirms payment against Wompi. The optional seven-day trial starts with the first verified NFC link after the shipping payment succeeds. A prepaid period for a new card also starts on that link. Shipping time does not consume access.

The former one-time card checkout is retired: `/api/foco/checkout` returns 410 and `/foco/checkout.js` is excluded from the release. Historical receipts, callbacks, accepted policies and lifetime rights remain supported. Do not re-enable legacy sales switches.

Production gates are `FOCO_WEB_SUBSCRIPTION_MODE=production`, `FOCO_WEB_SUBSCRIPTION_LIVE_APPROVED=true` and the separate `FOCO_SUBSCRIPTION_WEBHOOK_ENABLED=true`. The webhook gate stays enabled when new sales are paused. The backend collection and receipt workers run every five minutes. Approved production payments create durable receipt work; only an initial new-card order creates a dispatch record. The existing operator inbox receives that order for manual shipment. Record the carrier and tracking reference, then send them to the buyer. No IVA is added to the agreed prices; receipts are not DIAN invoices.

Release checks: hosted Wompi sandbox authorization, shipping, activation, renewal, duplicate protection, cancellation and provider webhooks passed. Production authentication, catalog, provider acceptance, receipt transport and empty-queue workers passed without a real charge or email. Real-money settlement, refunds and delivery to a real inbox remain untested by this release. The backend repository's `docs/subscription-production-release-2026-10-04.md` and `docs/subscription-operations.md` contain the deployment and operating record.

## Hosting and runtime configuration

Foco production runs on Vercel's **getfoco** project in **juanfgaviriacs-projects**, at https://getfoco.co. Nilho's corporate site remains on Netlify. The Vercel migration section below is the current configuration; the original Netlify launch and sandbox evidence is retained in [release notes](docs/foco-order-receipts-review.md). Do not redeploy the historical Netlify sandbox with the new sender: its key is scoped to nilho.co. New sandbox work needs isolated Vercel test credentials, storage and a test recipient.

## Policy archives and prices

The backend billing catalog owns charged subscription prices; `foco/account-flow.mjs` mirrors the published plan selection. `foco/subscription-policy.mjs` selects the immutable subscription policy version. `checkout-config.mjs` and `commerce-config.mjs` remain only for historical order handling. `scripts/policies.mjs` generates fully rendered policy archives in `foco/compra/versiones/`. Build fails if existing archived content changes: bump the appropriate version and preserve the previous file. Receipts retain their original offer, seller and policy links even after prices change. Never overwrite an archive after a sale.

Card stock remains manual; verify current inventory with the operator before accepting more orders. It is **not** automatically reserved or decremented; pending payments and still-active links require reconciliation. The three legacy reusable production offers were deactivated during launch. Any still-active historical single-use links must be reconciled when stopping sales; disabling the website alone cannot stop them.

### Foco on getfoco.co (Vercel)

The `getfoco` project belongs to `juanfgaviriacs-projects`. `npm run build:vercel`
builds only Foco; the original `npm run build` still builds the Nilho corporate
site for Netlify. Keep both sites' existing editorial/UI changes when merging.

Canonical routes: `/`, `/comprar/`, `/soporte/`, `/privacidad/`, `/terminos/`, `/compra/`,
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

Migration checks, actual new-domain email delivery and exact verification limits
are recorded in [the migration report](docs/foco-vercel-migration.md).
The browser's success URL is not a paid order. Fulfil only Wompi APPROVED orders.

### Dedicated cart page

`/comprar/` is the purchase page; landing purchase links navigate there. Old
`#comprar` links redirect with their query string intact. The two-card offer is
selected by default, with the full COP total and free shipping visible. All
three offers use the same pricing configuration and existing server checkout.
The landing no longer loads the order form or checkout module.

The cart preserves radio keyboard navigation, explicit consent, reduced motion,
retry idempotency, and back/forward state reconciliation. A failed payment-link
request keeps the selected offer available for retry and shows WhatsApp help.
