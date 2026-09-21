# Foco checkout review — 21 September 2026

## Commercial readiness update

Approved commercial terms, seller identity/addresses, Bogotá dispatch, 30-card manual stock, purchase privacy and operational templates are implemented locally. Production links were created and independently read back earlier today; none were created or edited in this policy update. No deployment or transaction has occurred. The original review below is historical evidence, not current merchant status.

`node --test tests/foco-checkout.test.mjs`: **28 passed, 0 failed**. Added gates for complete seller facts, stock above the manual pause threshold, confirmed billing and verified order-linked consent; explicit current checkbox consent is required. Production remains disabled.

Current browser checks used the Codex embedded Chromium browser:

- 1280 px: three offers beside the summary; commercial conditions use the existing Foco typography, colors, mark and spacing.
- 390 and 320 px: checkout and conditions have no horizontal page overflow; single-card and three-card summaries fit without clipped totals. The purchase privacy page was also opened and inspected.
- At 320 px: quantity controls are at least 155 px tall, consent 44 px, payment 56 px and WhatsApp 44 px.
- Three-card selection shows 250000 COP and the discount; one-card selection shows 110000 COP with no discount row. Checking consent still leaves payment disabled under the current launch gates.
- Back navigation resets consent and keeps the selected offer and summary consistent. Home-key radio navigation and the checkbox's accessible name were inspected.
- No warnings/errors in the inspected browser logs. No physical iPhone checkout, spoken VoiceOver session or payment transaction was performed. Safari evidence in the original review predates this commercial update.

Screenshots: `/Users/juanfelipe/foco/.artifacts/commerce-review-2026-09-21/`, including `desktop-checkout.png`, `desktop-conditions.png`, `mobile-390-summary.png`, `mobile-390-conditions.png`, `mobile-320-summary.png` and `mobile-320-prices.png`.

## Original checkout review

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
| Layout stability | Discount row is omitted for one/two cards. Adding/removing it uses a 200 ms summary resize with translated shipping/footer content; totals update immediately. |
| Entry points | Header, hero and closing CTA all reach/focus `#comprar`. |
| Result | Valid synthetic ID displayed as text; `status=APPROVED` does not change neutral state. Missing/hostile IDs have support fallback; no network verification/fulfilment is simulated. |
| Browser errors | No warnings or errors in the inspected Chrome/embedded-browser logs. |
| Reduced motion | CSS disables checkout transitions; JavaScript skips/cancels summary animations under the same preference. Verified in source; the OS preference was not changed during browser checks. |

Screenshot artifacts are in the local task folder `.artifacts/checkout-review-2026-09-21/` under the Foco workspace: `desktop-1280.png`, `mobile-390.png`, `mobile-390-summary.png`, `mobile-320.png`, `chrome-390.png`, `chrome-320.png`, `safari-320.png`, `payment-result-320.png`; `tests.txt` contains the automated run.

## Remaining launch validation

At the time of the original review, links had not been supplied; the current production link readbacks are now recorded in `foco-checkout-launch.md`. No end-to-end payment has been attempted. Mobile checks use desktop responsive browser engines, not a physical iPhone payment session. Complete the launch checklist and one approved payment/fulfilment verification only after explicit authorization. See `foco-checkout-launch.md`.

## Checkout motion refinement

- Discount row is absent from layout and the accessibility tree for one/two cards; three cards show −$50.000.
- Added 160 ms press feedback, a 200 ms radio indicator, fine-pointer hover lift, and interruptible summary expansion/collapse using native Web Animations. No dependency added.
- Embedded browser: switched repeatedly among all offers, including rapid 1 → 3 → 2; totals and discount visibility settled correctly. Keyboard Home returned to one card with `data-motion="instant"` and computed transition duration `0s`.
- Rechecked desktop 1280 px and mobile 390/320 px; no horizontal overflow, payment remains disabled, controls remain at least 44 px tall. No browser warnings/errors observed.
- Latest screenshots: `desktop-motion-1280.png`, `mobile-motion-390.png`, `mobile-motion-320.png` in the same local artifact folder. Earlier Chrome/Safari evidence predates this motion refinement.
