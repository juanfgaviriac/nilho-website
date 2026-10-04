import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { routeSubscriptionEvent } from '../server/foco/subscription-webhook.mjs';

const env = { CONTEXT: 'production', WOMPI_ENVIRONMENT: 'prod', WOMPI_PUBLIC_KEY: 'pub_prod_fixture',
    WOMPI_PRIVATE_KEY: 'prv_prod_fixture', WOMPI_EVENTS_SECRET: 'prod_events_fixture', FOCO_SUBSCRIPTION_WEBHOOK_ENABLED: 'true' };
const reference = '11111111-1111-4111-8111-111111111111';
function event(status = 'APPROVED') {
    const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
    const transaction = { id: 'tx-1', status, amount_in_cents: 1490000, reference: 'untrusted' };
    const timestamp = 1791100000;
    const checksum = createHash('sha256').update(`tx-1${status}1490000${timestamp}${env.WOMPI_EVENTS_SECRET}`).digest('hex');
    return { event: 'transaction.updated', environment: 'prod', timestamp, data: { transaction }, signature: { properties, checksum } };
}
function provider(tx, result = Response.json({ received: true })) {
    const calls = [];
    return { calls, fetch: async (url, options) => {
        calls.push({ url, options });
        return calls.length === 1 ? Response.json({ data: { id: 'tx-1', amount_in_cents: 1490000, ...tx } }) : result;
    } };
}
test('closed ingress and bad signatures cannot forward events', async () => {
    const p = provider({ reference });
    assert.equal(await routeSubscriptionEvent(event(), { ...env, FOCO_SUBSCRIPTION_WEBHOOK_ENABLED: 'false' }, p.fetch), null);
    const bad = event(); bad.data.transaction.amount_in_cents++;
    await assert.rejects(routeSubscriptionEvent(bad, env, p.fetch), { code: 'invalid_event' });
    assert.equal(p.calls.length, 0);
});
test('historical links stay with the receipt handler even with a spoofed UUID in the event', async () => {
    const p = provider({ payment_link_id: 'old-order-link', reference });
    const e = event(); e.data.transaction.reference = reference;
    assert.equal(await routeSubscriptionEvent(e, env, p.fetch), null);
    assert.equal(p.calls.length, 1);
});
for (const status of ['APPROVED', 'DECLINED', 'VOIDED', 'PENDING']) test(`signed ${status} subscription event reaches the verifier while checkout is closed`, async () => {
    const p = provider({ reference });
    assert.deepEqual(await routeSubscriptionEvent(event(status), { ...env, FOCO_WEB_SUBSCRIPTION_LIVE_APPROVED: 'false' }, p.fetch), { received: true });
    assert.equal(p.calls[1].url, 'https://foco-backend.vercel.app/api/internal/subscription-wompi');
    assert.deepEqual(JSON.parse(p.calls[1].options.body), event(status));
    assert.equal(p.calls[1].options.headers.authorization, undefined);
});
test('failed delivery and mismatched provider readback remain retryable', async () => {
    for (const p of [provider({ reference }, Response.json({ error: 'offline' }, { status: 503 })),
        provider({ reference, id: 'other' }), provider({ reference, amount_in_cents: 1 })]) {
        await assert.rejects(routeSubscriptionEvent(event(), env, p.fetch), { code: 'subscription_event_retry_required' });
    }
});
