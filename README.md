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

## Current purchase flow — sandbox deployed, production off

The owner approved **one server-created, single-use Wompi link per order**, replacing three reusable links. Amounts still come from `foco/checkout-config.mjs`: 11000000, 20000000 and 25000000 centavos. Wompi collects the address once. Links expire after one hour; their SKU is the order UUID, while the stored order and link description retain FOCO-01/02/03.

The server records accepted policy versions, timestamp, archived HTML and hashes with the order before creating the link. It verifies Wompi's callback signature and independently retrieves the transaction using the private API. Only an APPROVED transaction matching the saved link, environment, COP amount and order can generate a Resend receipt. Redirect parameters never confirm payment. Netlify Blobs contains a minimal private order/consent/receipt ledger; there is no customer-account database or duplicated shipping form.

**Not live:** `productionEnabled` and `consentEvidenceVerified` remain false; server email/checkout flags default off. Tests use synthetic fixtures and mocked providers. No payment has been submitted. An isolated sandbox draft is deployed; hosted order creation and callbacks are still pending configuration. On 2026-09-21, the authorized `Foco Comprobantes` Resend key was created with sending-only access to `nilho.co`, saved as a Netlify production secret, and one clearly marked synthetic receipt was delivered to `team@nilho.co`. `nilho.co` is verified in the owner's existing Resend account. Merchant approval was confirmed by the owner. Shipping-carrier selection is deferred by the owner; the customer is told the carrier with tracking. No IVA is added to the agreed prices; the email is a purchase receipt, not a DIAN invoice or a finding of tax exemption.

## Configuration still needed

Set these in **Netlify → nilho → Environment variables**, with separate production and sandbox-branch values. Prefer Functions-only scope when available. The current plan locks scope selection; marking a variable secret limits its available scopes to Builds, Functions and Runtime (not post processing). Resend has separate production and `foco-checkout-sandbox` branch values; generic preview/branch, agent and local values are empty. No plan upgrade was purchased. Never put secrets in client code, git, chat or logs. `.env.example` contains names only.

| Variable | Purpose |
| --- | --- |
| `WOMPI_ENVIRONMENT` | **Configured**: `prod` in Production, `test` in other contexts |
| `WOMPI_PRIVATE_KEY` | **Configured secret**: production key in Production, sandbox key in Deploy Previews; other contexts empty |
| `WOMPI_PUBLIC_KEY` | **Configured secret** in the same two contexts; verifies link merchant ownership |
| `WOMPI_EVENTS_SECRET` | **Configured secret** in the same two contexts; verifies callback checksum |
| `RESEND_API_KEY` | **Configured**: separate production and `foco-checkout-sandbox` sending-only keys, both scoped to `nilho.co` |
| `FOCO_CHECKOUT_ENABLED` | `false` until reviewed; server kill switch |
| `FOCO_EMAIL_ENABLED` | `false` until an authorized send test succeeds |
| `FOCO_TEST_EMAIL_TO` | Sandbox-only allowlist recipient; use `team@nilho.co` for the approved integration test |
| `FOCO_SANDBOX_ORIGIN` | Sandbox-only draft origin; `https://foco-checkout-sandbox--nilho.netlify.app` |

Netlify Blobs authenticates automatically in hosted functions. Do not create or publish a storage token. Private stores are separated: `foco-orders-test` and `foco-orders-prod`. Runtime values must be available to Functions, not just Builds.

Wompi credentials were connected on 2026-09-21. The real sandbox API created and independently returned all three exact-amount, single-use links with shipping collection and one-hour expiry. Retrying each order reused its link. This validates the provider contract, not a completed payment or hosted Netlify storage.

The owner authorized the sandbox preview, a separate Resend key, test email to `team@nilho.co`, and the official Netlify CLI. The draft is at `https://foco-checkout-sandbox--nilho.netlify.app/foco/#comprar`. Wompi keys are still in Deploy Previews and must be copied to the specific `foco-checkout-sandbox` branch context before the next deploy. A CLI alias deploy has runtime context `branch-deploy`; `--context deploy-preview` controls build variables only and does not change that runtime context.

Resend is now restored with `Foco Comprobantes Netlify` in Production and `Foco Sandbox Netlify` only on the sandbox branch. An attempted bulk context edit cleared the previous stored values; replacement keys with the same sending-only/domain scopes were saved and read back. Server production switches remained false throughout. Use a single-value PATCH (`setEnvVarValue`) for future context updates; never omit secret values in a bulk replacement.

Before launch: finish sandbox Wompi credentials and webhook, verify actual sandbox transaction → stored consent → one delivered receipt and duplicate callback replay, review policies/fulfilment, retire legacy reusable links, and obtain final publication approval. Wompi is signed out again; the owner was asked to log back in. No completed end-to-end payment is claimed.

For the sandbox, the `foco-checkout-sandbox` build context runs `scripts/build-sandbox.mjs`, producing a labelled draft without changing production source gates. Deploy only to alias `foco-checkout-sandbox` with deploy-only email/checkout switches enabled and the two test settings above. Never use `--prod` with that artifact. Sandbox receipts are marked `[PRUEBA]` and restricted to the configured recipient.

The final redirect is `https://nilho.co/foco/pago/`. It stays neutral and must be published with the checkout. [Launch runbook](docs/foco-checkout-launch.md) · [Order operations](docs/foco-order-operations.md).

## Policy archives and prices

`checkout-config.mjs` owns executable prices; `commerce-config.mjs` owns seller/product/stock information. `scripts/policies.mjs` generates fully rendered policy archives in `foco/compra/versiones/`. Build fails if existing archived content changes: bump the appropriate version and preserve the previous file. Receipts retain their original offer, seller and policy links even after prices change. Never overwrite an archive after a sale.

Stock remains manual (30 initially, pause at five). It is **not** automatically reserved or decremented; pending payments and still-active links require reconciliation. Existing reusable production links remain active outside this website until retired explicitly. Disabling the website alone cannot stop them.
