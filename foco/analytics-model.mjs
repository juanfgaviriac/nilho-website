export const MEASUREMENT_ID = 'G-3CKE5BGZW0';
export const CONSENT_VERSION = '2026-09-22.2';
export const CONSENT_KEY = 'foco.web-analytics.v1';
export const CONSENT_DAYS = 180;
export const publicPaths = new Set(['/', '/comprar/', '/pago/', '/blog/', '/soporte/', '/privacidad/', '/terminos/', '/compra/', '/compra/privacidad/']);

export function cleanPage(raw) {
    try {
        const url = new URL(raw);
        return url.origin + (publicPaths.has(url.pathname) ? url.pathname : '/');
    } catch { return ''; }
}
export function campaignParameters(raw) {
    const query = new URL(raw).searchParams;
    const fields = {};
    for (const [key, field] of [['source', 'source'], ['medium', 'medium'], ['campaign', 'name'], ['content', 'content']]) {
        const value = query.get(`utm_${key}`);
        // Campaign slugs only; never query text, emails, identifiers or free-form fields.
        if (value && /^[a-z][a-z0-9_-]{0,63}$/i.test(value)) fields[`campaign_${field}`] = value;
    }
    return fields;
}
export function readConsent(raw, now = Date.now()) {
    try {
        const c = JSON.parse(raw);
        return c.version === CONSENT_VERSION && typeof c.allowed === 'boolean' &&
            Number.isFinite(c.at) && c.at <= now && now - c.at < CONSENT_DAYS * 86400000 ? c : null;
    } catch { return null; }
}
export function ecommerceItem(offer) {
    return { currency: 'COP', value: offer.total - offer.shipping,
        items: [{ item_id: offer.sku, item_name: `Pack de ${offer.quantity} tarjeta${offer.quantity === 1 ? '' : 's'} Foco`,
            price: offer.total - offer.shipping, quantity: 1 }] };
}
