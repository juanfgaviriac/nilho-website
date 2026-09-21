# Nilho static website

Plain HTML/CSS/JS on Netlify. Foco: `/foco/`. No build step or framework.

## Foco checkout (preview only)

```sh
python3 -m http.server 8766 --bind 127.0.0.1
node --test tests/foco-checkout.test.mjs
```

Preview: `http://127.0.0.1:8766/foco/#comprar`.

All prices, discounts and shipping come from `foco/checkout-config.mjs`; totals/centavos are derived. Two cards are selected by default. Wompi handles shipping details. There is no customer database or new analytics SDK.

**Required before deployment or payments:**

- Fill the three distinct `FOCO_CHECKOUT.offers[quantity].wompiUrl` values, after verifying each fixed amount, SKU, merchant, reusable link and `collect_shipping=true` in Wompi.
- Confirm `redirectUrl`: proposed `https://nilho.co/foco/pago/`.
- Merchant choice: persona natural, as requested by the owner. Complete onboarding directly with Wompi using the individual seller's RUT and receiving account. Confirm the seller identity shown in checkout/policies matches Wompi and invoicing before launch. Never commit or request secrets in chat.
- Confirm IVA/invoicing and approve shipping, returns and warranty copy; set `shippingReturnsUrl`. A visible TODO remains until the real policy exists.
- Confirm `FOCO_WHATSAPP_URL` (previously supplied support number `+573027738407`) for business orders.
- Confirm stock or explicitly accept launching without inventory enforcement.
- Complete final review and obtain explicit approval before setting `productionEnabled=true` or deploying. All links are blank and payments disabled now. Do not push to auto-deploying `main` yet.

`/foco/pago/` displays a neutral reference, never payment approval. Fulfil **only** after the merchant verifies Wompi `APPROVED`, the correct amount/product and no previous dispatch.

[Link setup and fulfilment runbook](docs/foco-checkout-launch.md) · [Test evidence](docs/foco-checkout-review.md)
