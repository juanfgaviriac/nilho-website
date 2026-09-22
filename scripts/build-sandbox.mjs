// Explicit draft-only artifact. Production source flags remain disabled.
import './build-site.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../dist/', import.meta.url);
for (const [path, before, after] of [
    ['foco/checkout-config.mjs', 'productionEnabled: false', 'productionEnabled: true'],
    ['foco/commerce-config.mjs', 'consentEvidenceVerified: false', 'consentEvidenceVerified: true'],
]) {
    const url = new URL(path, root), source = await readFile(url, 'utf8');
    if (source.split(before).length !== 2) throw new Error(`Sandbox patch must be unambiguous: ${path}`);
    await writeFile(url, source.replace(before, after));
}
const page = new URL('foco/index.html', root);
const html = await readFile(page, 'utf8');
await writeFile(page, html.replace(/(<body[^>]*>)/, '$1<div role="status" style="position:relative;z-index:100;padding:14px 20px;background:#101110;color:white;text-align:center;font:13px sans-serif">PRUEBAS · No se cobra dinero real. Usa únicamente los datos sandbox de Wompi.</div>'));
console.log('Sandbox artifact prepared. Deploy only as a draft with test credentials.');
