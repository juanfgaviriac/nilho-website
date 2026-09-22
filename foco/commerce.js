import { FOCO_CHECKOUT, FOCO_WHATSAPP_URL, getOffer, formatCOP, offerName, checkoutAvailable } from './checkout-config.mjs';

const commerce = FOCO_CHECKOUT.commerce;
const fields = { sellerName: commerce.seller.name, sellerNit: commerce.seller.nit,
    noticeAddress: commerce.seller.noticeAddress, returnsAddress: commerce.seller.returnsAddress,
    dispatchCity: commerce.dispatchCity, carrier: commerce.carrier || 'Te la informamos con la guía de envío.',
    material: commerce.product.material, dimensions: commerce.product.dimensions };
for (const element of document.querySelectorAll('[data-field]')) {
    if (fields[element.dataset.field]) element.textContent = fields[element.dataset.field];
}
const available = checkoutAvailable();
for (const banner of document.querySelectorAll('[data-preview]')) banner.hidden = available;
for (const label of document.querySelectorAll('[data-availability]')) {
    label.textContent = available ? 'Tarjetas disponibles para envío.' : 'Compras aún no habilitadas.';
}
for (const link of document.querySelectorAll('[data-whatsapp]')) {
    link.href = FOCO_WHATSAPP_URL;
    link.hidden = false;
}
for (const phone of document.querySelectorAll('[data-phone]')) {
    phone.textContent = `+${new URL(FOCO_WHATSAPP_URL).pathname.slice(1)}`;
}
const list = document.querySelector('[data-offer-list]');
if (list) {
    list.replaceChildren();
    for (const quantity of [1, 2, 3]) {
        const offer = getOffer(quantity);
        const row = document.createElement('div');
        const name = document.createElement('strong');
        const total = document.createElement('span');
        const detail = document.createElement('small');
        name.textContent = offerName(quantity);
        total.textContent = `${formatCOP(offer.total)} COP`;
        detail.textContent = `${offer.shipping ? `${formatCOP(offer.shipping)} de envío incluido` : 'Envío gratis'}${offer.discount ? ` · Ahorras ${formatCOP(offer.discount)}` : ''}`;
        row.append(name, total, detail);
        list.append(row);
    }
}
