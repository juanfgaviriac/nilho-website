# Foco web measurement

Public stream `G-3CKE5BGZW0`, GA property `555468568`. Reporting timezone America/Bogota, currency COP.

## Collection

- The production build injects one first-party consent bootstrap into all nine current pages. Accepted policy archives are immutable and untagged. Localhost and previews never contact Google.
- Basic consent mode: no GA script/network/cookies until explicit opt-in. Ads storage, ad user data, ad personalization and Google Signals stay off. Preferences can be changed from the footer. Consent and cookie lifetime: 180 days.
- GA enhanced measurement: only page loads and scrolls. Automatic history, search, forms, outbound links, downloads and video events disabled to avoid sending free-form inputs or full outbound URLs.
- Allowlisted campaign slugs: utm_source, utm_medium, utm_campaign, utm_content. Page query/fragment and free-form promo codes are not sent. Never put personal data in campaign names.
- Events: page_view; view_item on checkout; select_item; begin_checkout; checkout_error; contact_support (WhatsApp method only).
- Server purchase requires an authenticated Wompi APPROVED transaction, exact stored amount/currency, production environment and a stored analytics opt-in with valid client/session IDs. No browser purchase event. GA transaction_id is the verified transaction ID.
- Merchandise value includes pack/promo discounts but excludes shipping. Shipping is its own field. The item represents one purchased pack, not a single card.
- Google failure never changes paid status or suppresses receipt/merchant email. Private ledger leases coordinate retries. Hourly cron retries recent paid orders for up to 71 hours; 2xx means submitted, not proof that GA processed it. Old orders without analytics consent are never backfilled.
- Checkout never waits for GA identifiers. Missing consent, blocked Google or IDs that are not ready mean no GA purchase attribution; the order still appears in private sales totals.

## Dashboard source

`GET /api/foco/insights?days=7|30|90` requires a dedicated server-to-server bearer credential (`COMMERCE_INSIGHTS_TOKEN`). No browser receives it. It exposes aggregates, never orders, transaction IDs or customer details.

Sales and daily totals come from production `paid/` records joined to stored orders. COP amounts are divided by 100 once, summed by approval date in Colombia. They include shipping and discounts, exclude neither fees nor refunds, and are not profit/net revenue. Only managed web checkouts recorded in this ledger are included.

Checkout completion uses orders with a created payment link in the selected period, excluding the newest hour. Numerator: those same orders with verified payments. Denominator is not GA visits. This is order-attempt completion, not unique-buyer conversion. Three retries with different attempt IDs are three attempts.

Lists are fully paginated, strongly read, with at most 5,000 records per prefix and 20 parallel reads. Any missing/malformed/over-capacity data fails the whole sales report; never show partial totals as complete. Cache 60 seconds. For materially larger volume, replace scanning with a reconciled daily rollup before raising the ceiling.

## Production configuration

Website only: `GA4_API_SECRET`, `GA4_PURCHASES_ENABLED=true`, `CRON_SECRET`; website and backend: matching `COMMERCE_INSIGHTS_TOKEN`. All secrets production-only in Vercel. Backend uses a separate GA Viewer service account; never put reporting credentials in public JS.

No test payments are necessary. `npm test` exercises verification, consent, failure isolation, pricing and duplicate delivery with fakes. `npm run build:vercel` checks immutable policies and produces fingerprinted assets.

Reference: [GA ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce), [Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4), [consent](https://developers.google.com/tag-platform/security/concepts/consent-mode).
