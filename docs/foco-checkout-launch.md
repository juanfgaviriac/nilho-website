# Foco checkout launch runbook

## Current architecture

Owner approved single-use links per order on 21 September 2026. This supersedes the former three-reusable-links implementation. The page stays static; server code runs in Vercel Functions using a private Vercel Blob ledger. The owner authorized production publication on 2026-09-21 after the completed sandbox verification.

1. Browser sends quantity, explicit acceptance, policy versions and a random attempt ID to `/api/foco/checkout`. It never supplies prices, buyer email or a redirect.
2. Server stores order, exact offer/seller snapshot, accepted-at timestamp, policy versions and SHA256 hashes; archives fully rendered policies. Same attempt ID returns the existing link when safe. Ambiguous Wompi creation failures require review, not a second blind POST.
3. Server creates and reads back a fixed COP Wompi link, `single_use=true`, `collect_shipping=true`, one-hour expiry and order UUID as SKU. Merchant public key, amount, currency, environment and redirect must match. Product SKU remains in description and saved order.
4. Wompi calls `/api/foco/wompi`. Signature verification is followed by authenticated transaction lookup; email and link from unsigned callback fields are never trusted.
5. An APPROVED matching order is durably claimed. The complete receipt payload is frozen, sent via Resend and its message ID saved. A lease and conditional writes protect concurrent callbacks; Resend's deterministic idempotency key protects ambiguous retries within 24 hours. Unresolved sends older than 23 hours require manual reconciliation, never automatic resend.
6. Buyer returns to a neutral page. Fulfilment and tracking remain manual after dashboard verification.

## Production configuration

- Project: **getfoco**, account **juanfgaviriacs-projects**, GitHub `juanfgaviriac/nilho-website` main. Domain: **https://getfoco.co**; www redirects to apex.
- Vercel Production only: `WOMPI_ENVIRONMENT=prod`, `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `RESEND_API_KEY`, private `BLOB_READ_WRITE_TOKEN`, `FOCO_CHECKOUT_ENABLED=true`, `FOCO_EMAIL_ENABLED=true`. Payment and email keys are Sensitive variables; never print or commit them. Preview has no production credentials.
- Resend sending key is scoped to verified getfoco.co. Sender: `Foco <team@getfoco.co>`; reply-to: `team@getfoco.co`. Namecheap forwards incoming support to `team@nilho.co`. Forwarding does not configure a manual send-as identity.
- Wompi production callback: **https://getfoco.co/api/foco/wompi**. Checkout redirects to **https://getfoco.co/pago/**. The old nilho.co callback forwards events and status to this verifier; its checkout returns 410. Do not restore the old independent ledger writer.
- Private Blob store: **foco-orders-production**, production only. Strong origin reads use `useCache:false` and `Accept-Encoding:identity` to preserve atomic body/ETag identity. Atomic create and compare-and-swap are required for every order/receipt claim.
- Nilho's corporate site remains on Netlify. Its former Foco production ledger was empty at cutover. Historical sandbox evidence stays archived there; it is not the active production system. New sandbox tests require isolated Vercel test credentials/store and a fixed recipient.
- Deployment and test evidence: [Vercel migration verification](foco-vercel-migration.md). Earlier Netlify launch history remains in [dated release notes](foco-order-receipts-review.md).

## Required live acceptance

For each of 1, 2 and 3 cards: create a sandbox order, read back Wompi's exact amount (11000000 / 20000000 / 25000000 cents), merchant, single use, shipping, SKU, redirect and expiry. Make one authorized sandbox test payment; inspect stored order/consent and archived policy. Verify one receipt in Resend and actual delivery to an approved recipient. Replay the callback and confirm no second message. Also verify declined/pending payment and expired link behavior. All automated tests mock providers: they are not evidence of the Wompi checks. Separate live sandbox evidence is now recorded in `foco-order-receipts-review.md`: three offers, hosted archival, approved browser payment, delivered Foco receipt and two concurrent signed duplicate replays passed. A standalone authorized Resend test was delivered to team@nilho.co, confirming that key/sender/recipient path only; it did not run through a deployed Netlify function, Wompi or Blobs.

Confirm the result page and versioned policy URLs resolve on the final domain. User reported Wompi approval, but the merchant dashboard on 2026-09-21 still displayed a banner saying receipts can accumulate while merchant approval is pending and labelled the balance as under review. Confirm withdrawal eligibility before launch; settlement and refunds were not tested. Carrier is intentionally deferred; keep the approved delivery promise operational. No added IVA or invented exemption. Email is a commercial receipt, not an electronic tax invoice.

## Retired legacy production links

These were created earlier and are no longer used anywhere in client routing. **Deactivated during the approved production launch, with Wompi readback.** Retired production IDs: `yUHYqh` (1), `YtP4V0` (2), `iqLMCM` (3). Sandbox IDs: `test_sTaCFM`, `test_tgJotM`, `test_ql8j7i`. The earlier `n2yplv` was already inactive. Legacy-link transactions are ignored by the new receipt handler because they lack a recorded order/consent mapping; handle them manually. These legacy production links must remain inactive; new purchases must begin on the website to record order consent.

## Deployment / stop

Publish only after explicit final approval. Use `npm ci && npm test && npm run build:vercel`; Vercel serves `dist/` and runs `api/foco/`. Git main deploys the linked project. `npm run build` remains the separate Nilho/Netlify artifact. Deploy previews must never receive production secrets. Check static asset coverage, callback response, neutral return page, policies and browser flow after deployment before declaring sales enabled.

Stop creation using `FOCO_CHECKOUT_ENABLED=false` and update public availability. This does not revoke issued links. Pause outstanding links in Wompi and reconcile pending transactions; leave the verified webhook/email processor running for already-approved orders. Never turn off confirmation handling just to stop new sales.

Sources: [Wompi links](https://docs.wompi.co/docs/colombia/links-de-pago/), [events](https://docs.wompi.co/docs/colombia/eventos/), [transaction lookup](https://docs.wompi.co/docs/colombia/seguimiento-de-transacciones/), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vercel private Blob storage](https://vercel.com/docs/vercel-blob/using-blob-sdk).
