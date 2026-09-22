import { cp, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { renderCommercePage, snapshotPolicies } from './policies.mjs';
import { renderSharedFooter } from './shared-footer.mjs';
import { renderFAQ, writeKnowledge } from './faq.mjs';
import { renderArrowFreePage } from './page-presentation.mjs';
import { renderCheckoutPage } from './checkout-page.mjs';
import { renderSEO } from './seo.mjs';
import { pageOptimizer } from './optimize-page.mjs';
const root = new URL('../', import.meta.url);
await snapshotPolicies();
const knowledge = await writeKnowledge();
await rm(new URL('dist/', root), { recursive: true, force: true });
await mkdir(new URL('dist/', root));
// Explicit public allowlist. Source, order functions, env files and docs never ship.
for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && (/\.(html|css|js|svg|png|ico|txt|xml|webmanifest)$/.test(entry.name) || ['_headers','_redirects'].includes(entry.name))) {
        await cp(new URL(entry.name, root), new URL(`dist/${entry.name}`, root));
    }
}
for (const dir of ['assets','foco']) await cp(new URL(dir, root), new URL(`dist/${dir}`, root), { recursive: true });
const homepage = await readFile(new URL('foco/index.html', root), 'utf8');
const optimize = pageOptimizer(new URL('dist/', root));
for (const path of ['', 'blog/', 'comprar/', 'pago/', 'privacidad/', 'terminos/', 'soporte/', 'compra/', 'compra/privacidad/']) {
    const file = new URL(`dist/foco/${path}index.html`, root);
    let html = await readFile(file, 'utf8');
    if (path === 'compra/' || path === 'compra/privacidad/') html = renderCommercePage(html);
    html = renderSEO(renderCheckoutPage(renderSharedFooter(html, homepage)), path);
    await writeFile(file, await optimize(renderArrowFreePage(renderFAQ(html, knowledge.instantAnswers))));
}
console.log('Static site built in dist/. Checkout remains gated by configuration.');
