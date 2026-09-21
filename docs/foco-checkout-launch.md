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

- **Three production links:** fill each `FOCO_CHECKOUT.offers[quantity].wompiUrl` with that offer's exact, distinct, fixed-amount Wompi URL. They are intentionally blank. The button stays disabled while blank or invalid, and `productionEnabled` is currently `false` even if links are added. A Wompi-shaped URL alone does not verify its merchant, amount or environment.
- **Redirect/domain approval:** confirm ownership and final URL `https://nilho.co/foco/pago/` (`redirectUrl`). This page is built locally, not deployed by this change.
- **Merchant onboarding:** merchant to confirm the selling entity/RUT and receiving Bancolombia or Nequi account directly in Wompi. The site currently identifies Nilho S.A.S.; this is not proof of completed merchant onboarding. Never commit the documents or bank details.
- **IVA / invoicing:** accountant to confirm treatment, any required legal customer fields and invoice process. Do not invent IVA or increase the advertised total. Add any approved tax breakdown in Wompi only after confirmation.
- **Policies:** approve shipping, returns and warranty copy, publish its page and set `shippingReturnsUrl`. Existing `/foco/terminos/` covers app use, not shipping/returns. Checkout deliberately shows a visible TODO until real policy exists. Also review legacy support/terms references to ten emergency unlocks before launch (current product shows three); no legal text was changed in this branch.
- **WhatsApp:** `FOCO_WHATSAPP_URL` uses the previously supplied Foco support number `+573027738407`. Confirm it is the correct business contact and fulfilment channel. The constant is shared with the payment-result page. Links open a draft only; nothing is sent automatically.
- **Stock:** confirm current stock or explicitly approve launch without inventory enforcement. This static implementation does not reserve cards or prevent overselling.
- **Final review / explicit approval:** complete merchant, link, policy, stock, browser and payment checks first. Only then enable `productionEnabled` and deploy with the owner's explicit approval. Do not push this work to the auto-deploying `main` branch before approval.

### Creating and verifying the Wompi links

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
