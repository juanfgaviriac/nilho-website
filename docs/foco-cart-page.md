# Dedicated Foco cart — 2026-09-21

Purchase CTAs now open `/comprar/`. The landing keeps its existing product story
and NFC demo without loading the checkout controls or module. Shared `#comprar`
links redirect and preserve query parameters. Current legal pages get updated
navigation at build time; signed policy archives remain unchanged.

The standalone page uses the existing Manrope/IBM Plex Mono typography, warm
background and Foco mark, with an animated card stack and the two-card offer
selected by default. The full total and shipping stay explicit for all offers.
Discount appears only for the three-card pack. Server pricing, consent, Wompi
link creation and receipt verification retain their existing contracts.

## Verification

- 62 automated tests passed, including exact centavo amounts, explicit consent,
  retry idempotency, signature verification and duplicate-receipt protection.
- `npm run build:vercel` and `git diff --check` passed.
- Browser review at 1280, 390 and 320 pixels: no horizontal overflow, legible
  non-overlapping offer badges, visible complete totals. Offer/payment targets
  exceed 44 px; consent input is 44 by 44 px.
- All three totals, conditional savings, arrow-key selection, focus movement and
  default two-card selection verified in the rendered page.
- Local-only mock payment-link failures recover and allow retry. Repeating an
  attempt reused its id; changing quantity generated a new id. Captured payloads
  contained only quantity, consent, policy versions and attempt id, no client
  price or personal information.
- Refresh and browser back return consistent selection/summary with consent
  unchecked and payment disabled. Legacy anchor retained campaign parameters.
- No real payment or external order was created for these UI checks.
