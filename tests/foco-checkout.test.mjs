import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOCO_CHECKOUT, FOCO_WHATSAPP_URL, getOffer, formatCOP, checkoutAvailable, checkoutCanStart, safeCheckoutURL, transactionId } from '../foco/checkout-config.mjs';
import { FOCO_COMMERCE, commerceReady, stockAvailable } from '../foco/commerce-config.mjs';

for (const [quantity, subtotal, discount, shipping, total, cents, sku] of [
    [1, 100000, 0, 10000, 110000, 11000000, 'FOCO-01'],
    [2, 200000, 0, 0, 200000, 20000000, 'FOCO-02'],
    [3, 300000, 50000, 0, 250000, 25000000, 'FOCO-03'],
]) {
    test(`${quantity} cards: exact breakdown and fixed Wompi amount`, () => {
        const offer = getOffer(quantity);
        assert.deepEqual([offer.subtotal, offer.discount, offer.shipping, offer.total, offer.amountInCents, offer.sku], [subtotal, discount, shipping, total, cents, sku]);

    });
}

test('approved launch defaults to two and requires explicit consent for every offer', () => {
    assert.equal(FOCO_CHECKOUT.defaultQuantity, 2);
    assert.equal(FOCO_CHECKOUT.productionEnabled, true);
    for (const quantity of [1, 2, 3]) {
        assert.equal(checkoutCanStart(quantity, true), true);
        assert.equal(checkoutCanStart(quantity, false), false);
        assert.equal(checkoutCanStart(quantity, true, { ...FOCO_CHECKOUT, productionEnabled: false }), false);
    }
});

function readyCommerce() {
    return { ...FOCO_COMMERCE,
        seller: { name: 'Vendedor de prueba', nit: 'NIT de prueba', noticeAddress: 'Dirección de prueba', returnsAddress: 'Dirección de prueba' },
        product: { material: 'PVC', dimensions: '86 × 54 mm' },
        dispatchCity: 'Ciudad de prueba', carrier: 'Transportadora de prueba', availableCards: 30,
        billingConfirmed: true, consentEvidenceVerified: true };
}

function configuredCheckout() {
    return { ...FOCO_CHECKOUT, productionEnabled: true, commerce: readyCommerce() };
}

test('each quantity starts a server checkout only after consent and launch gates', () => {
    const config = configuredCheckout();
    for (const quantity of [2,1,3,2,3,1]) {
        assert.equal(checkoutCanStart(quantity, true, config), true);
        assert.equal(checkoutCanStart(quantity, false, config), false);
        assert.equal(checkoutCanStart(quantity, true, {...config, productionEnabled:false}), false);
    }
});

for (const url of ['https://checkout.wompi.co/l/test ', 'javascript:alert(1)', 'http://checkout.wompi.co/l/fixture-1', 'https://checkout.wompi.co.evil.test/l/test', 'https://checkout.wompi.co@evil.test/l/test', 'https://user:password@checkout.wompi.co/l/test', 'https://checkout.wompi.co/p/', 'https://checkout.wompi.co/l/test?amount=1', 'https://checkout.wompi.co/l/test#override']) {
    test(`reject unsupported payment target: ${url}`, () => {
        assert.equal(safeCheckoutURL(url), null);
    });
}

test('unsupported quantities cannot select a product or payment', () => {
    for (const quantity of [0, 4, -1, 1.5, '', null, '__proto__', 'constructor', '2abc']) {
        assert.throws(() => getOffer(quantity), RangeError);
        assert.throws(() => checkoutCanStart(quantity, true), RangeError);
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
    assert.match(html, /href="\/foco\/compra\/"/);
    assert.match(html, /id="purchase-consent"/);
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


test('turning on the publication flag alone cannot bypass missing merchant facts', () => {
    assert.equal(commerceReady(), true);
    assert.equal(checkoutAvailable({ ...FOCO_CHECKOUT, productionEnabled: true,
        commerce: { ...FOCO_COMMERCE, consentEvidenceVerified: false } }), false);
    const ready = configuredCheckout();
    for (const key of ['noticeAddress', 'nit', 'returnsAddress', 'name']) {
        const commerce = { ...ready.commerce, seller: { ...ready.commerce.seller, [key]: ' ' } };
        assert.equal(checkoutAvailable({ ...ready, commerce }), false);
    }
    for (const key of ['billingConfirmed', 'consentEvidenceVerified']) {
        assert.equal(checkoutAvailable({ ...ready, commerce: { ...ready.commerce, [key]: false } }), false);
    }
});

test('manual stock gate pauses at five cards and never treats unknown stock as available', () => {
    const config = configuredCheckout();
    for (const availableCards of [null, undefined, '30', NaN, Infinity, -1, 0, 3, 5, 5.5]) {
        const commerce = { ...config.commerce, availableCards };
        assert.equal(stockAvailable(commerce), false);
        for (const quantity of [1, 2, 3]) assert.equal(checkoutCanStart(quantity, true, { ...config, commerce }), false);
    }
    assert.equal(stockAvailable({ ...config.commerce, availableCards: 6 }), true);
});

test('checkout requires explicit current consent for the selected offer', () => {
    const config = configuredCheckout();
    for (const quantity of [1, 2, 3]) {
        for (const accepted of [false, undefined, 'true', 1]) assert.equal(checkoutCanStart(quantity, accepted, config), false);
        assert.equal(checkoutCanStart(quantity, true, config), true);
        assert.equal(checkoutCanStart(quantity, true, { ...config, productionEnabled: false }), false);
    }
});

test('consent is not preselected or persisted as fake evidence and resets on return', () => {
    const html = readFileSync(new URL('../foco/index.html', import.meta.url), 'utf8');
    const script = readFileSync(new URL('../foco/checkout.js', import.meta.url), 'utf8');
    assert.doesNotMatch(html.match(/<input[^>]+id="purchase-consent"[^>]*>/)[0], /\schecked(?:[\s=>])/);
    assert.doesNotMatch(script, /localStorage|sessionStorage|document\.cookie/);
    assert.match(script, /pageshow.*consent.checked = false/);
    assert.match(script, /checkoutCanStart\(quantity, consent.checked\)/);
});

test('commercial pages separate seller, app and purchase privacy and retain neutral payment status', () => {
    const purchase = readFileSync(new URL('../foco/compra/index.html', import.meta.url), 'utf8');
    const privacy = readFileSync(new URL('../foco/compra/privacidad/index.html', import.meta.url), 'utf8');
    assert.match(purchase, /12 meses/);
    assert.match(purchase, /cinco días hábiles/);
    assert.match(purchase, /15 días calendario/);
    assert.match(purchase, /data-offer-list/);
    assert.match(purchase, /https:\/\/www.sic.gov.co/);
    assert.match(privacy, /No cruzamos los pedidos con la analítica/);
    for (const name of ['soporte', 'privacidad', 'terminos']) {
        const html = readFileSync(new URL(`../foco/${name}/index.html`, import.meta.url), 'utf8');
        assert.doesNotMatch(html, /diez desbloqueos/);
        assert.match(html, /tres desbloqueos/);
    }
});
