# Nilho static website

Plain HTML/CSS/JS on Netlify. Foco: `/foco/`. No build step or framework.

## Foco checkout (preview only)

```sh
python3 -m http.server 8766 --bind 127.0.0.1
node --test tests/foco-checkout.test.mjs
```

Preview: `http://127.0.0.1:8766/foco/#comprar`.

All prices, discounts and shipping come from `foco/checkout-config.mjs`; totals/centavos are derived. Two cards are selected by default. Wompi handles shipping details. There is no customer database or new analytics SDK.

**Production links:** created and verified on 2026-09-21, then mapped to each offer in `checkout-config.mjs`. They are active in Wompi; website payments remain gated (`productionEnabled: false`) until the remaining launch requirements are complete. No real payment was performed.

**Approved and prepared:** dispatch in 1–2 business days, delivery in 3–10 including dispatch, 12-month warranty, statutory withdrawal/refund information, order privacy, and a manual stock pause at five cards. The owner supplied seller identity, public addresses, Bogotá origin, 30 available cards and PVC NTAG215 specifications (86 × 54 mm).

**Still required before publication:**

- Complete `foco/commerce-config.mjs`: shipping carrier/operating arrangement, billing confirmation, and verified transaction-linked consent evidence. These are separate from the disabled publication flag.
- Wompi's required text-reference fields were inspected; an actual sandbox transaction readback is still needed. The website checkbox is not represented as persisted order evidence.
- Confirm package weight/dimensions and shipping quotes. The suggested comparison service is Envia.com; no carrier, guide or paid service was purchased.
- Verify Wompi merchant approval/refund operation. No real payment or payout was performed.
- Publish `/foco/compra/`, `/foco/compra/privacidad/` and `/foco/pago/` with checkout after final review. No push to auto-deploying `main` yet.

`checkout-config.mjs` owns prices; `commerce-config.mjs` owns public seller/product/stock information. `paymentURL` requires both the publication flag and complete commerce configuration. The UI additionally requires current explicit consent. Stock is a manual snapshot, never a reservation system.

[Order operations and message templates](docs/foco-order-operations.md)

`/foco/pago/` displays a neutral reference, never payment approval. Fulfil **only** after the merchant verifies Wompi `APPROVED`, the correct amount/product and no previous dispatch.

[Link setup and fulfilment runbook](docs/foco-checkout-launch.md) · [Test evidence](docs/foco-checkout-review.md)
