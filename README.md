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

**Not live:** `productionEnabled` and `consentEvidenceVerified` remain false; server email/checkout flags default off. Tests use synthetic fixtures and mocked providers. No actual transaction or deployment was performed. On 2026-09-21, the authorized `Foco Comprobantes` Resend key was created with sending-only access to `nilho.co`, saved as a Netlify production secret, and one clearly marked synthetic receipt was delivered to `team@nilho.co`. `nilho.co` is verified in the owner's existing Resend account. Merchant approval was confirmed by the owner. Shipping-carrier selection is deferred by the owner; the customer is told the carrier with tracking. No IVA is added to the agreed prices; the email is a purchase receipt, not a DIAN invoice or a finding of tax exemption.

## Configuration still needed

Set these in **Netlify → nilho → Environment variables**, with separate production and deploy-preview values. Prefer Functions-only scope when available. The current plan locks scope selection; marking a variable secret limits its available scopes to Builds, Functions and Runtime (not post processing). The approved Resend key is stored this way for production only; preview, branch, agent and local values are empty. No plan upgrade was purchased. Never put secrets in client code, git, chat or logs. `.env.example` contains names only.

| Variable | Purpose |
| --- | --- |
| `WOMPI_ENVIRONMENT` | **Configured**: `prod` in Production, `test` in other contexts |
| `WOMPI_PRIVATE_KEY` | **Configured secret**: production key in Production, sandbox key in Deploy Previews; other contexts empty |
| `WOMPI_PUBLIC_KEY` | **Configured secret** in the same two contexts; verifies link merchant ownership |
| `WOMPI_EVENTS_SECRET` | **Configured secret** in the same two contexts; verifies callback checksum |
| `RESEND_API_KEY` | **Configured**: separate production and preview sending-only keys, both scoped to `nilho.co` |
| `FOCO_CHECKOUT_ENABLED` | `false` until reviewed; server kill switch |
| `FOCO_EMAIL_ENABLED` | `false` until an authorized send test succeeds |
| `FOCO_TEST_EMAIL_TO` | Sandbox-only allowlist recipient; use `team@nilho.co` for the approved integration test |
| `FOCO_SANDBOX_ORIGIN` | Sandbox-only draft origin; `https://foco-checkout-sandbox--nilho.netlify.app` |

Netlify Blobs authenticates automatically in hosted functions. Do not create or publish a storage token. Private stores are separated: `foco-orders-test` and `foco-orders-prod`. Runtime values must be available to Functions, not just Builds.

Wompi credentials were connected on 2026-09-21. The real sandbox API created and independently returned all three exact-amount, single-use links with shipping collection and one-hour expiry. Retrying each order reused its link. This validates the provider contract, not a completed payment or hosted Netlify storage.

The owner authorized the sandbox preview and a separate Resend key. `Foco Pruebas` is now stored only in the Deploy Previews context; the production key remains unchanged. Before launch: complete CLI authorization and deploy the sandbox; configure callbacks to the deployed preview and, at launch, `https://nilho.co/api/foco/wompi`; verify actual sandbox transaction → stored consent → one delivered test receipt, including duplicate webhook replay; review the archived policies and fulfilment operation; retire the old reusable links; obtain final publication approval. Then set the client readiness flags and server flags together. Production keys cannot run in deploy previews. No paid plan should be purchased automatically.

For the approved sandbox, `node scripts/build-sandbox.mjs` prepares a clearly labelled draft in `dist/` without changing production source gates. Deploy only to alias `foco-checkout-sandbox`, context `deploy-preview`, with deploy-only email/checkout switches enabled and the two test settings above. Never use `--prod` with that artifact. Sandbox receipts are marked `[PRUEBA]` and restricted to the configured recipient.

The final redirect is `https://nilho.co/foco/pago/`. It stays neutral and must be published with the checkout. [Launch runbook](docs/foco-checkout-launch.md) · [Order operations](docs/foco-order-operations.md).

## Policy archives and prices

`checkout-config.mjs` owns executable prices; `commerce-config.mjs` owns seller/product/stock information. `scripts/policies.mjs` generates fully rendered policy archives in `foco/compra/versiones/`. Build fails if existing archived content changes: bump the appropriate version and preserve the previous file. Receipts retain their original offer, seller and policy links even after prices change. Never overwrite an archive after a sale.

Stock remains manual (30 initially, pause at five). It is **not** automatically reserved or decremented; pending payments and still-active links require reconciliation. Existing reusable production links remain active outside this website until retired explicitly. Disabling the website alone cannot stop them.
