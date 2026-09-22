import { FOCO_COMMERCE, commerceReady } from './commerce-config.mjs';

// Public configuration only. Never add Wompi keys, integrity secrets or bank details here.
// Existing Foco support number supplied by the merchant; approved for orders and support.
export const FOCO_WHATSAPP_URL = 'https://wa.me/573027738407';

export const FOCO_CHECKOUT = Object.freeze({
    defaultQuantity: 2,
    // Final publication gate; merchant facts and consent evidence are checked separately.
    productionEnabled: true,
    endpoint: '/api/foco/checkout',
    redirectUrl: 'https://getfoco.co/pago/', // Configured in Wompi; publish this page with checkout.
    shippingReturnsUrl: FOCO_COMMERCE.termsUrl,
    commerce: FOCO_COMMERCE,
    currency: 'COP',
    offers: Object.freeze({
        1: Object.freeze({ quantity: 1, subtotal: 100000, discount: 0, shipping: 10000, sku: 'FOCO-01', badge: '' }),
        2: Object.freeze({ quantity: 2, subtotal: 200000, discount: 0, shipping: 0, sku: 'FOCO-02', badge: 'Más elegido' }),
        3: Object.freeze({ quantity: 3, subtotal: 300000, discount: 50000, shipping: 0, sku: 'FOCO-03', badge: 'Mejor valor' }),
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

// The browser never chooses a reusable link or sends an amount. The server creates
// a fixed-price, single-use link after recording this order's consent.
export function checkoutAvailable(config = FOCO_CHECKOUT) {
    return config.productionEnabled === true && commerceReady(config.commerce);
}

export function checkoutCanStart(quantity, accepted, config = FOCO_CHECKOUT) {
    getOffer(quantity, config);
    return accepted === true && checkoutAvailable(config);
}

export function safeCheckoutURL(value) {
    try {
        const url = new URL(value);
        return typeof value === 'string' && value === url.href &&
            url.origin === 'https://checkout.wompi.co' && !url.username && !url.password &&
            /^\/l\/[A-Za-z0-9_-]+$/.test(url.pathname) && !url.search && !url.hash ? url.href : null;
    } catch { return null; }
}

export function transactionId(search) {
    const values = new URLSearchParams(search).getAll('id');
    return values.length === 1 && /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(values[0]) ? values[0] : null;
}
