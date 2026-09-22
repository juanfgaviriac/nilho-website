# Foco migration verification — 2026-09-21

## Active production

- https://getfoco.co is hosted by Vercel project `getfoco`, account `juanfgaviriacs-projects`, connected to `juanfgaviriac/nilho-website` main. www redirects to the apex.
- Static Foco pages/assets, order creation, Wompi callback processing, private order/consent/receipt storage and Resend sender configuration run from Vercel. Keys remain server-side Sensitive variables, scoped to Production.
- Wompi's production callback was saved and independently read back as `https://getfoco.co/api/foco/wompi`; newly created links return to `https://getfoco.co/pago/`.
- Orders use private Blob store `foco-orders-production`, with `prod/` prefixes. The former Netlify production ledger was empty at cutover. No customer orders required transfer.
- Sender and reply-to: `Foco <team@getfoco.co>`. Namecheap forwards incoming `team@getfoco.co` to `team@nilho.co`; DNS/MX forwarding records are retained. A manual Gmail/Mail send-as identity is separate and has not been configured.

## Completed checks

- 61 automated tests passed: exact offer amounts, recorded consent, provider readback, signature/amount/environment rejection, concurrency, retries, receipt idempotency, preview isolation, old endpoint forwarding and private storage conditions.
- Live private Blob atomic create and concurrent CAS checks passed. A 22,411-byte synthetic receipt completed pending → single winning sending claim → sent. `Accept-Encoding:identity` and `useCache:false` preserve the ETag contract.
- Live production checkout created one **unpaid** two-card link for 20,000,000 centavos. Wompi readback confirmed single use, shipping collection, redirect and expiry. The repeated request reused the order/link. Link `xgdyAT` was deactivated and its verification order closed. No charge occurred.
- All public canonical pages, legal archives, robots and sitemap returned 200 over HTTPS. www and old nilho.co/foco redirects preserve the transaction query ID. The result page remains neutral even with `status=APPROVED` in its URL.
- Unsigned events return 401 on both old and new webhook URLs; foreign-Origin checkout returns 403; legacy production checkout returns 410. Server modules, environment files, package metadata and internal docs return 404.
- Checkout was rendered at 320, 390 and 1280 px without horizontal overflow. Totals were 110,000 / 200,000 / 250,000 COP, and the 50,000 discount appeared only for three cards. Consent begins unchecked and gates payment.
- The remaining FAQ mailto and operational receipt template were updated to team@getfoco.co; operating instructions now identify Vercel as the active system.

## Actual email delivery from the new sender

Two explicitly labeled synthetic receipts were sent on 2026-09-21 at 21:06 America/Bogota using the actual production Resend key and `server/foco/receipt.mjs` in a temporary Vercel build with no custom-domain promotion. No public mail endpoint, paid order or fake production transaction was created. That temporary deployment was removed after verification.

| Purpose | Recipient | Resend message ID | Provider result |
| --- | --- | --- | --- |
| Direct receipt delivery | team@nilho.co | 01a0c6dd-6a08-762e-b736-d45615ffeab2 | Delivered |
| New-domain receiving route | team@getfoco.co | 01a0c6dd-6a62-742f-a2e3-41f40043982c | Delivered |

Resend UI confirmed `Foco <team@getfoco.co>` as sender and `team@getfoco.co` as reply-to, the test-only banner, expected receipt totals and current legal links. Delivered means the receiving server accepted the message; Gmail inbox placement and the final forwarding hop were not independently inspected because its browser controls repeatedly timed out. The saved forwarder itself was read back in Namecheap.

## Intentionally retained and limits

Nilho's corporate website stays on Netlify. Its old Foco pages redirect, its checkout cannot create orders, and its webhook forwards to the Vercel verifier for compatibility. Historical sandbox records and deployment evidence remain archived there; they are not the production ledger. A fresh Vercel sandbox needs isolated test credentials/storage and a fixed authorized recipient.

The earlier end-to-end Wompi sandbox purchase and duplicate signed callbacks passed before migration; this migration verified the new runtime components and real email delivery separately. No real-money production payment, settlement, refund or physical dispatch has been performed. Fulfil only after independently confirming Wompi APPROVED. Inventory remains manual and the carrier remains deferred by the owner. Do not call email a tax invoice.
