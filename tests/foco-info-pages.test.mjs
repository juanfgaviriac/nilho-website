import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { renderCommercePage } from '../scripts/policies.mjs';
import { renderSharedFooter } from '../scripts/shared-footer.mjs';
import { FOCO_CHECKOUT, getOffer, formatCOP } from '../foco/checkout-config.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const pages = ['compra/', 'compra/privacidad/', 'soporte/', 'privacidad/', 'terminos/'];
const footer = html => html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)[0];

test('current pages reuse the homepage footer without changing their content', () => {
    const homepage = read('foco/index.html');
    for (const page of [...pages, 'comprar/', 'pago/']) {
        const source = read(`foco/${page}index.html`);
        const rendered = renderSharedFooter(source, homepage);
        assert.equal(footer(rendered), footer(homepage));
        assert.equal(rendered.replace(footer(rendered), ''), source.replace(footer(source), ''));
    }
    for (const file of ['commerce.css', 'checkout.css', 'cart.css', 'info-pages.css']) {
        assert.doesNotMatch(read(`foco/${file}`), /\.site-footer|\.info-footer|\.footer-links/);
    }
});

test('all information pages share the accessible storefront navigation and working section indexes', () => {
    for (const page of pages) {
        const html = read(`foco/${page}index.html`);
        assert.match(html, /class="info-page"/);
        assert.match(html, /\/foco\/info-pages.css/);
        assert.match(html, new RegExp(`rel="canonical" href="https://getfoco.co/${page}"`));
        assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1);
        assert.match(html, /aria-current="page"/);
        assert.match(html, /<a class="skip-link" href="#contenido"/);
        const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
        assert.equal(new Set(ids).size, ids.length, `Duplicate IDs in ${page}`);
        for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `${page} missing #${id}`);
        for (const route of pages) assert.ok(html.includes(`href="/foco/${route}"`));
        assert.match(html, /https:\/\/sedeelectronica.sic.gov.co\/temas\/proteccion-al-consumidor/);
        assert.doesNotMatch(html, /nilho\.co|info-mark|name="robots" content="noindex/);
    }
});

test('commercial HTML contains current seller and prices without JavaScript and rendering is idempotent', () => {
    for (const page of pages.slice(0, 2)) {
        const html = renderCommercePage(read(`foco/${page}index.html`));
        assert.doesNotMatch(html, /Pendiente de completar|Compras aún no habilitadas/);
        assert.ok(html.includes(FOCO_CHECKOUT.commerce.seller.name));
        assert.ok(html.includes(FOCO_CHECKOUT.commerce.seller.nit));
        assert.ok(html.includes(FOCO_CHECKOUT.commerce.seller.noticeAddress));
        assert.equal(renderCommercePage(html), html);
        if (page === 'compra/') {
            for (const quantity of [1, 2, 3]) assert.ok(html.includes(`${formatCOP(getOffer(quantity).total)} COP`));
            assert.match(html, /data-offer-list><div>/);
        }
    }
    assert.throws(() => renderCommercePage('<p data-field="unknown">placeholder</p>'), /Missing public commerce field/);
});

test('production build publishes complete canonical pages and preserves earlier accepted policies byte-for-byte', () => {
    const historical = {
        '2026-09-21.1/privacy': '85ba5d5bd50e4d8d290d8b900eebc5102b79626ec96a382e43e604346156d763',
        '2026-09-21.1/terms': 'c6a9ad6c9314d1745957461691368c40dff0ce783dd1a6ab57e1fa248ab3b767',
        '2026-09-21.2/privacy': '70d282b21f8a4e8f16a6d3989762e4beaa9b0170aedf09bdc13f2f33d4c758c1',
        '2026-09-21.2/terms': 'eb5e1e6cff43b59e2be7bc9d738f81da2d1e7c60d449226dbdee15256a910256',
    };
    execFileSync(process.execPath, ['scripts/build-vercel.mjs'], { cwd: root });
    const homepageFooter = footer(read('dist/index.html'));
    for (const page of [...pages, 'comprar/', 'pago/']) {
        assert.equal(footer(read(`dist/${page}index.html`)), homepageFooter);
        assert.equal(footer(read(`dist/foco/${page}index.html`)), footer(read('dist/foco/index.html')));
    }
    for (const page of pages) {
        const html = read(`dist/${page}index.html`);
        assert.doesNotMatch(html, /Pendiente de completar|Compras aún no habilitadas/);
        for (const [, href] of html.matchAll(/href="(\/[^"#?]*)[^\"]*"/g)) {
            const path = href.endsWith('/') ? `${href}index.html` : href;
            assert.ok(existsSync(new URL(`dist${path}`, root)), `${page}: missing ${href}`);
        }
    }
    for (const [path, hash] of Object.entries(historical)) {
        for (const prefix of ['foco/', 'dist/foco/', 'dist/']) {
            assert.equal(createHash('sha256').update(read(`${prefix}compra/versiones/${path}.html`)).digest('hex'), hash);
        }
    }
    for (const [kind, version] of [['terms', FOCO_CHECKOUT.commerce.termsVersion], ['privacy', FOCO_CHECKOUT.commerce.privacyVersion]]) {
        const archive = read(`dist/compra/versiones/${version}/${kind}.html`);
        assert.doesNotMatch(archive, /<script|Pendiente de completar/);
        assert.ok(archive.includes(`/foco/compra/versiones/${version}/${kind}.html`));
    }
});
