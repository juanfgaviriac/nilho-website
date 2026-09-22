import { formatCOP } from '../../foco/checkout-config.mjs';
import { assertApprovedOrder } from './receipt.mjs';
import { FOCO_MERCHANT_EMAIL, sendPreparedEmail } from './email.mjs';

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const WOMPI_DASHBOARD = 'https://comercios.wompi.co/home';

export function merchantNotification({ order, transaction }) {
    assertApprovedOrder({ order, transaction });
    if (!['prod', 'test'].includes(order.environment)) throw new Error('Invalid order environment.');
    const reference = `FOCO-${order.id}`;
    const quantity = `${order.quantity} ${order.quantity === 1 ? 'tarjeta' : 'tarjetas'}`;
    const total = `${formatCOP(order.offer.total)} COP`;
    const test = order.environment === 'test';
    const subject = `${test ? '[PRUEBA] ' : ''}Nueva compra Foco · ${quantity} · ${total}`;
    const notice = test ? 'PRUEBA DE INTEGRACIÓN · NO ES UNA COMPRA. No hubo dinero real. No despachar tarjetas.' : '';
    const rows = [['Pedido', reference], ['Cantidad', quantity],
        ...(order.offer.promoDiscount ? [['Código', order.offer.promoCode], ['Descuento por código', `−${formatCOP(order.offer.promoDiscount)} COP`]] : []),
        ['Total pagado', total],
        ['Transacción Wompi', transaction.id], ['Estado verificado', 'APPROVED']];
    const next = 'Abre Wompi y busca el ID de la transacción para consultar los datos de envío y preparar el pedido. Antes de despachar, comprueba que no haya un despacho previo, reembolso o reversión. Descuenta las tarjetas del inventario y envía la guía por WhatsApp después del despacho.';
    const text = `${notice ? `${notice}\n\n` : ''}Nueva compra Foco\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${next}\n\nAbrir Wompi: ${WOMPI_DASHBOARD}\n\nAviso interno. El comprobante del comprador se envía por separado.\n`;
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(subject)}</title></head>
<body style="margin:0;background:#f7f7f4;color:#101110;font-family:Arial,Helvetica,sans-serif;">
${test ? `<p style="padding:18px;margin:0;background:#101110;color:#fff;text-align:center;font-size:13px;line-height:1.6;">${notice}</p>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:8px 0 24px;letter-spacing:5px;font-size:16px;font-weight:700;">FOCO</td></tr>
<tr><td><p style="font-size:12px;color:#245e59;letter-spacing:1px;">PAGO VERIFICADO</p><h1 style="margin:16px 0 24px;font-size:34px;line-height:1.15;letter-spacing:-1px;">Nueva compra Foco.</h1></td></tr>
<tr><td style="padding:24px;background:#fff;border:1px solid #deded8;border-radius:20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;table-layout:fixed;">${rows.map(([label, value]) => `<tr><td style="padding:10px 8px 10px 0;color:#62625c;width:40%;vertical-align:top;">${label}</td><td style="padding:10px 0;font-weight:700;overflow-wrap:anywhere;word-break:break-word;">${escapeHTML(value)}</td></tr>`).join('')}</table></td></tr>
<tr><td style="padding:24px 0;font-size:14px;line-height:1.8;">${next}</td></tr>
<tr><td><a href="${WOMPI_DASHBOARD}" style="display:inline-block;padding:16px 24px;border-radius:28px;background:#101110;color:#fff;text-decoration:none;font-size:14px;font-weight:700;">Abrir Wompi</a></td></tr>
<tr><td style="padding:28px 0 0;color:#62625c;font-size:12px;line-height:1.7;">Aviso interno. El comprobante del comprador se envía por separado.</td></tr>
</table></td></tr></table></body></html>`;
    // No customer address, email, phone or payment instrument is copied here.
    return { to: FOCO_MERCHANT_EMAIL, subject, html, text };
}

export async function sendPreparedMerchantNotification({ message, ...options }) {
    return sendPreparedEmail({ ...options, message, kind: 'merchant' });
}
