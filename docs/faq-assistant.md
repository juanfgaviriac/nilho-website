# Foco FAQ assistant

## Source of truth

The homepage and support page share seven static, accessible FAQs and an inline,
optional AI question field. `scripts/faq.mjs` owns the short copy and the build-time
renderer. Edit those entries, not generated `dist/` files.

Both builds compile `server/foco/faq-knowledge.json` from the reviewed public support,
purchase terms, purchase privacy, app privacy and app terms sections. Prices come
from `foco/checkout-config.mjs`. The JSON is a server-only generated artifact,
explicitly included in the Vercel function, never copied into `dist/`.

To update knowledge: update the appropriate public page or configuration, run tests
and build, review the generated sources, then deploy. Commercial policy changes
still require a new version and immutable archive through the existing policy flow.
Do not add private operational documents, customer records, credentials or raw logs.

## Model and activation

- Model: `openai/gpt-5.6-luna` through Vercel AI Gateway, routing only to OpenAI.
- Model availability/pricing checked on 2026-09-21 at
  https://vercel.com/ai-gateway/models/gpt-5.6-luna ($0.20/M input, $1.20/M output).
- Gateway requires paid credits for this model; the free tier alone was rejected.
- Authenticate with Vercel OIDC. Never place a Gateway/provider key in browser code.
- Production requires `FOCO_FAQ_ENABLED=true`, a separate random
  `FOCO_FAQ_RATE_SECRET`, and the existing private Blob configuration.
- Disable by setting `FOCO_FAQ_ENABLED=false` and redeploying. Static FAQs and
  support links remain available. This feature is served by the getfoco Vercel
  function; the legacy Netlify site has static FAQs but no new AI function.

## Boundaries and limits

One model call per accepted question, no tools, no conversation memory, no autonomous
actions, no order/account access. Questions are limited to 500 characters / 2 KB JSON;
the reviewed knowledge payload cannot exceed 50,000 characters. The model has no
reasoning, no SDK retries, a 500-output-token cap and a 20-second timeout.

All production instances share an atomic counter at `prod/faq/budget`, separate
from purchase records. The hard ceiling is 100 accepted model requests per UTC day
(resets at 7 p.m. Colombia), with 3/minute and 10/day per network address. Failed or
cancelled model requests still count. Known personal data/actions receive a fixed
support handoff without a provider call. Missing configuration/storage fails closed.
The visitor check is an abuse deterrent, not authentication; visitors sharing a
network also share that allowance. Deployments without Vercel's trusted forwarded
IP headers need a trusted-proxy equivalent, not arbitrary client-supplied headers.

The single counter object stores daily HMAC identifiers and counts, not raw IPs or
question text. Its map is replaced on the first request of the next UTC day; it is
not a background deletion job. SDK telemetry is disabled, model errors are not
logged, and OpenAI `store` is false. These settings do not claim universal zero
retention: Vercel/OpenAI service security/retention policies still apply. Review
Gateway content-logging configuration before changing those guarantees.

The model selects allowlisted source IDs; URLs come from the server. Responses are
rendered as plain text. Unsupported questions hand off to a person. This reduces
hallucination risk but does not guarantee factual accuracy; source and disclaimer
links remain visible. A small PII guard catches common emails, long numbers and
URLs, but cannot detect every personal detail.

## Verification

`npm test` runs offline tests, including race conditions at 99/100 requests,
per-visitor limits, midnight reset, source coverage, privacy guards, invalid model
output, wrong origins, oversized bodies and provider/storage failures. No paid
calls occur in the ordinary suite.

`vercel env run -e development -- node scripts/evaluate-faq.mjs --paid` explicitly
runs ten synthetic live-model cases (no real visitor data). This evaluation is
separate from production counters and requires Gateway credit access. Review the
actual answers as well as the lightweight assertions. Verify one real browser
request on the deployed site and confirm that the source link leads to the quoted
section. Never create orders or send receipts to test the FAQ.
