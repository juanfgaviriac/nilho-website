# Foco checkout review — 21 September 2026

Local-only implementation on `codex/foco-checkout`, based on production commit `51323cc`. No push, deployment, merchant account change, payment link creation or transaction was performed.

## Automated checks

`node --test tests/foco-checkout.test.mjs`: **21 passed, 0 failed**.

- Independent expected totals: 110000 / 200000 / 250000 COP and 11000000 / 20000000 / 25000000 centavos.
- Discounts, shipping, SKU, COP, reusable links, shipping collection, proposed redirect, omitted expiry/taxes.
- Default two cards; every payment disabled with current config; blank links remain blocked even if the global flag is set.
- Exact offer-to-link mapping, no fallback, duplicate link rejection, canonical HTTPS Wompi URLs only.
- Invalid quantities, hostile/malformed/duplicate result IDs, forged status parameters.
- Three purchase CTA replacements, no address form, neutral result text.

`node --check` passed for config/checkout/result modules. `git diff --check` passed.

## Browser checks

| Check | Result |
| --- | --- |
| Desktop 1280 px | Three offers and adjacent summary visible; labels/totals fit. |
| Chrome, 390 and 320 px | Offers stack; no label/badge collision; DOM viewport width equals page scroll width. |
| Safari 27 responsive mode, 390 and 320 px | Stacked cards and summary visually inspected; single-card and pack totals change correctly; payment stays disabled. Temporary developer-menu setting restored. |
| Touch targets | Quantity buttons >=155 px high; payment 56 px; WhatsApp/header CTA 44 px at mobile widths. |
| Keyboard | Tab enters selected radio; arrows wrap; Home/End select endpoints; Space/Enter use native button activation; visible focus; live summary announces quantity/total. |
| Assistive labels | Chrome and Safari accessibility trees expose three named radio controls with selected state, amount, shipping and savings. This is an accessibility-tree check, not a full spoken VoiceOver user study. |
| State consistency | All totals verified after repeated selection; refresh resets to two; back navigation leaves selection and summary consistent (browser may reload or restore the page). |
| Layout stability | At the same viewport the payment button position did not change when switching quantity. |
| Entry points | Header, hero and closing CTA all reach/focus `#comprar`. |
| Result | Valid synthetic ID displayed as text; `status=APPROVED` does not change neutral state. Missing/hostile IDs have support fallback; no network verification/fulfilment is simulated. |
| Browser errors | No warnings or errors in the inspected Chrome/embedded-browser logs. |
| Reduced motion | Existing reduced-motion rule retained; checkout transitions also explicitly disabled under the same preference. No new scrolling/animation timer. |

Screenshot artifacts are in the local task folder `.artifacts/checkout-review-2026-09-21/` under the Foco workspace: `desktop-1280.png`, `mobile-390.png`, `mobile-390-summary.png`, `mobile-320.png`, `chrome-390.png`, `chrome-320.png`, `safari-320.png`, `payment-result-320.png`; `tests.txt` contains the automated run.

## Remaining launch validation

Real Wompi links/merchant configuration have not been supplied or verified. No end-to-end payment was attempted. Mobile checks use desktop responsive browser engines, not a physical iPhone payment session. Complete the launch checklist and one approved payment/fulfilment verification only after explicit authorization. See `foco-checkout-launch.md`.
