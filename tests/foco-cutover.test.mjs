import test from 'node:test';
import assert from 'node:assert/strict';
import checkout from '../netlify/functions/foco-checkout.mjs';
import webhook from '../netlify/functions/foco-wompi.mjs';

test('legacy production checkout cannot create a second order ledger', async () => {
    const response = await checkout(new Request('https://nilho.co/api/foco/checkout', { method: 'POST' }), { deploy: { context: 'production' } });
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { error: 'checkout_moved', checkoutURL: 'https://getfoco.co/#comprar' });
});

test('legacy webhook preserves POST payload and rejection status from the new verifier', async t => {
    const event = { event: 'transaction.updated', environment: 'prod', signature: { checksum: 'fixture' } };
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, 'https://getfoco.co/api/foco/wompi');
        assert.equal(options.method, 'POST');
        assert.equal(options.redirect, 'error');
        assert.deepEqual(JSON.parse(options.body), event);
        return new Response('{"error":"invalid_event"}', { status: 401 });
    });
    const response = await webhook(new Request('https://nilho.co/api/foco/wompi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
    }), { deploy: { context: 'production' } });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'invalid_event' });
});
