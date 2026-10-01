import { createHash } from 'node:crypto';
import { SUBSCRIPTION_POLICY_VERSION, SUBSCRIPTION_POLICY_PATH } from '../foco/subscription-policy.mjs';
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
    // Existing one-time receipts retain their original archives. Current pages
    // now describe subscriptions and must never overwrite those contracts.
    for (const [kind, version] of [['terms', c.termsVersion], ['privacy', c.privacyVersion]]) {
        await readFile(new URL(`foco/compra/versiones/${version}/${kind}.html`, root), 'utf8');
    }
    const dir = new URL(`${SUBSCRIPTION_POLICY_PATH.slice(1)}/`, root);
    await mkdir(dir, { recursive: true });
    const documents = {};
    for (const [kind, source] of [['terms', 'foco/suscripciones/index.html'], ['privacy', 'foco/compra/privacidad/index.html'], ['app-privacy', 'foco/privacidad/index.html']]) {
        let html = renderCommercePage(await readFile(new URL(source, root), 'utf8'));
        html = html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>/g, '')
            .replace(/<link href="https:\/\/fonts\.googleapis\.com\/[^\"]+" rel="stylesheet">/g, '<link rel="stylesheet" href="/foco/fonts.css">')
            .replace(/<link rel="canonical"[^>]*>/g, `<link rel="canonical" href="https://getfoco.co${SUBSCRIPTION_POLICY_PATH}/${kind}.html">`)
            .replace('</head>', '<meta name="robots" content="noindex, follow"></head>')
            .replaceAll('href="/foco/compra/privacidad/"', `href="${SUBSCRIPTION_POLICY_PATH}/privacy.html"`)
            .replaceAll('href="/foco/privacidad/"', `href="${SUBSCRIPTION_POLICY_PATH}/app-privacy.html"`)
            .replace(/href="\/(?:foco\/)?(?:suscripciones|compra)\/(#[^"]*)?"/g, (_, hash = '') => `href="${SUBSCRIPTION_POLICY_PATH}/terms.html${hash}"`);
        await immutableWrite(new URL(`${kind}.html`, dir), html);
        documents[kind] = { url: `${SUBSCRIPTION_POLICY_PATH}/${kind}.html`, sha256: createHash('sha256').update(html).digest('hex') };
    }
    await immutableWrite(new URL('manifest.json', dir), JSON.stringify({ version: SUBSCRIPTION_POLICY_VERSION, documents }, null, 2) + '\n');
}
async function immutableWrite(path, content) {
    let previous;
    try { previous = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous !== undefined && previous !== content) throw new Error(`Policy changed: bump its version; do not overwrite ${path.pathname}.`);
    if (previous === undefined) await writeFile(path, content, { flag: 'wx' });
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) await snapshotPolicies();
