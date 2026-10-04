import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { blogArticles, blogSources } from '../scripts/blog-content.mjs';
import { blogPages, blogSitemapPaths, priceRows, renderArticle } from '../scripts/blog.mjs';
import { FOCO_CHECKOUT, formatCOP } from '../foco/checkout-config.mjs';
import { renderSEO } from '../scripts/seo.mjs';
import { renderSharedFooter } from '../scripts/shared-footer.mjs';

const drafts = blogArticles.map(({ publishedAt, modifiedAt, ...article }) => ({ ...article, status: 'draft' }));
const preview = blogPages({ articles: drafts, preview: true });
const schema = html => JSON.parse(html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/)[1])['@graph'];

test('eight approved Spanish articles are published with their real dates and indexable metadata', () => {
    const launchSlugs = ['estudiar-sin-mirar-el-celular', 'concentrarse-con-whatsapp-en-el-trabajo', 'pausas-sin-redes-sociales'];
    assert.equal(blogArticles.length, 8);
    for (const slug of launchSlugs) assert.ok(blogArticles.some(article => article.slug === slug));
    for (const key of ['slug', 'title', 'description']) assert.equal(new Set(blogArticles.map(article => article[key])).size, 8);
    const pages = blogPages();
    assert.equal(pages.size, 10);
    assert.equal(blogSitemapPaths().length, 10);
    assert.match(pages.get('blog/'), /id="lectura-destacada"><a href="\/blog\/estudiar-sin-mirar-el-celular\/"/);
    for (const article of blogArticles) {
        assert.equal(article.status, 'published');
        assert.equal(article.publishedAt, launchSlugs.includes(article.slug) ? '2026-10-04' : '2026-09-23');
        assert.ok(article.sections.length >= 4);
        assert.equal(new Set(article.sections.map(section => section.id)).size, article.sections.length);
        for (const id of article.sources) assert.ok(blogSources[id], `Missing source ${id}`);
        const html = pages.get(`blog/${article.slug}/`);
        assert.match(html, /name="robots" content="index, follow, max-image-preview:large"/);
        assert.doesNotMatch(html, /Vista previa editorial|Borrador preparado|noindex/);
        assert.equal(schema(html)[0].datePublished, article.publishedAt);
        assert.equal(schema(html)[0].dateModified, article.modifiedAt || article.publishedAt);
    }
});

test('future drafts remain absent from public routes and the sitemap', () => {
    assert.equal(blogPages({ articles: drafts }).size, 0);
    assert.deepEqual(blogSitemapPaths(drafts), []);
});

test('preview is clearly marked, noindexed and has no invented publication date', () => {
    assert.equal(preview.size, blogArticles.length + 2);
    for (const [path, html] of preview) {
        assert.match(html, /<html lang="es-CO">/);
        assert.match(html, /name="robots" content="noindex, follow"/);
        assert.match(html, /Vista previa editorial · Borradores no publicados/);
        assert.ok(html.includes(`rel="canonical" href="https://getfoco.co/${path}"`));
        assert.doesNotMatch(html, /"datePublished"|article:published_time/);
        assert.equal([...html.matchAll(/<h1>/g)].length, 1);
        assert.doesNotMatch(html, /\{\{|<!-- visual:|<script[^>]+src=/);
        assert.equal(renderSEO(html, path), html, 'Generic SEO must not override article metadata');
    }
});

test('publication requires an explicit date and indexes only published articles', () => {
    const missingDate = drafts.map((article, index) => index === 0 ? { ...article, status: 'published' } : article);
    assert.throws(() => blogPages({ articles: missingDate }), /Missing publication date/);
    const articles = drafts.map((article, index) => index === 0 ? { ...article, status: 'published', publishedAt: '2026-09-25' } : article);
    const pages = blogPages({ articles });
    assert.equal(pages.size, 3);
    assert.deepEqual(blogSitemapPaths(articles), ['blog/', 'blog/criterio-editorial/', 'blog/como-usar-menos-el-celular/']);
    const html = pages.get('blog/como-usar-menos-el-celular/');
    assert.match(html, /name="robots" content="index, follow, max-image-preview:large"/);
    assert.equal(schema(html)[0].datePublished, '2026-09-25');
    assert.equal(schema(html)[0].dateModified, '2026-09-25');
    assert.doesNotMatch(html, /Vista previa editorial|href="\/blog\/adiccion-redes-sociales\/"/);
});

test('article schema has visible authorship, primary sources and truthful types', () => {
    for (const article of blogArticles) {
        const html = preview.get(`blog/${article.slug}/`);
        const [posting, breadcrumb] = schema(html);
        assert.equal(posting['@type'], 'BlogPosting');
        assert.equal(posting.headline, article.title);
        assert.equal(posting.author.name, 'Equipo Foco');
        assert.equal(posting.author['@type'], 'Organization');
        assert.equal(posting.inLanguage, 'es-CO');
        assert.equal(posting.mainEntityOfPage, `https://getfoco.co/blog/${article.slug}/`);
        assert.deepEqual(posting.citation, article.sources.map(id => blogSources[id].url));
        assert.equal(breadcrumb.itemListElement.length, 3);
        assert.doesNotMatch(html, /"(?:aggregateRating|review|FAQPage|MedicalWebPage)"/);
        assert.match(html, /Por el Equipo Foco/);
    }
});

test('internal article links and source anchors resolve; IDs are unique', () => {
    for (const [path, html] of preview) {
        const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
        assert.equal(new Set(ids).size, ids.length, `Duplicate ID in ${path}`);
        for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(anchor), `Broken #${anchor} in ${path}`);
        for (const [, link] of html.matchAll(/href="\/(blog\/[^"#]*)"/g)) assert.ok(preview.has(link), `Unrendered link ${link}`);
    }
});

test('all local editorial images, fonts and style dependencies exist', async () => {
    const assets = new Set();
    for (const html of preview.values()) {
        for (const [, asset] of html.matchAll(/(?:src|href)="(\/foco\/[^"#]+)"/g)) assets.add(asset);
        for (const [, asset] of html.matchAll(/(\/foco\/assets\/[\w/-]+\.webp)\s+\d+w/g)) assets.add(asset);
    }
    await Promise.all([...assets].map(asset => access(new URL(`..${asset}`, import.meta.url))));
});

test('blog prices use current subscription totals and never sell legacy card packs', () => {
    assert.deepEqual(priceRows().map(({ total }) => total), [24900, 39900, 119900]);
    assert.deepEqual(priceRows().map(({ shipping }) => shipping), [10000, 0, 0]);
    const article = blogArticles.find(article => article.slug === 'cuanto-cuesta-foco');
    const html = renderArticle(article, { preview: true });
    for (const amount of [14900, 39900, 119900, 24900]) assert.ok(html.includes(formatCOP(amount)));
    assert.doesNotMatch(html, /\$(?:100|110|200|250)\.000|antes de cupones/);
    assert.match(html, /width:93\.125%/); // 14900 / 16000; zero-based ceiling.
    assert.match(html, /periodo completo/);
    assert.match(html, /≈/);
});

test('WHO chart shows exact proportions, accessible data and population limits', () => {
    const html = preview.get('blog/adiccion-redes-sociales/');
    assert.match(html, /width:46\.667%/); // 7 / 15.
    assert.match(html, /width:73\.333%/); // 11 / 15.
    assert.match(html, /<span>0<\/span><span>15%<\/span>/);
    assert.match(html, /<th scope="row">2018<\/th><td>7%<\/td>/);
    assert.match(html, /<th scope="row">2022<\/th><td>11%<\/td>/);
    assert.match(html, /44 países y regiones/);
    assert.match(html, /No son datos de Colombia ni diagnósticos individuales/);
    assert.match(html, /No diagnostica ni trata una adicción/);
    assert.match(html, /no tenemos un ensayo clínico/);
});

test('comparisons disclose commercial authorship and avoid unsupported cost claims', () => {
    const html = preview.get('blog/foco-vs-brick-colombia/');
    assert.match(html, /US\$59/);
    assert.match(html, /no afirmamos haber realizado una prueba de laboratorio ni una experiencia de uso independiente/);
    assert.match(html, /No hemos validado una compra internacional/);
    assert.match(html, /sin cargos recurrentes/);
    assert.doesNotMatch(html, /class="chart-bars"/);
    const apple = preview.get('blog/foco-vs-tiempo-en-pantalla/');
    assert.match(apple, /iOS 27/);
    assert.match(apple, /no hace falta añadir un dispositivo/);
});

test('blog uses the exact homepage footer without changing the source page', async () => {
    const homepage = await readFile(new URL('../foco/index.html', import.meta.url), 'utf8');
    const footer = homepage.match(/<footer\b[^]*?<\/footer>/)[0];
    for (const html of preview.values()) assert.ok(renderSharedFooter(html, homepage).includes(footer));
});

test('both build targets include opt-in preview and production uses published sitemap only', async () => {
    for (const file of ['build-site.mjs', 'build-vercel.mjs']) {
        const source = await readFile(new URL(`../scripts/${file}`, import.meta.url), 'utf8');
        assert.match(source, /process\.env\.FOCO_BLOG_PREVIEW === '1'/);
        assert.match(source, /editorialPages\.get\(path\)/);
    }
    const vercel = await readFile(new URL('../scripts/build-vercel.mjs', import.meta.url), 'utf8');
    assert.match(vercel, /\.\.\.blogSitemapPaths\(\)/);
    assert.match(vercel, /blogPreview && path\.startsWith\('blog\/'\) \? html : renderAnalytics\(html\)/);
});
