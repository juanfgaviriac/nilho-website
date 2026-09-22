import { FOCO_CHECKOUT, FOCO_WHATSAPP_URL, getOffer, offerName, formatCOP, checkoutAvailable } from '../foco/checkout-config.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

// Render from the same configuration the payment server uses. Prices are readable
// at first paint, even if JavaScript is slow or unavailable; payment stays disabled.
export function renderCheckoutPage(html, config = FOCO_CHECKOUT) {
    if (!html.includes('id="offer-options"')) return html;
    const selected = config.defaultQuantity;
    const current = getOffer(selected, config);
    const options = Object.keys(config.offers).map(Number).map(quantity => {
        const offer = getOffer(quantity, config);
        const checked = quantity === selected;
        return `<button type="button" class="offer-option" role="radio" data-quantity="${quantity}" aria-checked="${checked}" tabindex="${checked ? 0 : -1}" aria-describedby="offer-total-${quantity}" disabled>
            <span class="offer-radio" aria-hidden="true"></span>
            <span class="offer-title-line"><span class="offer-name">${offerName(quantity)}</span>${offer.badge ? `<span class="offer-badge">${escape(offer.badge)}</span>` : ''}</span>
            <span class="offer-price">${formatCOP(offer.subtotal - offer.discount)}</span>
            <span class="offer-total-label">COP</span>
            <span class="offer-shipping">${offer.shipping ? `+ ${formatCOP(offer.shipping)} de envío` : 'Envío gratis'}</span>
            ${offer.discount ? `<span class="offer-saving">Ahorras ${formatCOP(offer.discount)}</span>` : ''}
            <span class="sr-only" id="offer-total-${quantity}">Total con envío: ${formatCOP(offer.total)} COP.</span>
        </button>`;
    }).join('\n');
    html = html.replace(/(<div\b[^>]*id="offer-options"[^>]*>)[\s\S]*?<\/div>/, `$1${options}</div>`);
    for (const [id, value] of Object.entries({
        'summary-subtotal': formatCOP(current.subtotal),
        'summary-discount': current.discount ? `−${formatCOP(current.discount)}` : '',
        'summary-shipping': current.shipping ? formatCOP(current.shipping) : 'Envío gratis',
        'summary-total': formatCOP(current.total),
        'checkout-availability': checkoutAvailable(config) ? 'Disponible para envío' : 'Próximamente disponible',
    })) html = html.replace(new RegExp(`(id="${id}"[^>]*>)[^<]*`), (_, start) => start + escape(value));
    html = html.replace(/(id="comprar"[^>]*data-quantity=")\d+"/, `$1${selected}"`)
        .replace(/id="summary-discount-row"(?: hidden)?/, `id="summary-discount-row"${current.discount ? '' : ' hidden'}`)
        .replace('id="summary-shipping"', `id="summary-shipping" data-free="${current.shipping === 0}"`);
    const whatsapp = new URL(FOCO_WHATSAPP_URL);
    whatsapp.searchParams.set('text', `Hola, quiero información sobre ${offerName(selected)} Foco. Total: ${formatCOP(current.total)} COP. ¿Me ayudan?`);
    return html.replace('id="checkout-whatsapp" hidden', `id="checkout-whatsapp" href="${escape(whatsapp.href)}"`);
}
