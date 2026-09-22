import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCheckoutPage } from '../scripts/checkout-page.mjs';
import { structuredData, renderSEO } from '../scripts/seo.mjs';
import { FOCO_CHECKOUT, getOffer, formatCOP } from '../foco/checkout-config.mjs';

const source = await readFile(new URL('../foco/comprar/index.html', import.meta.url), 'utf8');
const product = config => structuredData('comprar/', config)['@graph'].find(node => node['@type'] === 'Product');

test('first HTML shows all offers and exact default totals without enabling payment', () => {
    for (const defaultQuantity of [1, 2, 3]) {
        const html = renderCheckoutPage(source, { ...FOCO_CHECKOUT, defaultQuantity });
        const offer = getOffer(defaultQuantity);
        assert.equal([...html.matchAll(/class="offer-option"/g)].length, 3);
        assert.match(html, new RegExp(`data-quantity="${defaultQuantity}" aria-checked="true"`));
        assert.ok(html.includes(`id="summary-total">${formatCOP(offer.total)}</strong>`));
        assert.ok(html.includes(`id="summary-subtotal">${formatCOP(offer.subtotal)}</dd>`));
        assert.ok(html.includes(`id="summary-discount-row"${offer.discount ? '' : ' hidden'}`));
        assert.match(html, /id="wompi-pay"[^>]*disabled/);
        assert.doesNotMatch(html, /id="purchase-consent"[^>]*checked/);
        for (const q of [1, 2, 3]) assert.ok(html.includes(formatCOP(getOffer(q).total)));
    }
});

test('search price and visible offers follow configuration changes, not duplicate constants', () => {
    const config = { ...FOCO_CHECKOUT, defaultQuantity: 1, offers: { ...FOCO_CHECKOUT.offers,
        1: { ...FOCO_CHECKOUT.offers[1], subtotal: 120000, shipping: 12000 } } };
    const html = renderCheckoutPage(source, config);
    const offer = product(config).offers;
    assert.equal(offer.price, 120000);
    assert.equal(offer.shippingDetails.shippingRate.value, 12000);
    assert.ok(html.includes(formatCOP(offer.price)));
    assert.ok(html.includes(`id="summary-total">${formatCOP(132000)}</strong>`));
    assert.equal(offer.priceCurrency, 'COP');
});

test('closed checkout is never advertised as available in search or first HTML', () => {
    for (const config of [
        { ...FOCO_CHECKOUT, productionEnabled: false },
        { ...FOCO_CHECKOUT, commerce: { ...FOCO_CHECKOUT.commerce, availableCards: 5 } },
    ]) {
        assert.equal(product(config).offers.availability, 'https://schema.org/OutOfStock');
        assert.match(renderCheckoutPage(source, config), /id="checkout-availability">Próximamente disponible/);
    }
});

test('product markup contains factual returns and no invented reviews or ratings', () => {
    const item = product(FOCO_CHECKOUT);
    assert.equal(item.offers.hasMerchantReturnPolicy.merchantReturnDays, 30);
    assert.equal(item.offers.hasMerchantReturnPolicy.returnFees, 'https://schema.org/ReturnFeesCustomerResponsibility');
    assert.equal(item.offers.seller.name, FOCO_CHECKOUT.commerce.seller.name);
    assert.equal(item.aggregateRating, undefined);
    assert.equal(item.review, undefined);
});

test('payment results and unfinished blog retain their noindex metadata', async () => {
    for (const path of ['pago/', 'blog/']) {
        const html = await readFile(new URL(`../foco/${path}index.html`, import.meta.url), 'utf8');
        assert.equal(renderSEO(html, path), html);
        assert.match(html, /name="robots" content="noindex/);
    }
});
