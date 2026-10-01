import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCheckoutPage } from '../scripts/checkout-page.mjs';
import { structuredData, renderSEO } from '../scripts/seo.mjs';
import { FOCO_CHECKOUT, getOffer, formatCOP } from '../foco/checkout-config.mjs';

const source = await readFile(new URL('./fixtures/legacy-cart.html', import.meta.url), 'utf8');
const product = config => structuredData('comprar/', config)['@graph'].find(node => node['@type'] === 'Product');

test('historical cart fixture shows all offers and exact default totals without enabling payment', () => {
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

test('retired checkout never publishes product offers in search metadata', () => {
    for (const productionEnabled of [false, true]) {
        assert.equal(product({ ...FOCO_CHECKOUT, productionEnabled }), undefined);
    }
});

test('payment results and unfinished blog retain their noindex metadata', async () => {
    for (const path of ['pago/', 'blog/']) {
        const html = await readFile(new URL(`../foco/${path}index.html`, import.meta.url), 'utf8');
        assert.equal(renderSEO(html, path), html);
        assert.match(html, /name="robots" content="noindex/);
    }
});
