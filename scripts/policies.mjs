import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { FOCO_CHECKOUT, FOCO_WHATSAPP_URL, getOffer, formatCOP, offerName } from '../foco/checkout-config.mjs';
const root = new URL('../', import.meta.url);
const c = FOCO_CHECKOUT.commerce;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fields = { sellerName: c.seller.name, sellerNit: c.seller.nit, noticeAddress: c.seller.noticeAddress,
    returnsAddress: c.seller.returnsAddress, dispatchCity: c.dispatchCity,
    carrier: c.carrier || 'Te la informamos con la guía de envío.', material: c.product.material, dimensions: c.product.dimensions };
// The published HTML is complete even when JavaScript is unavailable.
// Both current pages and policy snapshots use the checkout's public configuration.
export function renderCommercePage(html) {
    return html.replace(/\s*<p[^>]*data-preview[^>]*>[\s\S]*?<\/p>/g, '')
        .replace(/(<[^>]+data-field="([^"]+)"[^>]*>)[^<]*(<\/[^>]+>)/g, (_, open, key, close) => {
            if (!(key in fields) || !fields[key]) throw new Error(`Missing public commerce field: ${key}`);
            return `${open}${escapeHTML(fields[key])}${close}`;
        })
        .replace(/data-availability>[^<]*/, 'data-availability>Disponibilidad informada al realizar el pedido.')
        .replace(/data-phone><\/span>/g, `data-phone>+${new URL(FOCO_WHATSAPP_URL).pathname.slice(1)}</span>`)
        .replace(/data-whatsapp hidden/g, `data-whatsapp href="${FOCO_WHATSAPP_URL}"`)
        .replace(/<noscript>[\s\S]*?<\/noscript>/g, '')
        .replace('<div class="commerce-offers" data-offer-list></div>', `<div class="commerce-offers" data-offer-list>${[1,2,3].map(q => {
            const o = getOffer(q);
            return `<div><strong>${escapeHTML(offerName(q))}</strong><span>${formatCOP(o.total)} COP</span><small>${o.shipping ? `${formatCOP(o.shipping)} de envío incluido` : 'Envío gratis'}${o.discount ? ` · Ahorras ${formatCOP(o.discount)}` : ''}</small></div>`;
        }).join('')}</div>`);
}
export async function snapshotPolicies() {
    for (const [kind, source, version] of [['terms','foco/compra/index.html',c.termsVersion], ['privacy','foco/compra/privacidad/index.html',c.privacyVersion]]) {
        let html = await readFile(new URL(source, root), 'utf8');
        html = renderCommercePage(html).replace(/\s*<script[^>]*src="\/foco\/commerce.js[^>]*><\/script>/g, '');
        // A buyer's archived terms never depend on current public configuration.
        html = html.replaceAll('href="/foco/compra/"', `href="/foco/compra/versiones/${c.termsVersion}/terms.html"`)
            .replaceAll('href="/foco/compra/privacidad/"', `href="/foco/compra/versiones/${c.privacyVersion}/privacy.html"`);
        const dir = new URL(`foco/compra/versiones/${version}/`, root);
        await mkdir(dir, { recursive: true });
        const path = new URL(`${kind}.html`, dir);
        let previous;
        try { previous = await readFile(path,'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (previous !== undefined && previous !== html) throw new Error(`Policy ${kind} changed: bump its version; do not overwrite an archive.`);
        if (previous === undefined) await writeFile(path, html, { flag: 'wx' });
    }
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) await snapshotPolicies();
