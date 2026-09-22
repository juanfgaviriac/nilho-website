# Foco FAQ assistant

## Source of truth

The homepage and support page share seven static, accessible FAQs and an inline,
optional AI question field. `scripts/faq.mjs` owns the short copy and the build-time
renderer. Edit those entries, not generated `dist/` files.

The AI input is styled as the final FAQ row. Its short disclosure links directly
to `/terminos/#asistente-ia`, where provider processing, privacy and usage details
are published. Keep that section current when changing the integration.

Both builds compile `server/foco/faq-knowledge.json` from the reviewed public support,
purchase terms, purchase privacy, app privacy and app terms sections. Prices come
from `foco/checkout-config.mjs`. The JSON contains `documents` and `instantAnswers`;
this full artifact is server-only, explicitly included in the Vercel function,
never copied into `dist/`. Only the small, approved `instantAnswers` subset is
embedded as escaped JSON in the homepage and support page. It contains public
answers and same-site sources, not credentials, operational data or visitor data.

## Fast-answer pipeline

1. The browser matches reviewed whole-question aliases, ignoring accents, case and
   punctuation. Approved answers render immediately with their sources: no HTTP,
   model, storage access or loading state. The API shares this matcher for direct
   callers. Prices are generated from the checkout configuration at build time.
2. Other questions reach the API's existing validation and personal-data guard.
   In-memory BM25-style search with a small Spanish synonym vocabulary selects
   at most four complete public sections, bounded to 8,000 serialized characters.
   The index is reused inside a warm function. No embeddings, vector database,
   reranker call or question logging is added.
3. If search finds no source, return a fixed human-support handoff. Otherwise
   reserve the existing quota and make one grounded model call with only those
   sections. Validate citations against that subset, not the full knowledge base.

Instant matching is deliberately exact, not fuzzy: qualifiers, negations,
personal details and compound questions must go through the guarded API. Search
labels and synonyms affect retrieval only; they never authorize factual answers.
Retrieval can miss unfamiliar phrasing, so retain the unsupported-answer handoff
and expand the regression cases before adding vocabulary. This is lightweight
retrieval-augmented generation, without a separate vector service.

Add or revise approved aliases in `scripts/faq.mjs`, using reviewed page copy as
the answer source. Rebuild both pages and the server bundle together. Changes to
search vocabulary belong in `server/foco/faq-retrieval.mjs`. No browser answer
history or runtime cache of user questions is stored.

To update knowledge: update the appropriate public page or configuration, run tests
and build, review the generated sources, then deploy. Commercial policy changes
still require a new version and immutable archive through the existing policy flow.
Do not add private operational documents, customer records, credentials or raw logs.

## Model and activation

- Model: `inception/mercury-2.5` through Vercel AI Gateway, routing only to Inception.
- Model availability/pricing checked on 2026-09-21 at
  https://vercel.com/ai-gateway/models/mercury-2.5 ($0.04/M input, $0.15/M output
  under the current 80% discount; promotional prices can change).
- Verified against the team's existing free credits. GPT-5.6 Luna, GPT-5.4 Mini
  and Gemini 3.5 Flash Lite were rejected with a free-tier model restriction,
  not a depleted balance. The team retains its existing $5/month Gateway budget.
  No credit purchase or automatic top-up was configured for this feature.
- Authenticate with Vercel OIDC. Never place a Gateway/provider key in browser code.
- Production requires `FOCO_FAQ_ENABLED=true`, a separate random
  `FOCO_FAQ_RATE_SECRET`, and the existing private Blob configuration.
- Disable model-backed answers by setting `FOCO_FAQ_ENABLED=false` and redeploying.
  Static FAQs, browser-local approved answers and support links remain available.
  The legacy Netlify build also has instant answers but no new AI function.

## Boundaries and limits

At most one model call per uncached, source-matched question; no tools, no conversation memory, no autonomous
actions, no order/account access. Questions are limited to 500 characters / 2 KB JSON;
the reviewed knowledge payload cannot exceed 50,000 characters. The model has no
reasoning, no SDK retries, a 500-output-token cap and a 20-second timeout.

All production instances share an atomic counter at `prod/faq/budget`, separate
from purchase records. The hard ceiling is 100 accepted model requests per UTC day
(resets at 7 p.m. Colombia), with 3/minute and 10/day per network address. Failed or
cancelled model requests still count. Instant approved answers and no-match
handoffs do not use this allowance. Known personal data/actions receive a fixed
support handoff without a provider call. Missing configuration/storage fails closed.
The visitor check is an abuse deterrent, not authentication; visitors sharing a
network also share that allowance. Deployments without Vercel's trusted forwarded
IP headers need a trusted-proxy equivalent, not arbitrary client-supplied headers.

The single counter object stores daily HMAC identifiers and counts, not raw IPs or
question text. Its map is replaced on the first request of the next UTC day; it is
not a background deletion job. SDK telemetry is disabled, model errors are not
logged. These settings do not claim universal zero
retention: Vercel/Inception service security/retention policies still apply. Review
Gateway content-logging configuration before changing those guarantees.

The model returns JSON (this endpoint does not support strict JSON Schema through
the SDK); server validation enforces types, response length and allowlisted source
IDs. URLs come from the server. Responses are
rendered as plain text. Unsupported questions hand off to a person. This reduces
hallucination risk but does not guarantee factual accuracy; source and disclaimer
links remain visible. A small PII guard catches common emails, long numbers and
URLs, but cannot detect every personal detail.

## Verification

`npm test` runs offline tests, including race conditions at 99/100 requests,
per-visitor limits, midnight reset, source coverage, privacy guards, invalid model
output, wrong origins, oversized bodies and provider/storage failures. No paid
calls occur in the ordinary suite. Retrieval tests cover 21 Spanish questions,
including mixed topics, policy exceptions and retention. Client tests verify
that approved answers render synchronously without calling `fetch`, while
qualified questions still use the API and notices remain hidden until interaction.

`vercel env run -e development -- node scripts/evaluate-faq.mjs --paid` explicitly
runs twelve synthetic cases through the handler, including instant answers and
retrieval-backed model answers (no real visitor data). It reports response mode,
model time and token counts; deliberate free-tier pacing is excluded from latency.
This evaluation is
separate from production counters and requires Gateway credit access. Review the
actual answers as well as the lightweight assertions. Verify one real browser
request on the deployed site and confirm that the source link leads to the quoted
section. Never create orders or send receipts to test the FAQ.
