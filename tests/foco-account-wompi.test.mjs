import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSandboxWompi, sandboxWidgetOptions } from '../foco/account-wompi.mjs';

const now = Date.parse('2026-09-29T12:00:00Z');
function handoff(changes = {}) {
    const url = new URL('https://checkout.wompi.co/p/');
    for (const [key, value] of Object.entries({ 'public-key': 'pub_test_fixture', currency: 'COP',
        'amount-in-cents': '1000000', reference: 'sandbox-reference', 'signature:integrity': 'a'.repeat(64),
        'expiration-time': '2026-09-29T12:30:00Z', ...changes })) url.searchParams.set(key, value);
    return url.href;
}
test('widget keeps the signed sandbox amounts and excludes the loopback redirect that triggers Wompi 403', () => {
    const options = sandboxWidgetOptions(handoff({ 'redirect-url': 'http://127.0.0.1:4338/cuenta/',
        'customer-data:email': 'private@example.com', 'shipping-address:phone-number': '3001234567' }), now);
    assert.deepEqual(options, { publicKey: 'pub_test_fixture', currency: 'COP', amountInCents: 1000000,
        reference: 'sandbox-reference', signature: { integrity: 'a'.repeat(64) }, expirationTime: '2026-09-29T12:30:00Z' });
});
test('widget rejects live keys, hostile origins, modified shapes and expired handoffs before loading', () => {
    for (const changes of [{ 'public-key': 'pub_prod_fixture' }, { currency: 'USD' }, { 'amount-in-cents': '1e6' },
        { 'amount-in-cents': '-1' }, { 'amount-in-cents': '999999999999999999' }, { reference: '<script>' },
        { 'signature:integrity': '' }, { 'expiration-time': 'invalid' }, { 'expiration-time': new Date(now).toISOString() }]) {
        assert.throws(() => sandboxWidgetOptions(handoff(changes), now), /invalid_sandbox_checkout/);
    }
    assert.throws(() => sandboxWidgetOptions(handoff().replace('checkout.wompi.co', 'example.com'), now));
});
function environment() {
    const scripts = [], instances = [];
    const view = { location: { origin: 'http://127.0.0.1:4338' } };
    const doc = { createElement: () => ({ remove() { this.removed = true; } }), head: { appendChild: script => scripts.push(script) } };
    const Widget = class { constructor(options) { this.options = options; instances.push(this); } open(callback) { this.callback = callback; } };
    return { scripts, instances, view, doc, Widget };
}
test('provider loads on demand once, and callback forwards only a transaction ID once for server verification', async () => {
    const f = environment();
    const prepare = createSandboxWompi({ ...f, now: () => now });
    assert.equal(f.scripts.length, 0);
    const first = prepare(handoff()), second = prepare(handoff());
    assert.equal(f.scripts.length, 1);
    assert.equal(f.scripts[0].src, 'https://checkout.wompi.co/widget.js');
    assert.equal(f.scripts[0].referrerPolicy, 'no-referrer');
    f.view.WidgetCheckout = f.Widget; f.scripts[0].onload();
    const [open] = await Promise.all([first, second]);
    const received = []; open(id => received.push(id));
    const callback = f.instances[0].callback;
    callback(undefined); callback({ transaction: { id: '<bad>', status: 'APPROVED' } });
    assert.deepEqual(received, []);
    callback({ transaction: { id: 'test-123', status: 'APPROVED', card: 'not forwarded' } });
    callback({ transaction: { id: 'test-456', status: 'APPROVED' } });
    assert.deepEqual(received, ['test-123']);
    assert.equal(f.instances[0].options.redirectUrl, undefined);
});
test('provider load can retry after failure and cannot run on production or an expired quote', async () => {
    const f = environment(); let clock = now;
    const prepare = createSandboxWompi({ ...f, now: () => clock });
    const failed = prepare(handoff()); f.scripts[0].onerror();
    await assert.rejects(failed, /wompi_unavailable/);
    assert.equal(f.scripts[0].removed, true);
    const retry = prepare(handoff());
    assert.equal(f.scripts.length, 2);
    f.view.WidgetCheckout = f.Widget; f.scripts[1].onload();
    const open = await retry; clock += 31 * 60000;
    assert.throws(() => open(() => {}), /invalid_sandbox_checkout/);
    f.view.location.origin = 'https://getfoco.co';
    await assert.rejects(prepare(handoff()), /sandbox_only/);
    assert.equal(f.instances.length, 0);
});
test('account awaits the widget and verifies its ID server-side instead of trusting callback status', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    assert.match(source, /await openSandboxPayment\(\)/);
    assert.match(source, /paymentGeneration !== state\.generation/);
    assert.match(source, /state\.returnedPayment = transactionId;\s+void task\(verifyPayment\)/);
    assert.doesNotMatch(source, /location\.assign\(url\.href\)/);
});
test('tokenization uses the official saved-card operation and forwards only a sandbox CARD token once', async () => {
    const f = environment(); f.view.WidgetCheckout = f.Widget;
    const prepare = createSandboxWompi(f);
    const open = await prepare.tokenize('pub_test_fixture');
    const tokens = []; open(token => tokens.push(token));
    assert.deepEqual(f.instances[0].options, { publicKey: 'pub_test_fixture', widgetOperation: 'tokenize', paymentMethods: ['CARD'] });
    const cb = f.instances[0].callback;
    cb({ transaction: { id: 'not-an-authorization', status: 'APPROVED' } });
    cb({ payment_source: { type: 'NEQUI', token: 'tok_test_fixture' } });
    cb({ payment_source: { type: 'CARD', token: 'tok_prod_fixture' } });
    assert.deepEqual(tokens, []);
    cb({ payment_source: { type: 'CARD', token: 'tok_test_fixture', extra: 'never-forwarded' } });
    cb({ payment_source: { type: 'CARD', token: 'tok_test_second' } });
    assert.deepEqual(tokens, ['tok_test_fixture']);
    await assert.rejects(prepare.tokenize('pub_prod_fixture'));
    f.view.location.origin = 'https://getfoco.co';
    await assert.rejects(prepare.tokenize('pub_test_fixture'));
});
