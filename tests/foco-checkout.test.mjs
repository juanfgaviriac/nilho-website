import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOCO_CHECKOUT, FOCO_WHATSAPP_URL, getOffer, formatCOP, paymentURL, paymentLinkDefinition, transactionId } from '../foco/checkout-config.mjs';

for (const [quantity, subtotal, discount, shipping, total, cents, sku] of [
    [1, 100000, 0, 10000, 110000, 11000000, 'FOCO-01'],
    [2, 200000, 0, 0, 200000, 20000000, 'FOCO-02'],
    [3, 300000, 50000, 0, 250000, 25000000, 'FOCO-03'],
]) {
    test(`${quantity} cards: exact breakdown and fixed Wompi amount`, () => {
        const offer = getOffer(quantity);
        assert.deepEqual([offer.subtotal, offer.discount, offer.shipping, offer.total, offer.amountInCents, offer.sku], [subtotal, discount, shipping, total, cents, sku]);
        const payload = paymentLinkDefinition(quantity);
        assert.equal(payload.amount_in_cents, cents);
        assert.equal(payload.currency, 'COP');
        assert.equal(payload.collect_shipping, true);
        assert.equal(payload.single_use, false);
        assert.equal(payload.sku, sku);
        assert.equal(payload.redirect_url, 'https://nilho.co/foco/pago/');
        assert.equal('expires_at' in payload, false);
        assert.equal('taxes' in payload, false);
    });
}

test('default is two and all production payments are disabled', () => {
    assert.equal(FOCO_CHECKOUT.defaultQuantity, 2);
    assert.equal(FOCO_CHECKOUT.productionEnabled, false);
    for (const quantity of [1, 2, 3]) {
        assert.equal(FOCO_CHECKOUT.offers[quantity].wompiUrl, '');
        assert.equal(paymentURL(quantity), null);
        assert.equal(paymentURL(quantity, { ...FOCO_CHECKOUT, productionEnabled: true }), null);
    }
});

function configuredLinks() {
    return { ...FOCO_CHECKOUT, productionEnabled: true, offers: Object.fromEntries([1, 2, 3].map(quantity => [quantity, {
        ...FOCO_CHECKOUT.offers[quantity], wompiUrl: `https://checkout.wompi.co/l/fixture-${quantity}`,
    }])) };
}

test('each selected offer resolves only to its own link through repeated changes', () => {
    const config = configuredLinks();
    for (const quantity of [2, 1, 3, 2, 3, 1]) {
        assert.equal(paymentURL(quantity, config), config.offers[quantity].wompiUrl);
        assert.equal(paymentURL(quantity, { ...config, productionEnabled: false }), null);
    }
});

test('missing one offer link never falls back to another quantity', () => {
    const config = configuredLinks();
    config.offers[3].wompiUrl = '';
    assert.equal(paymentURL(3, config), null);
    assert.equal(paymentURL(2, config), config.offers[2].wompiUrl);
});

test('sandbox links cannot become production payment targets', () => {
    for (const quantity of [1, 2, 3]) {
        const config = configuredLinks();
        config.offers[quantity].wompiUrl = FOCO_CHECKOUT.offers[quantity].sandboxUrl;
        assert.equal(paymentURL(quantity, config), null);
        assert.equal(paymentURL(quantity), null);
    }
});

test('reusing one payment link across quantities fails closed', () => {
    const config = configuredLinks();
    config.offers[3].wompiUrl = config.offers[2].wompiUrl;
    assert.equal(paymentURL(2, config), null);
    assert.equal(paymentURL(3, config), null);
});

for (const url of ['https://checkout.wompi.co/l/test ', 'javascript:alert(1)', 'http://checkout.wompi.co/l/fixture-1', 'https://checkout.wompi.co.evil.test/l/test', 'https://checkout.wompi.co@evil.test/l/test', 'https://user:password@checkout.wompi.co/l/test', 'https://checkout.wompi.co/p/', 'https://checkout.wompi.co/l/test?amount=1', 'https://checkout.wompi.co/l/test#override']) {
    test(`reject unsupported payment target: ${url}`, () => {
        const config = configuredLinks();
        config.offers[1].wompiUrl = url;
        assert.equal(paymentURL(1, config), null);
    });
}

test('unsupported quantities cannot select a product or payment', () => {
    for (const quantity of [0, 4, -1, 1.5, '', null, '__proto__', 'constructor', '2abc']) {
        assert.throws(() => getOffer(quantity), RangeError);
        assert.throws(() => paymentURL(quantity), RangeError);
    }
});

test('COP formatting uses Colombian separators and no decimals', () => {
    assert.equal(formatCOP(110000).replace(/\s/g, ''), '$110.000');
    assert.equal(formatCOP(200000).replace(/\s/g, ''), '$200.000');
    assert.equal(formatCOP(50000).replace(/\s/g, ''), '$50.000');
});

test('result accepts only a bounded transaction id, never a claimed payment status', () => {
    assert.equal(transactionId('?id=01-1531231271-19365&status=APPROVED&amount=1'), '01-1531231271-19365');
    for (const value of ['', '?status=APPROVED', '?id=', '?id=a&id=b', '?id=%3Cscript%3E', '?id=' + 'a'.repeat(121), '?id=a%0Ab']) {
        assert.equal(transactionId(value), null);
    }
});

test('all three purchase CTAs lead to checkout; no address form or price literals in HTML', () => {
    const html = readFileSync(new URL('../foco/index.html', import.meta.url), 'utf8');
    assert.equal((html.match(/href="#comprar" data-checkout-open/g) || []).length, 3);
    assert.equal((html.match(/>Comprar Foco<\/a>/g) || []).length, 3);
    assert.doesNotMatch(html, /mailto:.*Quiero|<form|100000|200000|250000/);
    assert.match(html, /id="wompi-pay"[^>]*disabled/);
    assert.match(html, /TODO antes de vender/);
    assert.match(html, /role="radiogroup"/);
    assert.match(html, /role="status" aria-live="polite"/);
});

test('result has neutral copy and no automatic fulfilment or trust in URL status', () => {
    const html = readFileSync(new URL('../foco/pago/index.html', import.meta.url), 'utf8');
    const script = readFileSync(new URL('../foco/payment-result.js', import.meta.url), 'utf8');
    assert.match(html, /Estamos verificando tu pago/);
    assert.match(html, /no confirma que tu pago haya sido aprobado/);
    assert.match(html, /name="referrer" content="no-referrer"/);
    assert.match(script, /\.textContent = id/);
    assert.doesNotMatch(script, /fetch\(|innerHTML|localStorage|sessionStorage/);
    assert.equal(FOCO_WHATSAPP_URL, 'https://wa.me/573027738407');
});
