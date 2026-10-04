import { CommerceError, environment, verifyWompiEvent } from './commerce.mjs';
import { BILLING_BACKEND } from './subscription.mjs';

const referencePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const unavailable = () => new CommerceError(503, 'subscription_event_retry_required');

// Wompi has one merchant webhook URL. Keep historical payment-link receipts on
// that URL, and route recurring payments only after authenticated readback.
// This ingress gate is independent of checkout so closing sales preserves renewals.
export async function routeSubscriptionEvent(event, env, fetcher = fetch) {
    if (env.FOCO_SUBSCRIPTION_WEBHOOK_ENABLED !== 'true') return null;
    const { mode, baseURL } = environment(env);
    if (!verifyWompiEvent(event, env.WOMPI_EVENTS_SECRET, mode))
        throw new CommerceError(401, 'invalid_event');
    const id = event.data.transaction.id;
    if (typeof id !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(id))
        throw new CommerceError(400, 'invalid_transaction');
    try {
        const read = await fetcher(`${baseURL}/transactions/${encodeURIComponent(id)}`, {
            headers: { authorization: `Bearer ${env.WOMPI_PRIVATE_KEY}`, accept: 'application/json' },
            redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
        });
        if (!read.ok) throw unavailable();
        const { data: tx } = await read.json();
        if (!tx || tx.id !== id || tx.amount_in_cents !== event.data.transaction.amount_in_cents)
            throw unavailable();
        // Never use the unsigned webhook reference to choose the recipient.
        if (tx.payment_link_id || !referencePattern.test(tx.reference ?? '')) return null;
        const endpoint = mode === 'prod' ? 'subscription-wompi' : 'subscription-wompi-sandbox';
        const result = await fetcher(`${BILLING_BACKEND}/api/internal/${endpoint}`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event),
            redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25000),
        });
        if (!result.ok || (await result.json()).received !== true) throw unavailable();
        return { received: true };
    } catch {
        // A failed forward must be retried by Wompi, never acknowledged as settled.
        throw unavailable();
    }
}
