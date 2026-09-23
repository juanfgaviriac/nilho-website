import { MEASUREMENT_ID, CONSENT_VERSION, ecommerceItem } from '../../foco/analytics-model.mjs';

// Deliberately ignore unknown/invalid analytics input; payment must still work.
export function analyticsContext(input, timestamp) {
    if (!input || typeof input.clientId !== 'string' || typeof input.sessionId !== 'string' ||
        !Number.isSafeInteger(Number(input.sessionId)) || input.consentVersion !== CONSENT_VERSION ||
        !/^\d{1,20}\.\d{1,20}$/.test(input.clientId) || !/^\d{1,20}$/.test(input.sessionId)) return undefined;
    return { clientId: input.clientId, sessionId: input.sessionId, consentVersion: input.consentVersion, acceptedAt: timestamp };
}

export function purchasePayload(order, paid) {
    return { client_id: order.analytics.clientId,
        timestamp_micros: Date.parse(paid.approvedAt) * 1000,
        consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
        events: [{ name: 'purchase', params: { ...ecommerceItem({ ...order.offer, sku: order.sku }),
            transaction_id: paid.transactionId, shipping: order.offer.shipping,
            session_id: Number(order.analytics.sessionId), engagement_time_msec: 1,
            page_location: 'https://getfoco.co/comprar/' } }] };
}

// A durable per-order lease + GA transaction_id deduplication makes webhook and
// scheduled retries safe. A 2xx is recorded as submitted, not proof of GA ingestion.
export async function submitPurchase({ order, paid, store, env, fetchImpl = fetch, now = () => new Date() }) {
    if (env.CONTEXT !== 'production' || order.environment !== 'prod' || !order.analytics ||
        !env.GA4_API_SECRET || env.GA4_PURCHASES_ENABLED !== 'true') return 'disabled';
    if (!analyticsContext(order.analytics, order.analytics.acceptedAt)) return 'invalid';
    const age = now().getTime() - Date.parse(paid.approvedAt);
    if (!Number.isFinite(age) || age < 0 || age > 71 * 3600000) return 'expired';
    const key = `analytics/${order.id}`;
    await store.setJSON(key, { state: 'pending', createdAt: paid.approvedAt }, { onlyIfNew: true });
    const current = await store.getWithMetadata(key, { type: 'json' });
    if (!current || current.data.state === 'submitted') return current?.data.state ?? 'pending';
    if (Date.parse(current.data.leaseUntil || '') > now().getTime()) return 'busy';
    const lease = await store.setJSON(key, { ...current.data, leaseUntil: new Date(now().getTime() + 60000).toISOString() }, { onlyIfMatch: current.etag });
    if (!lease.modified) return 'busy';
    try {
        const url = new URL('https://www.google-analytics.com/mp/collect');
        url.searchParams.set('measurement_id', MEASUREMENT_ID);
        url.searchParams.set('api_secret', env.GA4_API_SECRET);
        const response = await fetchImpl(url.href, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(4000),
            headers: { 'content-type': 'application/json' }, body: JSON.stringify(purchasePayload(order, paid)) });
        if (!response.ok) throw new Error('analytics_unavailable');
        await store.setJSON(key, { state: 'submitted', submittedAt: now().toISOString(), createdAt: paid.approvedAt }, { onlyIfMatch: lease.etag });
        return 'submitted';
    } catch {
        await store.setJSON(key, { ...current.data, leaseUntil: null }, { onlyIfMatch: lease.etag });
        return 'pending';
    }
}
