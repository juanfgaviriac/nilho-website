# Foco checkout launch runbook

## Current architecture

Owner approved single-use links per order on 21 September 2026. This supersedes the former three-reusable-links implementation. The page stays static; server code runs in Netlify Functions using a private Netlify Blobs ledger. Do not deploy before final approval.

1. Browser sends quantity, explicit acceptance, policy versions and a random attempt ID to `/api/foco/checkout`. It never supplies prices, buyer email or a redirect.
2. Server stores order, exact offer/seller snapshot, accepted-at timestamp, policy versions and SHA256 hashes; archives fully rendered policies. Same attempt ID returns the existing link when safe. Ambiguous Wompi creation failures require review, not a second blind POST.
3. Server creates and reads back a fixed COP Wompi link, `single_use=true`, `collect_shipping=true`, one-hour expiry and order UUID as SKU. Merchant public key, amount, currency, environment and redirect must match. Product SKU remains in description and saved order.
4. Wompi calls `/api/foco/wompi`. Signature verification is followed by authenticated transaction lookup; email and link from unsigned callback fields are never trusted.
5. An APPROVED matching order is durably claimed. The complete receipt payload is frozen, sent via Resend and its message ID saved. A lease and conditional writes protect concurrent callbacks; Resend's deterministic idempotency key protects ambiguous retries within 24 hours. Unresolved sends older than 23 hours require manual reconciliation, never automatic resend.
6. Buyer returns to a neutral page. Fulfilment and tracking remain manual after dashboard verification.

## External setup still required

- **Completed 2026-09-21:** dedicated `Foco Comprobantes` send-only key scoped to `nilho.co`, saved as a production secret on the existing `nilho` Netlify project. Functions-only scope requires an upgrade on this account; the secret uses the plan's Builds/Functions/Runtime scope, with every non-production context empty. No paid upgrade was made. `Foco <team@nilho.co>` is the sender and reply-to is `team@nilho.co`.
- Wompi sandbox/private/public/events values in a sandbox deploy context; production values only in production. No secrets in git or chat. See `.env.example`. These Wompi values remain unconfigured.
- Sandbox webhook points to the authorized sandbox preview `/api/foco/wompi`; production webhook points to `https://nilho.co/api/foco/wompi`. Inspect existing event destinations before modifying; do not break unrelated commerce.
- Verify Netlify Functions can read the included policy archives and strongly consistent Blobs store. Check existing plan limits before enabling; do not buy a plan without permission.
- Public client flags stay off and server flags default false until end-to-end readback and final approval. Enabling only the checkout server flag cannot bypass missing email configuration.

## Required live acceptance

For each of 1, 2 and 3 cards: create a sandbox order, read back Wompi's exact amount (11000000 / 20000000 / 25000000 cents), merchant, single use, shipping, SKU, redirect and expiry. Make one authorized sandbox test payment; inspect stored order/consent and archived policy. Verify one receipt in Resend and actual delivery to an approved recipient. Replay the callback and confirm no second message. Also verify declined/pending payment and expired link behavior. All automated tests mock providers: they are not evidence of the Wompi checks. A standalone authorized Resend test was delivered to team@nilho.co, confirming that key/sender/recipient path only; it did not run through a deployed Netlify function, Wompi or Blobs.

Confirm the result page and versioned policy URLs resolve on the final domain. User reported Wompi approval; settlement and refund operation were not independently tested. Carrier is intentionally deferred; keep the approved delivery promise operational. No added IVA or invented exemption. Email is a commercial receipt, not an electronic tax invoice.

## Legacy links to retire before launch

These were created earlier and are no longer used anywhere in client routing. **They have not been deactivated by this implementation.** Existing active production IDs: `yUHYqh` (1), `YtP4V0` (2), `iqLMCM` (3). Sandbox IDs: `test_sTaCFM`, `test_tgJotM`, `test_ql8j7i`. The earlier `n2yplv` was already inactive. Legacy-link transactions are ignored by the new receipt handler because they lack a recorded order/consent mapping; handle them manually. Retire active reusable links during the approved switch, with readback.

## Deployment / stop

Publish only after explicit final approval. Use `npm ci && npm test && npm run build`; Netlify serves `dist/` and bundles `netlify/functions/`. Deploy previews must never receive production secrets. Check static asset coverage, callback response, neutral return page, policies and browser flow after deployment before declaring sales enabled.

Stop creation using `FOCO_CHECKOUT_ENABLED=false` and update public availability. This does not revoke issued links. Pause outstanding links in Wompi and reconcile pending transactions; leave the verified webhook/email processor running for already-approved orders. Never turn off confirmation handling just to stop new sales.

Sources: [Wompi links](https://docs.wompi.co/docs/colombia/links-de-pago/), [events](https://docs.wompi.co/docs/colombia/eventos/), [transaction lookup](https://docs.wompi.co/docs/colombia/seguimiento-de-transacciones/), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).
