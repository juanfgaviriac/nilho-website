# Nilho static website

Plain HTML/CSS/JS hosted on Netlify. Foco lives at `/foco/`; no framework, build step, cart database, Wompi SDK or new analytics provider.

## Foco checkout — private preview, not enabled for sales

Run locally from this directory:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
node --test tests/foco-checkout.test.mjs
```

Open `http://127.0.0.1:8766/foco/#comprar`. All purchase CTAs enter the inline checkout; two cards are selected initially. Arrow keys, Home/End, Space/Enter work in the radio group. Refresh returns to two; back/forward restoration reconciles the summary with the selected offer. No cart/customer data is stored. Wompi collects the shipping address once.

### Configuration and launch blockers

The single source of truth is `foco/checkout-config.mjs`. Totals and centavos are calculated from the configured subtotal, discount and shipping. Do not put private keys, integrity secrets, bank account details or RUT documents in the repository, browser code or chat.

| Offer / SKU | Product subtotal | Discount | Shipping | Final COP | Wompi centavos |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 / FOCO-01 | 100,000 | 0 | 10,000 | 110,000 | 11000000 |
| 2 / FOCO-02 | 200,000 | 0 | 0 | 200,000 | 20000000 |
| 3 / FOCO-03 | 300,000 | 50,000 | 0 | 250,000 | 25000000 |

This table documents the approved requirements; executable prices exist only in the configuration and their independent test expectations. HTML contains no duplicate prices.

Required before deployment or enabling payments:

- **Production links configured:** all three `wompiUrl` values are mapped to verified active production links (see below). `productionEnabled` stays `false` until the remaining launch requirements are complete. Blank, invalid, sandbox or duplicated URLs fail closed.
- **Redirect deployment:** all production links use `https://nilho.co/foco/pago/` (`redirectUrl`). Publish and verify this page with checkout before promoting the links. It is built locally, not deployed by this change.
- **Merchant onboarding:** the owner selected **persona natural** for the initial launch. Complete the personal merchant registration directly with Wompi, using a receiving account in the merchant's name. Before enabling payment, verify the legal seller identity and show it in the purchase disclosures/policies consistently with Wompi and invoicing. The existing Nilho app/site branding does not establish the card seller's identity. The live merchant brand Foco and production mode were verified; final merchant/payout approval remains unverified. Wompi displayed that payments can be collected but funds stay in Wompi Cuenta pending merchant approval. Never commit RUT documents, personal identifiers or bank details.
- **IVA / invoicing:** accountant to confirm treatment, any required legal customer fields and invoice process. Do not invent IVA or increase the advertised total. Add any approved tax breakdown in Wompi only after confirmation.
- **Policies:** approve shipping, returns and warranty copy, publish its page and set `shippingReturnsUrl`. Existing `/foco/terminos/` covers app use, not shipping/returns. Checkout deliberately shows a visible TODO until real policy exists. Also review legacy support/terms references to ten emergency unlocks before launch (current product shows three); no legal text was changed in this branch.
- **WhatsApp:** `FOCO_WHATSAPP_URL` uses the previously supplied Foco support number `+573027738407`. Confirm it is the correct business contact and fulfilment channel. The constant is shared with the payment-result page. Links open a draft only; nothing is sent automatically.
- **Stock:** confirm current stock or explicitly approve launch without inventory enforcement. This static implementation does not reserve cards or prevent overselling.
- **Final review / explicit approval:** complete merchant, link, policy, stock, browser and payment checks first. Only then enable `productionEnabled` and deploy with the owner's explicit approval. Do not push this work to the auto-deploying `main` branch before approval.

### Creating and verifying the Wompi links

Sandbox offers were created through the Wompi merchant dashboard on 2026-09-21:

- FOCO-01: <https://checkout.wompi.co/l/test_sTaCFM>
- FOCO-02: <https://checkout.wompi.co/l/test_tgJotM>
- FOCO-03: <https://checkout.wompi.co/l/test_ql8j7i>

The dashboard confirmed all three exact totals, reusable links, shipping collection, matching SKUs and the configured return URL. No expiry or tax breakdown was supplied. Their public checkouts displayed test mode and the shipping form. No test transaction has been completed, and the return page has not been deployed. The URLs are stored as `sandboxUrl`, separate from the production `wompiUrl`; production routing explicitly rejects `test_` links. The website is still disabled for payments.

The earlier production FOCO-01 link `n2yplv` remains inactive and is excluded from the integration. Do not reuse it. Opening a new browser session can start in production: verify the explicit environment, not the generic link shown on the home screen.

The owner explicitly authorized production links on 2026-09-21. The following links were created in production and read back as active in the merchant dashboard:

| Offer / SKU | Production checkout | Fixed COP | Centavos |
| --- | --- | ---: | ---: |
| 1 / FOCO-01 | <https://checkout.wompi.co/l/yUHYqh> | 110,000 | 11000000 |
| 2 / FOCO-02 | <https://checkout.wompi.co/l/YtP4V0> | 200,000 | 20000000 |
| 3 / FOCO-03 | <https://checkout.wompi.co/l/iqLMCM> | 250,000 | 25000000 |

For all three, saved details confirmed reusable links (not single use), shipping collection, matching SKU and `https://nilho.co/foco/pago/`. No expiry or tax breakdown was supplied. Each public checkout was opened read-only: the displayed fixed total matched the table, the shipping form was present and there was no test-mode banner. No buyer data was entered and no transaction was submitted. This verifies link configuration and initial checkout rendering, not payment settlement or the return journey.

Production URLs are now mapped in the local configuration. The website remains undeployed and its payment button gated while merchant disclosures, IVA/invoicing, commercial policies, inventory and final launch review are incomplete. The return page also remains undeployed. The widget was discussed but not selected; this implementation continues to use fixed links.

Use the Wompi merchant dashboard or a trusted server-side environment, never a browser private key. `paymentLinkDefinition(quantity)` exports the intended payload without making any request. To inspect all three non-secret definitions locally:

```sh
node --input-type=module -e "import { paymentLinkDefinition } from './foco/checkout-config.mjs'; console.log(JSON.stringify([1,2,3].map(q => paymentLinkDefinition(q)), null, 2))"
```

For every link: fixed exact `amount_in_cents` above, `currency: COP`, `single_use: false`, `collect_shipping: true`, correct `sku`, clear product name, confirmed `redirect_url`, active and no expiry. Omit taxes until confirmed. No custom customer fields are added; Wompi shipping already collects recipient phone/address. If more fields are actually needed, Wompi permits at most two custom references.

Before mapping URLs, independently inspect each link in the merchant dashboard or Wompi's public `GET /v1/payment_links/{id}` response. Verify amount, SKU, merchant, production environment, active state, reuse, shipping collection, redirect and no expiry. Open each checkout and confirm it displays the expected amount. The client cannot infer these properties from an opaque link ID. Do not edit amounts through URL parameters or reuse one offer's link for another.

### Payment result and fulfilment

`/foco/pago/?id=...` shows **“Estamos verificando tu pago”**, a safely rendered transaction reference, WhatsApp and support. It deliberately does not poll Wompi, claim approval, create an order or dispatch anything. Missing, duplicate or malformed IDs get a neutral support fallback. Extra URL parameters, including `status=APPROVED`, have no effect. Reference pages are `noindex` and use `no-referrer`.

The operator must locate the transaction in the **Wompi dashboard** (or a trusted authenticated server/API workflow), verify `APPROVED`, the merchant, correct link/SKU, currency and exact amount, and check it has not already been fulfilled before dispatch. Match the recipient and shipping address from Wompi. Send tracking over WhatsApp after dispatch. A redirect or screenshot is not payment evidence. There is no automated fulfilment and no cash on delivery.

### Analytics and verification

No analytics was installed on this static page, so this change adds no SDK or analytics events. If an existing approved analytics system is connected later, the requested events are `checkout_opened`, `offer_selected`, `checkout_started`, `whatsapp_fallback_clicked`, with quantity and total only; never send identity, shipping data or transaction IDs.

Tests cover all three independent amounts/centavos, shipping/discount, reusable link definitions, fail-closed routing, absent/invalid/duplicate URLs, default state and malicious result parameters. Browser acceptance evidence is recorded in `foco-checkout-review.md`.

Sources: [Wompi payment links](https://docs.wompi.co/docs/colombia/links-de-pago/) and [redirect handling](https://docs.wompi.co/docs/colombia/widget-checkout-web/#paso-4-url-de-redirección). Wompi documents the redirect as informational; frontend transaction lookup is no longer supported. Launch uses manual dashboard verification, without adding a customer database.
