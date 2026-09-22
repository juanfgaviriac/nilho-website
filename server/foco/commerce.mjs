import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { FOCO_CHECKOUT, getCheckoutOffer } from '../../foco/checkout-config.mjs';
import { stockAvailable } from '../../foco/commerce-config.mjs';
import { orderReceipt } from './receipt.mjs';
import { merchantNotification } from './merchant-notification.mjs';
import { sendPreparedEmail } from './email.mjs';

export class CommerceError extends Error {
    constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new CommerceError(status, code); };
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const safeID = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(value);
const digest = value => createHash('sha256').update(value).digest('hex');

export function environment(env) {
    const mode = env.WOMPI_ENVIRONMENT;
    if (!['prod', 'test'].includes(mode)) fail(503, 'commerce_not_configured');
    if (mode === 'prod' && env.CONTEXT !== 'production') fail(503, 'production_context_required');
    if (!env.WOMPI_PRIVATE_KEY?.startsWith(`prv_${mode}_`) || !env.WOMPI_PUBLIC_KEY?.startsWith(`pub_${mode}_`) ||
        !env.WOMPI_EVENTS_SECRET?.startsWith(`${mode}_events_`)) fail(503, 'commerce_not_configured');
    return { mode, baseURL: mode === 'prod' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1' };
}

export function verifyWompiEvent(event, secret, mode) {
    if (!event || event.event !== 'transaction.updated' || event.environment !== mode ||
        !Number.isSafeInteger(event.timestamp) || event.timestamp <= 0) return false;
    const props = event.signature?.properties;
    if (!Array.isArray(props) || props.length > 20 || new Set(props).size !== props.length ||
        !['transaction.id', 'transaction.status', 'transaction.amount_in_cents'].every(prop => props.includes(prop))) return false;
    const values = [];
    for (const path of props) {
        if (typeof path !== 'string' || !/^transaction\.[a-z_]+$/.test(path)) return false;
        const value = event.data?.transaction?.[path.slice(12)];
        if (!['string', 'number'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) return false;
        values.push(String(value));
    }
    if (!/^[a-f0-9]{64}$/i.test(event.signature?.checksum || '')) return false;
    const expected = digest(values.join('') + event.timestamp + secret);
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(event.signature.checksum, 'hex'));
}

export function makeCommerce({ store, env, policies, fetchImpl = fetch, now = () => new Date(), id = randomUUID, config = FOCO_CHECKOUT }) {
    async function wompi(path, body) {
        const { baseURL } = environment(env);
        const response = await fetchImpl(`${baseURL}${path}`, {
            method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
            headers: { Authorization: `Bearer ${env.WOMPI_PRIVATE_KEY}`, 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) fail(502, 'payment_provider_unavailable');
        const result = await response.json();
        if (!result?.data || typeof result.data !== 'object') fail(502, 'invalid_payment_response');
        return result.data;
    }
    async function createCheckout(input) {
        const { mode } = environment(env);
        if (env.FOCO_CHECKOUT_ENABLED !== 'true') fail(503, 'checkout_unavailable');
        if (env.FOCO_EMAIL_ENABLED !== 'true' || !env.RESEND_API_KEY?.startsWith('re_')) fail(503, 'email_not_configured');
        if (mode === 'test' && !env.FOCO_TEST_EMAIL_TO) fail(503, 'test_recipient_not_configured');
        if (!stockAvailable(config.commerce)) fail(409, 'stock_unavailable');
        if (!input || !uuid(input.attemptId) || ![1,2,3].includes(input.quantity) || input.accepted !== true ||
            input.termsVersion !== config.commerce.termsVersion || input.privacyVersion !== config.commerce.privacyVersion) {
            fail(400, 'invalid_checkout');
        }
        if (!policies?.terms || !policies?.privacy) fail(503, 'policies_unavailable');
        let offer;
        try { offer = getCheckoutOffer(input.quantity, input.promoCode, config); }
        catch { fail(400, 'invalid_promo_code'); }
        const previous = await store.get(`attempts/${input.attemptId}`, { type: 'json' });
        if (previous) {
            const order = await store.get(`orders/${previous.orderId}`, { type: 'json' });
            if (!order || order.quantity !== input.quantity || order.consent.termsVersion !== input.termsVersion ||
                order.consent.privacyVersion !== input.privacyVersion ||
                (order.offer.promoCode || '') !== offer.promoCode) fail(409, 'checkout_conflict');
            if (order.checkoutURL && Date.parse(order.expiresAt) > now().getTime()) return {
                checkoutURL: order.checkoutURL, orderId: order.id,
                amountInCents: order.amountInCents, promoCode: order.offer.promoCode || '',
            };
            fail(409, 'checkout_needs_review');
        }
        const orderId = id();
        const timestamp = now().toISOString();
        const order = { id: orderId, environment: mode, quantity: offer.quantity, sku: offer.sku,
            amountInCents: offer.amountInCents, currency: 'COP', createdAt: timestamp,
            expiresAt: new Date(now().getTime() + 60 * 60 * 1000).toISOString(), state: 'creating',
            offer: { quantity: offer.quantity, subtotal: offer.subtotal, discount: offer.discount,
                promoCode: offer.promoCode, promoDiscount: offer.promoDiscount,
                shipping: offer.shipping, total: offer.total, amountInCents: offer.amountInCents },
            seller: config.commerce.seller,
            consent: { acceptedAt: timestamp, termsVersion: input.termsVersion, privacyVersion: input.privacyVersion,
                termsSHA256: digest(policies.terms), privacySHA256: digest(policies.privacy) } };
        // Archive the exact rendered policies, including public seller/price data.
        for (const kind of ['terms','privacy']) await store.set(`policies/${order.consent[`${kind}SHA256`]}`, policies[kind], { onlyIfNew: true });
        if (!(await store.setJSON(`orders/${orderId}`, order, { onlyIfNew: true })).modified) fail(409, 'order_conflict');
        const claim = await store.setJSON(`attempts/${input.attemptId}`, { orderId }, { onlyIfNew: true });
        if (!claim.modified) fail(409, 'checkout_in_progress');
        // No blind retry: an ambiguous POST might already have created a link.
        const link = await wompi('/payment_links', {
            name: `Foco - ${offer.quantity} ${offer.quantity === 1 ? 'tarjeta' : 'tarjetas'}`,
            description: `Solo para iPhone. ${offer.sku}. Pedido ${orderId}. Condiciones: https://getfoco.co/compra/versiones/${input.termsVersion}/terms.html`,
            single_use: true, collect_shipping: true, currency: 'COP', amount_in_cents: offer.amountInCents,
            sku: orderId, redirect_url: config.redirectUrl, expires_at: order.expiresAt,
        });
        if (!safeID(link.id) || link.amount_in_cents !== offer.amountInCents || link.currency !== 'COP' ||
            link.sku !== orderId || link.single_use !== true || link.collect_shipping !== true || link.active !== true ||
            link.redirect_url !== config.redirectUrl || link.merchant_public_key !== env.WOMPI_PUBLIC_KEY ||
            !Number.isFinite(Date.parse(link.expires_at)) || Math.abs(Date.parse(link.expires_at) - Date.parse(order.expiresAt)) > 1000 ||
            (mode === 'prod' && link.id.startsWith('test_')) || (mode === 'test' && !link.id.startsWith('test_'))) {
            fail(502, 'payment_link_mismatch');
        }
        order.paymentLinkId = link.id;
        order.checkoutURL = `https://checkout.wompi.co/l/${link.id}`;
        order.state = 'awaiting_payment';
        // Persist mapping before returning a link to a customer.
        const mapping = await store.setJSON(`links/${link.id}`, { orderId }, { onlyIfNew: true });
        if (!mapping.modified) fail(409, 'payment_link_conflict');
        await store.setJSON(`orders/${orderId}`, order);
        return { checkoutURL: order.checkoutURL, orderId, amountInCents: order.amountInCents, promoCode: offer.promoCode };
    }

    async function deliverRecordedEmail({ key, kind, orderId, transactionId, prepare }) {
        const label = kind === 'receipt' ? 'receipt' : 'alert';
        let current = await store.getWithMetadata(key, { type: 'json' });
        if (!current) {
            // Freeze content before sending. Existing sends keep their original
            // recipient/content across deploys and changes to provider data.
            await store.setJSON(key, { state: 'pending', createdAt: now().toISOString(),
                orderId, transactionId, payload: prepare() }, { onlyIfNew: true });
            current = await store.getWithMetadata(key, { type: 'json' });
        }
        if (!current) fail(503, `${label}_unavailable`);
        if (current.data.state === 'sent') return { reviewRequired: false };
        if (current.data.state === 'manual_review') return { reviewRequired: true };
        if (env.FOCO_EMAIL_ENABLED !== 'true') fail(503, 'email_disabled');
        const age = now().getTime() - Date.parse(current.data.createdAt);
        // Both emails have separate durable claims and provider keys. Never
        // automatically resend an ambiguous request beyond the dedupe window.
        if (!Number.isFinite(age) || age >= 23 * 60 * 60 * 1000) {
            const saved = await store.setJSON(key, { ...current.data, state: 'manual_review' }, { onlyIfMatch: current.etag });
            if (!saved.modified) fail(503, `${label}_retry_required`);
            return { reviewRequired: true };
        }
        if (Date.parse(current.data.leaseUntil || '') > now().getTime()) fail(503, `${label}_in_progress`);
        const lease = await store.setJSON(key, { ...current.data, state: 'sending', leaseUntil: new Date(now().getTime()+120000).toISOString() }, { onlyIfMatch: current.etag });
        if (!lease.modified) fail(503, `${label}_in_progress`);
        let sent;
        try {
            sent = await sendPreparedEmail({ message: current.data.payload, transactionId: current.data.transactionId,
                kind, apiKey: env.RESEND_API_KEY, fetchImpl });
        } catch {
            await store.setJSON(key, { ...current.data, state: 'pending', leaseUntil: null }, { onlyIfMatch: lease.etag });
            fail(503, `${label}_retry_required`);
        }
        const saved = await store.setJSON(key, { ...current.data, state: 'sent', emailId: sent.emailId,
            sentAt: now().toISOString(), leaseUntil: null }, { onlyIfMatch: lease.etag });
        if (!saved.modified) fail(503, `${label}_retry_required`);
        return { reviewRequired: false };
    }

    async function handleEvent(event) {
        const { mode } = environment(env);
        if (!verifyWompiEvent(event, env.WOMPI_EVENTS_SECRET, mode)) fail(401, 'invalid_event');
        const eventTx = event.data.transaction;
        if (!safeID(eventTx.id)) fail(400, 'invalid_transaction');
        if (eventTx.status !== 'APPROVED') return { received: true };
        // The checksum does not necessarily sign email, currency or payment_link_id.
        // Fetch those from Wompi's authenticated backend endpoint, never the event.
        const tx = await wompi(`/transactions/${eventTx.id}`);
        if (tx.id !== eventTx.id || tx.status !== 'APPROVED') return { received: true };
        if (!safeID(tx.payment_link_id)) return { received: true, ignored: 'unmanaged_link' };
        const mapping = await store.get(`links/${tx.payment_link_id}`, { type: 'json' });
        if (!mapping) return { received: true, ignored: 'unmanaged_link' };
        const order = await store.get(`orders/${mapping.orderId}`, { type: 'json' });
        if (!order || order.environment !== mode || order.paymentLinkId !== tx.payment_link_id ||
            tx.currency !== order.currency || tx.amount_in_cents !== order.amountInCents ||
            !order.consent?.acceptedAt) fail(409, 'order_payment_mismatch');
        const receiptKey = `receipts/${tx.id}`;
        // Public sandbox checkout must not become an arbitrary-email sender.
        // A retry still uses the frozen original recipient, not mutable provider data.
        if (mode === 'test') {
            const existingReceipt = await store.get(receiptKey, { type: 'json' });
            const recipient = existingReceipt?.payload?.to || tx.customer_email;
            if (!env.FOCO_TEST_EMAIL_TO || recipient?.toLowerCase() !== env.FOCO_TEST_EMAIL_TO.toLowerCase()) {
                return { received: true, ignored: 'sandbox_recipient' };
            }
        }
        const paid = await store.setJSON(`paid/${order.id}`, { transactionId: tx.id, approvedAt: now().toISOString() }, { onlyIfNew: true });
        if (!paid.modified && (await store.get(`paid/${order.id}`, { type: 'json' })).transactionId !== tx.id) fail(409, 'order_already_paid');
        const verified = { order: { ...order, transactionId: tx.id }, transaction: tx };
        // Attempt both independently: buyer delivery must not suppress the sales
        // alert, and a failed alert must never cause a second buyer receipt.
        const results = await Promise.allSettled([
            deliverRecordedEmail({ key: receiptKey, kind: 'receipt', orderId: order.id, transactionId: tx.id,
                prepare: () => orderReceipt(verified) }),
            deliverRecordedEmail({ key: `alerts/${tx.id}`, kind: 'merchant', orderId: order.id, transactionId: tx.id,
                prepare: () => merchantNotification(verified) }),
        ]);
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason; // Non-2xx lets Wompi retry either unsent email.
        return { received: true, ...(results.some(result => result.value.reviewRequired) ? { reviewRequired: true } : {}) };
    }
    return { createCheckout, handleEvent };
}
