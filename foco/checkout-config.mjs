import { FOCO_COMMERCE, commerceReady } from './commerce-config.mjs';

// Public configuration only. Never add Wompi keys, integrity secrets or bank details here.
// Existing Foco support number supplied by the merchant; approved for orders and support.
export const FOCO_WHATSAPP_URL = 'https://wa.me/573027738407';

export const FOCO_CHECKOUT = Object.freeze({
    defaultQuantity: 2,
    // Final publication gate; merchant facts and consent evidence are checked separately.
    productionEnabled: false,
    redirectUrl: 'https://nilho.co/foco/pago/', // Configured in Wompi; publish this page with checkout.
    shippingReturnsUrl: FOCO_COMMERCE.termsUrl,
    commerce: FOCO_COMMERCE,
    currency: 'COP',
    offers: Object.freeze({
        1: Object.freeze({ quantity: 1, subtotal: 100000, discount: 0, shipping: 10000, sku: 'FOCO-01', badge: '', wompiUrl: 'https://checkout.wompi.co/l/yUHYqh', sandboxUrl: 'https://checkout.wompi.co/l/test_sTaCFM' }),
        2: Object.freeze({ quantity: 2, subtotal: 200000, discount: 0, shipping: 0, sku: 'FOCO-02', badge: 'Más elegido', wompiUrl: 'https://checkout.wompi.co/l/YtP4V0', sandboxUrl: 'https://checkout.wompi.co/l/test_tgJotM' }),
        3: Object.freeze({ quantity: 3, subtotal: 300000, discount: 50000, shipping: 0, sku: 'FOCO-03', badge: 'Mejor valor', wompiUrl: 'https://checkout.wompi.co/l/iqLMCM', sandboxUrl: 'https://checkout.wompi.co/l/test_ql8j7i' }),
    }),
});

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0, minimumFractionDigits: 0 });
export function formatCOP(amount) { return cop.format(amount); }

export function getOffer(quantity, config = FOCO_CHECKOUT) {
    const offer = config.offers[quantity];
    if (!offer || !Object.hasOwn(config.offers, quantity)) throw new RangeError('Oferta no disponible');
    const total = offer.subtotal - offer.discount + offer.shipping;
    return { ...offer, total, amountInCents: total * 100 };
}

export function offerName(quantity) { return `${quantity} ${quantity === 1 ? 'tarjeta' : 'tarjetas'}`; }

// No query-string prices, user-provided redirects or checkout URL construction.
// Payment amounts live in the merchant's fixed links and MUST be verified before enabling.
export function paymentURL(quantity, config = FOCO_CHECKOUT) {
    const offer = getOffer(quantity, config);
    if (!config.productionEnabled || !commerceReady(config.commerce) || !offer.wompiUrl) return null;
    try {
        const url = new URL(offer.wompiUrl);
        if (offer.wompiUrl !== url.href || url.origin !== 'https://checkout.wompi.co' || url.username || url.password ||
            !/^\/l\/[A-Za-z0-9_-]+$/.test(url.pathname) || /^\/l\/test_/i.test(url.pathname) || url.search || url.hash) return null;
        // Accidentally assigning one link to multiple quantities must fail closed.
        if (Object.values(config.offers).filter(item => item.wompiUrl === offer.wompiUrl).length !== 1) return null;
        return url.href;
    } catch { return null; }
}

// Preparation helper for a trusted server/merchant workflow. Does not make requests.
// Omits taxes and expiry deliberately: IVA needs accountant approval; links never expire.
export function paymentLinkDefinition(quantity, config = FOCO_CHECKOUT) {
    const offer = getOffer(quantity, config);
    return {
        name: `Foco - ${offerName(offer.quantity)}`,
        description: `${offerName(offer.quantity)} Foco NFC. Envío a Colombia incluido en el total.`,
        currency: config.currency,
        amount_in_cents: offer.amountInCents,
        single_use: false,
        collect_shipping: true,
        sku: offer.sku,
        redirect_url: config.redirectUrl,
    };
}

export function transactionId(search) {
    const values = new URLSearchParams(search).getAll('id');
    return values.length === 1 && /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(values[0]) ? values[0] : null;
}

// Consent is intentionally not persisted in the browser or advertised as an order record.
export function checkoutPaymentURL(quantity, accepted, config = FOCO_CHECKOUT) {
    return accepted === true ? paymentURL(quantity, config) : null;
}
