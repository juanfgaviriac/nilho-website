# Fast first paint and Google metadata

Build the public site with `npm run build:vercel` (`npm run build` retains the
legacy `/foco/` layout). Serve `dist/` for UI checks; raw source HTML intentionally
contains build-time placeholders for prices and FAQ answers.

## Checkout

`scripts/checkout-page.mjs` renders every offer and the initial summary from
`foco/checkout-config.mjs`. The browser attaches listeners to those existing
buttons rather than inserting a new price grid. Offer buttons are disabled until
the checkout script is ready. Payment still requires explicit consent and a
server-calculated amount; no reusable payment links, cached orders, or new API
requests are used to make prices appear faster.

## Delivery

- `scripts/optimize-page.mjs` combines and minifies each page's styles and bundles
  each script with its dependencies. Content hashes invalidate the entire bundle
  when a dependency changes (including pricing configuration). Only hashed
  bundles receive immutable one-year caching; API responses remain `no-store`.
- The same Manrope and IBM Plex Mono fonts are served locally as WOFF2, with
  Latin/Latin Extended subsets and their OFL licenses. Only the primary Latin
  font is preloaded. Current pages receive this at build time; accepted policy
  archives retain their exact bytes.
- `foco-in-out-v3.mp4` is the same 540×960, 17.6-second demonstration, encoded
  with H.264 CRF 23, slow preset, YUV420P, and faststart. It is 398,866 bytes versus
  5,924,287 bytes for v2; measured full-video SSIM is 0.996175. The source and app
  assets are unchanged. The poster and fonts paint before autoplay begins;
  reduced motion, data saving, manual pause, and offscreen pausing are preserved.
- The unchanged video posters are delivered as WebP (12.8 KB for the hero and
  6.6 KB for the orbit). The App Store badge is sized for its rendered width and
  served at 384 pixels / 6.2 KB instead of the 3840-pixel / 48.2 KB source.

## Search

`scripts/seo.mjs` adds Organization/WebSite, Product/Offer and breadcrumb JSON-LD
to current indexable pages, plus complete share metadata. Product price, shipping
cost and availability derive from the checkout configuration, without promo
prices or invented ratings. Return terms match the published 30-day policy.
Shipping cost is included, but separate carrier transit times are not invented
from the overall 3–10-day delivery promise; shipping-enhancement eligibility can
be completed when that more granular information is confirmed.

The sitemap contains current canonical pages only. `/index.html` aliases redirect
to canonical paths. Payment results and the empty blog remain `noindex`. Accepted
policy archives stay accessible but receive `X-Robots-Tag: noindex, follow`.

Run `npm test`, both builds, desktop/mobile browser checks, and Lighthouse against
the public domain after release. Lab results are not real-user Core Web Vitals.
Search Console indexing, field metrics, and actual rich-result eligibility still
need to be checked in Google; schema and a Lighthouse SEO score cannot establish
rankings or guarantee that enhanced results will appear.

References:
- https://web.dev/articles/optimize-lcp
- https://web.dev/articles/lazy-loading-video
- https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
