import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { snapshotPolicies } from './policies.mjs';
const root = new URL('../', import.meta.url);
await snapshotPolicies();
const out = new URL('dist/', root);
await rm(out, {recursive:true,force:true});
await mkdir(out);
// Foco only. No corporate site, server source, order data or secrets are public.
await cp(new URL('foco/',root),new URL('foco/',out),{recursive:true});
for (const path of ['', 'pago/', 'privacidad/', 'terminos/', 'soporte/', 'compra/', 'compra/privacidad/']) {
    const html = await readFile(new URL(`foco/${path}index.html`,root),'utf8');
    await mkdir(new URL(path,out),{recursive:true});
    // Archives remain byte-for-byte original. Only current pages get clean links.
    await writeFile(new URL(`${path}index.html`,out),html.replace(/href="\/foco\/(?=[#"]|(?:pago|privacidad|terminos|soporte|compra)\/)/g,'href="/'));
}
await cp(new URL('foco/compra/versiones/',root),new URL('compra/versiones/',out),{recursive:true});
await writeFile(new URL('robots.txt',out),'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://getfoco.co/sitemap.xml\n');
await writeFile(new URL('sitemap.xml',out),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['','soporte/','privacidad/','terminos/','compra/','compra/privacidad/'].map(path=>`<url><loc>https://getfoco.co/${path}</loc></url>`).join('')+'</urlset>');
console.log('Foco-only Vercel artifact built in dist/.');
