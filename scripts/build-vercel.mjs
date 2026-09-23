import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { renderCommercePage, snapshotPolicies } from './policies.mjs';
import { renderSharedFooter } from './shared-footer.mjs';
import { renderFAQ, writeKnowledge } from './faq.mjs';
import { renderArrowFreePage } from './page-presentation.mjs';
import { renderCheckoutPage } from './checkout-page.mjs';
import { renderSEO } from './seo.mjs';
import { pageOptimizer } from './optimize-page.mjs';
import { renderAnalytics } from './analytics.mjs';
import { blogPages, blogSitemapPaths } from './blog.mjs';
const root = new URL('../', import.meta.url);
await snapshotPolicies();
const knowledge = await writeKnowledge();
const homepage = await readFile(new URL('foco/index.html', root), 'utf8');
const out = new URL('dist/', root);
const optimize = pageOptimizer(out);
const blogPreview = process.env.FOCO_BLOG_PREVIEW === '1';
const editorialPages = blogPages({ preview: blogPreview });
await rm(out, {recursive:true,force:true});
await mkdir(out);
// Foco only. No corporate site, server source, order data or secrets are public.
await cp(new URL('foco/',root),new URL('foco/',out),{recursive:true});
// Add branding at publication time without changing signed policy archives.
const iconLinks = `    <link rel="icon" href="/foco/assets/favicon/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/foco/assets/favicon/favicon-32x32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/foco/assets/favicon/apple-touch-icon.png">
    <link rel="manifest" href="/foco/assets/favicon/site.webmanifest">
`;
await cp(new URL('foco/assets/favicon/favicon.ico',root),new URL('favicon.ico',out));
for (const path of new Set(['', 'blog/', 'comprar/', 'pago/', 'privacidad/', 'terminos/', 'soporte/', 'compra/', 'compra/privacidad/', ...editorialPages.keys()])) {
    const source = editorialPages.get(path) ?? await readFile(new URL(`foco/${path}index.html`,root),'utf8');
    let html = path === 'compra/' || path === 'compra/privacidad/' ? renderCommercePage(source) : source;
    html = renderSEO(renderCheckoutPage(renderSharedFooter(html, homepage)), path);
    html = renderArrowFreePage(renderFAQ(html, knowledge.instantAnswers));
    if (!html.includes('/foco/assets/favicon/')) html = html.replace('</head>',iconLinks+'</head>');
    // Local editorial review must not send draft views into production analytics.
    html = await optimize(blogPreview && path.startsWith('blog/') ? html : renderAnalytics(html));
    await mkdir(new URL(`foco/${path}`,out),{recursive:true});
    await writeFile(new URL(`foco/${path}index.html`,out),html);
    await mkdir(new URL(path,out),{recursive:true});
    // Archives remain byte-for-byte original. Only current pages get clean links.
    await writeFile(new URL(`${path}index.html`,out),html.replaceAll('href="/foco/#comprar"', 'href="/comprar/"').replace(/href="\/foco\/(?=[#"]|(?:blog|comprar|pago|privacidad|terminos|soporte|compra)\/)/g,'href="/'));
}
await cp(new URL('foco/compra/versiones/',root),new URL('compra/versiones/',out),{recursive:true});
await writeFile(new URL('robots.txt',out),'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://getfoco.co/sitemap.xml\n');
await writeFile(new URL('sitemap.xml',out),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['','comprar/','soporte/','privacidad/','terminos/','compra/','compra/privacidad/', ...blogSitemapPaths()].map(path=>`<url><loc>https://getfoco.co/${path}</loc></url>`).join('')+'</urlset>');
console.log('Foco-only Vercel artifact built in dist/.');
