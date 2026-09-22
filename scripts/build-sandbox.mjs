// Explicit draft-only artifact; runtime credentials and origin remain isolated.
import './build-site.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../dist/', import.meta.url);
for (const [path, before, after] of [
    ['foco/checkout-config.mjs', /productionEnabled: (?:false|true)/g, 'productionEnabled: true'],
    ['foco/commerce-config.mjs', /consentEvidenceVerified: (?:false|true)/g, 'consentEvidenceVerified: true'],
]) {
    const url = new URL(path, root), source = await readFile(url, 'utf8');
    if ([...source.matchAll(before)].length !== 1) throw new Error(`Sandbox patch must be unambiguous: ${path}`);
    await writeFile(url, source.replace(before, after));
}
const page = new URL('foco/index.html', root);
const html = await readFile(page, 'utf8');
await writeFile(page, html.replace(/(<body[^>]*>)/, '$1<div role="status" style="position:relative;z-index:100;padding:14px 20px;background:#101110;color:white;text-align:center;font:13px sans-serif">PRUEBAS · No se cobra dinero real. Usa únicamente los datos sandbox de Wompi.</div>'));
console.log('Sandbox artifact prepared. Deploy only as a draft with test credentials.');
