import test from 'node:test';
import assert from 'node:assert/strict';
import { merchantNotification, sendPreparedMerchantNotification } from '../server/foco/merchant-notification.mjs';
import { FOCO_CHECKOUT, getOffer } from '../foco/checkout-config.mjs';

const fixture = (quantity = 2) => ({
    order: { id: 'order-fixture', environment: 'prod', quantity, offer: getOffer(quantity),
        seller: FOCO_CHECKOUT.commerce.seller, transactionId: 'tx-fixture', amountInCents: getOffer(quantity).amountInCents,
        consent: { acceptedAt: '2026-09-21T22:00:00.000Z', termsVersion: '2026-09-21.4', privacyVersion: '2026-09-21.4' } },
    transaction: { id: 'tx-fixture', status: 'APPROVED', currency: 'COP', amount_in_cents: getOffer(quantity).amountInCents,
        customer_email: 'private@example.com', customer_data: { full_name: '<img src=x onerror=bad()>', phone_number: 'PRIVATE-PHONE' },
        shipping_address: { address_line_1: 'PRIVATE-ADDRESS' }, payment_method: { number: 'PRIVATE-CARD' } },
});

for (const [quantity, total] of [[1, '110.000'], [2, '200.000'], [3, '250.000']]) {
    test(`merchant message shows the verified total for ${quantity} cards without customer data`, () => {
        const message = merchantNotification(fixture(quantity));
        assert.equal(message.to, 'team@nilho.co');
        for (const body of [message.text, message.html]) {
            assert.ok(body.includes(total));
            assert.ok(body.includes('FOCO-order-fixture'));
            assert.ok(body.includes('tx-fixture'));
            assert.ok(body.includes('APPROVED'));
            assert.doesNotMatch(body, /PRIVATE-|private@example|onerror/);
        }
        assert.match(message.html, /lang="es"/);
        assert.match(message.html, /href="https:\/\/comercios.wompi.co\/home"/);
    });
}

test('merchant message rejects unapproved payments, invalid amounts, ids, consent and environment', () => {
    for (const change of [f => f.transaction.status = 'DECLINED', f => f.transaction.amount_in_cents = 1,
        f => f.order.offer.total = 1, f => f.order.id = '<script>', f => f.transaction.id = 'other',
        f => delete f.order.consent, f => f.order.environment = 'unknown']) {
        const value = structuredClone(fixture()); change(value);
        assert.throws(() => merchantNotification(value));
    }
});

test('merchant transport uses a separate deterministic key and cannot redirect to another recipient', async () => {
    const requests = [];
    const fetchImpl = async (url, init) => { requests.push({ url, init }); return Response.json({ id: 'alert-test-id' }); };
    const message = merchantNotification(fixture());
    await sendPreparedMerchantNotification({ message, transactionId: 'tx-fixture', apiKey: 're_fixture', fetchImpl });
    assert.equal(requests[0].init.headers['Idempotency-Key'], 'foco-merchant-v1/tx-fixture');
    assert.equal(JSON.parse(requests[0].init.body).from, 'Foco <team@getfoco.co>');
    await assert.rejects(sendPreparedMerchantNotification({ message: { ...message, to: 'other@example.com' },
        transactionId: 'tx-fixture', apiKey: 're_fixture', fetchImpl }), /Unapproved merchant recipient/);
    assert.equal(requests.length, 1);
});
