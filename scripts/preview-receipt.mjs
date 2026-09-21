import { mkdir, writeFile } from 'node:fs/promises';
import { orderReceipt } from '../server/foco/receipt.mjs';
import { FOCO_CHECKOUT, getOffer } from '../foco/checkout-config.mjs';
const offer = getOffer(3);
const receipt = orderReceipt({ order: { id: 'VISTA-PREVIA', quantity: 3, transactionId: 'PRUEBA-SIN-PAGO',
    offer, seller: FOCO_CHECKOUT.commerce.seller, amountInCents: offer.amountInCents,
    consent: { acceptedAt: '2026-09-21T22:00:00.000Z', termsVersion: FOCO_CHECKOUT.commerce.termsVersion, privacyVersion: FOCO_CHECKOUT.commerce.privacyVersion } },
    transaction: { id: 'PRUEBA-SIN-PAGO', status: 'APPROVED', currency: 'COP', amount_in_cents: offer.amountInCents,
        customer_email: 'preview@example.com', customer_data: { full_name: 'Comprador de prueba' } } });
await mkdir(new URL('../.artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../.artifacts/receipt-preview.html', import.meta.url), receipt.html.replace('<body ', '<body data-preview="synthetic" ').replace('<table role="presentation" width="100%"', '<p style="text-align:center;font:12px Arial;color:#555">VISTA PREVIA · SIN PAGO NI ENVÍO REAL</p><table role="presentation" width="100%"'));
console.log('Created .artifacts/receipt-preview.html (synthetic only; no email sent).');
