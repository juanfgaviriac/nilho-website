# Fast first paint and Google metadata

The homepage title is "Foco — Vuelve a lo tuyo". Use the slogan and describe the
product as "tarjeta Foco" in public copy, metadata, FAQ answers, and receipts;
do not introduce NFC or chip names as marketing language. Accepted historical
policy snapshots remain unchanged.

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
  bundles and content-addressed media receive immutable one-year caching; API
  responses remain `no-store`. Images, videos and fonts are fingerprinted by their
  bytes, including CSS font URLs, HTML preloads, srcsets and share metadata.
  Original media URLs remain available for historical pages; never apply
  immutable caching to mutable filenames or current HTML.
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
- The 10-second Screen Time comparison retains its original **60 fps**. H.264
  CRF 22 / slow / YUV420P / faststart versions are 426,231 bytes at 1080×720
  (mobile) and 1,130,822 bytes at 1920×1280 (desktop), versus 7,225,101 bytes for
  v1: 94.1% and 84.3% less transfer respectively. Full-video SSIM is 0.997313
  for desktop, and 0.996429 for mobile against a Lanczos-resized reference.
  The mobile source is chosen at the first play on viewports up to 720px;
  resizing never restarts playback or downloads a second encode. Native lazy
  video loading additionally defers the poster in supporting browsers. The
  viewport observer remains the fallback for media downloads.
- Feature image `sizes` match the real card widths, gutters and borders. On a
  412px / 1.75 DPR phone the image needs about 598 pixels, so the existing 600px
  image can be selected instead of downloading the 1200px version. No image
  pixels, typography or layout were changed.
- Carousel geometry is measured by ResizeObserver after layout and cached until
  the track resizes. Scroll frames read only scroll position before updating
  controls; they no longer measure every card after writing DOM styles. Keyboard
  navigation, reduced-motion behavior and the existing animation remain intact.

## Performance regression checks

`tests/foco-performance.test.mjs` verifies content hashes, font preload reuse,
responsive sizes, lazy source selection, explicit playback with reduced motion
or data saving, offscreen pause, immutable/no-store boundaries and faststart.
Budgets: homepage JS below 6 KB gzip, CSS below 8 KB gzip, comparison below
500 KB mobile / 1.3 MB desktop. These guard payloads, not real-user timing.

Baseline public mobile audit on 2026-09-22 (Lighthouse 13.5.0, emulated Moto G
Power, slow 4G): 100 performance/accessibility/best practices/SEO; FCP 0.9s,
LCP 1.4s, TBT 0ms, CLS 0.008. No CrUX field data was available.
https://pagespeed.web.dev/analysis/https-getfoco-co/go10tbzv0e?form_factor=mobile

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
