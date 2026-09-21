# Nilho website

Plain HTML/CSS/JS on Netlify. Foco: `/foco/`. The static design, NFC demo and storytelling remain intact. A small Node build copies public assets to `dist/`; two Netlify Functions handle order creation and Wompi callbacks. No frontend framework or marketing SDK was added.

## Local checks

```sh
npm ci
npm test
npm run build
npm run preview:receipt
python3 -m http.server 8766 --bind 127.0.0.1
```

Checkout: `http://127.0.0.1:8766/foco/#comprar`. Synthetic email preview: `http://127.0.0.1:8766/.artifacts/receipt-preview.html`. Python serves static files only, not the API. The receipt preview is excluded from the production build. Never expose this source-directory development server publicly.

## Current purchase flow — prepared, not deployed

The owner approved **one server-created, single-use Wompi link per order**, replacing three reusable links. Amounts still come from `foco/checkout-config.mjs`: 11000000, 20000000 and 25000000 centavos. Wompi collects the address once. Links expire after one hour; their SKU is the order UUID, while the stored order and link description retain FOCO-01/02/03.

The server records accepted policy versions, timestamp, archived HTML and hashes with the order before creating the link. It verifies Wompi's callback signature and independently retrieves the transaction using the private API. Only an APPROVED transaction matching the saved link, environment, COP amount and order can generate a Resend receipt. Redirect parameters never confirm payment. Netlify Blobs contains a minimal private order/consent/receipt ledger; there is no customer-account database or duplicated shipping form.

**Not live:** `productionEnabled` and `consentEvidenceVerified` remain false; server email/checkout flags default off. Tests use synthetic fixtures and mocked providers. No actual transaction, email, key creation or deployment was performed. `nilho.co` is verified in the owner's existing Resend account. Merchant approval was confirmed by the owner. Shipping-carrier selection is deferred by the owner; the customer is told the carrier with tracking. No IVA is added to the agreed prices; the email is a purchase receipt, not a DIAN invoice or a finding of tax exemption.

## Configuration still needed

Set these in **Netlify → this site's environment variables → Functions**, with separate production and deploy-preview values. Never put secrets in client code, git, chat or logs. `.env.example` contains names only.

| Variable | Purpose |
| --- | --- |
| `WOMPI_ENVIRONMENT` | `test` in sandbox/preview; `prod` only in Netlify production context |
| `WOMPI_PRIVATE_KEY` | Server payment-link creation and authenticated transaction lookup |
| `WOMPI_PUBLIC_KEY` | Verify each created link belongs to this merchant |
| `WOMPI_EVENTS_SECRET` | Verify Wompi callback checksum; same environment as keys |
| `RESEND_API_KEY` | Dedicated sending-only key scoped to the verified `nilho.co` domain |
| `FOCO_CHECKOUT_ENABLED` | `false` until reviewed; server kill switch |
| `FOCO_EMAIL_ENABLED` | `false` until an authorized send test succeeds |

Netlify Blobs authenticates automatically in hosted functions. Do not create or publish a storage token. Private stores are separated: `foco-orders-test` and `foco-orders-prod`. Runtime values must be available to Functions, not just Builds.

Before launch: configure secrets and Wompi callback to `https://nilho.co/api/foco/wompi` (a separate preview URL for sandbox); verify actual sandbox transaction → stored consent → one delivered test receipt, including duplicate webhook replay; review the archived policies and fulfilment operation; retire the old reusable links; obtain final publication approval. Then set the client readiness flags and server flags together. Production keys cannot run in deploy previews. No paid plan should be purchased automatically.

The final redirect is `https://nilho.co/foco/pago/`. It stays neutral and must be published with the checkout. [Launch runbook](docs/foco-checkout-launch.md) · [Order operations](docs/foco-order-operations.md).

## Policy archives and prices

`checkout-config.mjs` owns executable prices; `commerce-config.mjs` owns seller/product/stock information. `scripts/policies.mjs` generates fully rendered policy archives in `foco/compra/versiones/`. Build fails if existing archived content changes: bump the appropriate version and preserve the previous file. Receipts retain their original offer, seller and policy links even after prices change. Never overwrite an archive after a sale.

Stock remains manual (30 initially, pause at five). It is **not** automatically reserved or decremented; pending payments and still-active links require reconciliation. Existing reusable production links remain active outside this website until retired explicitly. Disabling the website alone cannot stop them.
