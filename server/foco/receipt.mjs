// Server-only preparation/sending. Never import this module in a browser.
import { formatCOP, FOCO_WHATSAPP_URL } from '../../foco/checkout-config.mjs';

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const boundedID = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(value);
const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);

// Only call after the payment has been independently fetched from Wompi on the
// server and matched to the persisted order/consent. A redirect is never evidence.
export function orderReceipt({ order, transaction }) {
    if (!order || !transaction || !boundedID(order.id) || !boundedID(transaction.id) ||
        order.transactionId !== transaction.id || transaction.status !== 'APPROVED' ||
        transaction.currency !== 'COP' || !validEmail(transaction.customer_email)) {
        throw new Error('Receipt requires a verified approved order.');
    }
    const offer = order.offer;
    if (!offer || ![1,2,3].includes(offer.quantity) || order.quantity !== offer.quantity ||
        !['subtotal','discount','shipping','total','amountInCents'].every(key => Number.isSafeInteger(offer[key]) && offer[key] >= 0) ||
        offer.total !== offer.subtotal - offer.discount + offer.shipping || offer.total <= 0 || offer.amountInCents !== offer.total * 100) {
        throw new Error('Receipt requires the original stored offer.');
    }
    if (transaction.amount_in_cents !== offer.amountInCents || order.amountInCents !== offer.amountInCents) {
        throw new Error('Receipt amount does not match the offer.');
    }
    if (!order.consent?.acceptedAt || !Number.isFinite(Date.parse(order.consent.acceptedAt)) ||
        !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(order.consent.termsVersion || '') ||
        !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(order.consent.privacyVersion || '')) {
        throw new Error('Receipt requires recorded consent.');
    }
    const seller = order.seller;
    if (!seller || !['name','nit','noticeAddress'].every(key => typeof seller[key] === 'string' && seller[key].trim())) {
        throw new Error('Receipt requires the original seller.');
    }
    const reference = `FOCO-${order.id}`;
    const product = `${offer.quantity} ${offer.quantity === 1 ? 'tarjeta Foco' : 'tarjetas Foco'} NFC`;
    const rows = [ ['Producto', product], ['Subtotal', `${formatCOP(offer.subtotal)} COP`],
        ...(offer.discount ? [['Descuento del pack', `−${formatCOP(offer.discount)} COP`]] : []),
        ['Envío', offer.shipping ? `${formatCOP(offer.shipping)} COP` : 'Gratis'],
        ['Total pagado', `${formatCOP(offer.total)} COP`] ];
    const name = typeof transaction.customer_data?.full_name === 'string' ? transaction.customer_data.full_name.trim().slice(0, 120) : '';
    const greeting = name ? `Hola, ${name}.` : 'Hola.';
    const subject = `Tu compra Foco está confirmada · ${reference}`;
    const termsURL = `https://nilho.co/foco/compra/versiones/${order.consent.termsVersion}/terms.html`;
    const privacyURL = `https://nilho.co/foco/compra/versiones/${order.consent.privacyVersion}/privacy.html`;
    const text = `${greeting}\n\nTu compra Foco está confirmada.\nRecibimos tu pago. Estamos preparando tus tarjetas para que vuelvas a lo tuyo.\n\nPedido: ${reference}\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\nPago aprobado en Wompi: ${transaction.id}\n\nSolo para iPhone. No compatible con Android.\n\nDespacho: 1–2 días hábiles desde la aprobación del pago.\nEntrega: 3–10 días hábiles, incluyendo el despacho.\nDespués del despacho te enviaremos la guía por WhatsApp.\nGarantía: 12 meses desde la entrega.\n\nCondiciones aceptadas: ${order.consent.termsVersion}\nPrivacidad de compras: ${order.consent.privacyVersion}\nAceptación registrada: ${order.consent.acceptedAt}\n${termsURL}\n${privacyURL}\n\nVendedor: ${seller.name} · NIT ${seller.nit}\n${seller.noticeAddress}\n\n¿Necesitas ayuda? Responde a este correo o escríbenos por WhatsApp: ${FOCO_WHATSAPP_URL}\nteam@nilho.co\n\nComprobante de compra. Este correo no es una factura electrónica.\n`;
    const rowHTML = rows.map(([label, value], index) => {
        const isTotal = index === rows.length - 1;
        return `<tr><td style="padding:12px 0;${isTotal ? 'border-top:1px solid #deded8;font-weight:700;' : 'color:#62625c;'}">${escapeHTML(label)}</td><td align="right" style="padding:12px 0;${isTotal ? 'border-top:1px solid #deded8;font-weight:700;font-size:20px;' : ''}">${escapeHTML(value)}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(subject)}</title></head>
<body style="margin:0;background:#f7f7f4;color:#101110;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Recibimos tu pago. Tu próximo momento de foco ya viene.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:16px 0 32px;font-size:16px;letter-spacing:5px;font-weight:700;">FOCO</td></tr>
<tr><td style="font-size:12px;letter-spacing:1px;color:#55564f;">TU COMPRA ESTÁ CONFIRMADA</td></tr>
<tr><td><h1 style="font-size:38px;line-height:1.1;letter-spacing:-1.4px;margin:20px 0 24px;">Vuelve a<br>lo tuyo.</h1><p style="font-size:15px;line-height:1.7;margin:0 0 24px;">${escapeHTML(greeting)} Recibimos tu pago. Estamos preparando tus tarjetas para tu próximo momento de foco.</p></td></tr>
<tr><td style="background:#ffffff;border:1px solid #deded8;border-radius:20px;padding:24px;">
<p style="font-size:11px;color:#55564f;overflow-wrap:anywhere;margin:0 0 18px;">${escapeHTML(reference)}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;">${rowHTML}</table>
<p style="font-size:12px;line-height:1.6;margin:16px 0 0;"><strong>Solo para iPhone.</strong><br>No compatible con Android.</p></td></tr>
<tr><td style="padding:28px 0 12px;"><h2 style="font-size:20px;margin:0 0 12px;letter-spacing:-.5px;">¿Qué sigue?</h2><p style="font-size:14px;line-height:1.8;margin:0;">Despachamos en <strong>1–2 días hábiles</strong> desde la aprobación del pago. La entrega toma <strong>3–10 días hábiles</strong>, incluyendo el despacho.<br>Te enviaremos la guía por WhatsApp después de despachar.<br>Tu tarjeta tiene 12 meses de garantía desde la entrega.</p></td></tr>
<tr><td style="padding:20px 0 28px;font-size:14px;line-height:1.8;">¿Necesitas ayuda? Responde a este correo o <a href="${escapeHTML(FOCO_WHATSAPP_URL)}" style="color:#245e59;">escríbenos por WhatsApp</a>.</td></tr>
<tr><td style="border-top:1px solid #deded8;padding-top:20px;font-size:11px;line-height:1.8;color:#55564f;overflow-wrap:anywhere;">Pago aprobado en Wompi: ${escapeHTML(transaction.id)}<br>Condiciones aceptadas: ${escapeHTML(order.consent.termsVersion)} · Privacidad: ${escapeHTML(order.consent.privacyVersion)}<br>Aceptación registrada: ${escapeHTML(order.consent.acceptedAt)}<br><a href="${escapeHTML(termsURL)}" style="color:#55564f;">Compra, envíos y garantía</a> · <a href="${escapeHTML(privacyURL)}" style="color:#55564f;">Privacidad de compras</a><br><br>Vendido por ${escapeHTML(seller.name)} · NIT ${escapeHTML(seller.nit)}<br>${escapeHTML(seller.noticeAddress)}<br><a href="mailto:team@nilho.co" style="color:#55564f;">team@nilho.co</a><br><br>Comprobante de compra. Este correo no es una factura electrónica.</td></tr>
</table></td></tr></table></body></html>`;
    if (order.environment === 'test') {
        const notice = 'PRUEBA DE INTEGRACIÓN · NO ES UNA COMPRA. No hubo dinero real ni se enviarán tarjetas. Los datos siguientes simulan un pedido.';
        return { to: transaction.customer_email, subject: `[PRUEBA] ${subject}`,
            text: `${notice}\n\n${text}`,
            html: html.replace('<table role="presentation"', `<p style="margin:0;padding:18px;background:#101110;color:#fff;text-align:center;font:13px Arial;line-height:1.7">${notice}</p><table role="presentation"`) };
    }
    return { to: transaction.customer_email, subject, html, text };
}

// Resend's key covers only 24 hours. The caller must persist send state per
// transaction, acquire a durable claim, and never automatically retry an
// ambiguous request after that window. No public arbitrary-email endpoint.
export async function sendOrderReceipt({ order, transaction, apiKey, from = 'Foco <team@nilho.co>', fetchImpl = fetch }) {
    return sendPreparedReceipt({ receipt: orderReceipt({ order, transaction }), transactionId: transaction.id, apiKey, from, fetchImpl });
}

// The durable receipt record freezes this payload before the first send so retries
// use identical content, even if a deployment changes the template or prices.
export async function sendPreparedReceipt({ receipt, transactionId, apiKey, from = 'Foco <team@nilho.co>', fetchImpl = fetch }) {
    if (!boundedID(transactionId) || !validEmail(receipt?.to) || typeof receipt.html !== 'string' ||
        typeof receipt.text !== 'string' || typeof receipt.subject !== 'string') throw new Error('Invalid stored receipt.');
    if (typeof apiKey !== 'string' || !apiKey.startsWith('re_')) throw new Error('Resend is not configured.');
    if (!/^Foco <[A-Za-z0-9._+-]+@nilho\.co>$/.test(from)) throw new Error('Unapproved sender.');
    const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
            'Idempotency-Key': `foco-receipt-v1/${transactionId}` },
        body: JSON.stringify({ from, to: [receipt.to], reply_to: 'team@nilho.co', subject: receipt.subject,
            html: receipt.html, text: receipt.text }),
    });
    // Never surface provider error bodies: they can contain addresses or request data.
    if (!response.ok) throw new Error(`Resend request failed (${response.status}).`);
    const result = await response.json();
    if (typeof result.id !== 'string' || !/^[A-Za-z0-9-]{1,120}$/.test(result.id)) throw new Error('Resend did not confirm acceptance.');
    return { emailId: result.id }; // Accepted by Resend, not proof of inbox delivery.
}
