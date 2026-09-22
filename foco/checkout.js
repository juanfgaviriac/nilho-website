import { FOCO_CHECKOUT, FOCO_WHATSAPP_URL, getOffer, offerName, formatCOP, checkoutAvailable, checkoutCanStart, safeCheckoutURL } from './checkout-config.mjs';

const checkout = document.querySelector('#comprar');
const options = document.querySelector('#offer-options');
const pay = document.querySelector('#wompi-pay');
const consent = document.querySelector('#purchase-consent');
const discountRow = document.querySelector('#summary-discount-row');
const summary = document.querySelector('.order-summary');
const summaryMovingRows = [document.querySelector('#summary-shipping-row'), document.querySelector('.summary-footer')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const summaryAnimations = new Set();
const motionStyle = getComputedStyle(checkout);
const motionTiming = { duration: parseFloat(motionStyle.getPropertyValue('--motion-layout')), easing: motionStyle.getPropertyValue('--ease-out').trim() };

function settleSummaryMotion() {
    for (const animation of summaryAnimations) animation.cancel();
    summaryAnimations.clear();
}

function animateSummary(element, keyframes) {
    const animation = element.animate(keyframes, motionTiming);
    summaryAnimations.add(animation);
    animation.onfinish = () => { summaryAnimations.delete(animation); };
}

// FLIP the shipping/footer from their current visual position, so interrupted
// transitions continue smoothly. Only the expanding summary surface changes height.
function captureSummary() {
    const frame = { height: summary.getBoundingClientRect().height,
        tops: summaryMovingRows.map(row => row.getBoundingClientRect().top) };
    settleSummaryMotion();
    return frame;
}

function transitionSummary(frame, showDiscount) {
    const height = summary.getBoundingClientRect().height;
    if (Math.abs(frame.height - height) > 0.5) {
        animateSummary(summary, [{ height: `${frame.height}px` }, { height: `${height}px` }]);
    }
    summaryMovingRows.forEach((row, index) => {
        const delta = frame.tops[index] - row.getBoundingClientRect().top;
        if (Math.abs(delta) > 0.5) animateSummary(row, [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }]);
    });
    if (showDiscount) animateSummary(discountRow, [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'translateY(0)' }]);
}

checkout.addEventListener('keydown', () => {
    checkout.dataset.motion = 'instant';
    settleSummaryMotion();
});
checkout.addEventListener('pointerdown', () => { delete checkout.dataset.motion; });
reducedMotion.addEventListener('change', event => { if (event.matches) settleSummaryMotion(); });
let quantity = FOCO_CHECKOUT.defaultQuantity;
let busy = false;
let attemptId = null;
let checkoutError = '';
const quantities = Object.keys(FOCO_CHECKOUT.offers).map(Number);
const setText = (id, text) => { document.getElementById(id).textContent = text; };

for (const value of quantities) {
    const offer = getOffer(value);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'offer-option';
    button.setAttribute('role', 'radio');
    button.dataset.quantity = value;
    // All content is static product configuration, never customer/URL input.
    button.innerHTML = `<span class="offer-top"><span class="offer-badge">${offer.badge || 'Para ti'}</span><span class="offer-radio" aria-hidden="true"></span></span>
        <span class="offer-name">${offerName(value)}</span>
        <span class="offer-price">${formatCOP(offer.total)}</span>
        <span class="offer-total-label">Total en COP</span>
        <span class="offer-shipping">${offer.shipping ? `${formatCOP(offer.shipping)} de envío incluido` : 'Envío gratis'}</span>
        <span class="offer-saving">${offer.discount ? `Ahorras ${formatCOP(offer.discount)}` : '\u00a0'}</span>`;
    button.setAttribute('aria-label', `${offerName(value)}. Total ${formatCOP(offer.total)} COP. ${offer.shipping ? `Incluye ${formatCOP(offer.shipping)} de envío` : 'Envío gratis'}.${offer.discount ? ` Ahorras ${formatCOP(offer.discount)}.` : ''}${offer.badge ? ` ${offer.badge}.` : ''}`);
    button.addEventListener('click', event => select(value, true, event.detail > 0));
    button.addEventListener('keydown', event => {
        const index = quantities.indexOf(quantity);
        const next = { ArrowRight: quantities[(index + 1) % quantities.length], ArrowDown: quantities[(index + 1) % quantities.length],
            ArrowLeft: quantities[(index + quantities.length - 1) % quantities.length], ArrowUp: quantities[(index + quantities.length - 1) % quantities.length],
            Home: quantities[0], End: quantities.at(-1) }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(next);
        options.querySelector(`[data-quantity="${next}"]`).focus();
    });
    options.append(button);
}

function select(value, announce = true, animate = false) {
    if (busy) return;
    if (value !== quantity) attemptId = null;
    checkoutError = '';
    const canAnimate = animate && value !== quantity && !reducedMotion.matches && typeof summary.animate === 'function';
    const frame = canAnimate ? captureSummary() : null;
    if (!canAnimate) settleSummaryMotion();
    quantity = value;
    const offer = getOffer(quantity);
    for (const button of options.children) {
        const selected = Number(button.dataset.quantity) === quantity;
        button.setAttribute('aria-checked', String(selected));
        button.tabIndex = selected ? 0 : -1;
    }
    setText('summary-count', offerName(quantity));
    setText('summary-product', `${offerName(quantity)} Foco NFC`);
    setText('summary-subtotal', formatCOP(offer.subtotal));
    discountRow.hidden = offer.discount === 0;
    setText('summary-discount', offer.discount ? `−${formatCOP(offer.discount)}` : '');
    setText('summary-shipping', offer.shipping ? formatCOP(offer.shipping) : 'Envío gratis');
    setText('summary-total', formatCOP(offer.total));
    updatePayment();
    const whatsapp = document.querySelector('#checkout-whatsapp');
    const url = new URL(FOCO_WHATSAPP_URL);
    url.searchParams.set('text', `Hola, quiero información sobre ${offerName(quantity)} Foco. Total: ${formatCOP(offer.total)} COP. ¿Me ayudan?`);
    whatsapp.href = url.href;
    whatsapp.hidden = false;
    if (frame) transitionSummary(frame, offer.discount > 0);
    if (announce) setText('checkout-announcement', `${offerName(quantity)}. Total ${formatCOP(offer.total)} COP.${offer.shipping ? ' Envío incluido.' : ' Envío gratis.'}${offer.discount ? ` Ahorras ${formatCOP(offer.discount)}.` : ''}`);
}

pay.addEventListener('click', async () => {
    if (busy || !checkoutCanStart(quantity, consent.checked)) return;
    busy = true;
    checkoutError = '';
    attemptId ||= crypto.randomUUID();
    updatePayment();
    try {
        const response = await fetch(FOCO_CHECKOUT.endpoint, {
            method: 'POST', credentials: 'same-origin', redirect: 'error',
            headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ attemptId, quantity, accepted: true,
                termsVersion: FOCO_CHECKOUT.commerce.termsVersion,
                privacyVersion: FOCO_CHECKOUT.commerce.privacyVersion }),
        });
        if (!response.ok) throw new Error('checkout_unavailable');
        const result = await response.json();
        const url = safeCheckoutURL(result.checkoutURL);
        if (!url) throw new Error('invalid_checkout');
        window.location.assign(url);
    } catch {
        busy = false;
        checkoutError = 'No pudimos abrir el pago. Intenta de nuevo o escríbenos por WhatsApp.';
        updatePayment();
    }
});

for (const link of document.querySelectorAll('[data-checkout-open]')) {
    link.addEventListener('click', () => checkout.focus({ preventScroll: true }));
}

function updatePayment() {
    const available = checkoutAvailable();
    pay.disabled = busy || !checkoutCanStart(quantity, consent.checked);
    pay.setAttribute('aria-busy', String(busy));
    pay.textContent = busy ? 'Preparando tu pago…' : 'Pagar con Wompi';
    consent.disabled = busy;
    for (const button of options.children) button.disabled = busy;
    setText('checkout-availability', available ? 'Disponible para envío' : 'Próximamente disponible');
    setText('payment-notice', checkoutError || (busy ? 'Estamos preparando tu enlace seguro.' :
        !available ? 'Vista previa · Pagos aún no disponibles.' :
        !consent.checked ? 'Acepta las condiciones para continuar.' : 'Completa el pago y la dirección de envío en Wompi.'));
}
consent.addEventListener('change', updatePayment);
// No persisted cart or query-string prices: refresh starts with the configured default;
// restoring this document from the back/forward cache reconciles every displayed value.
window.addEventListener('pageshow', () => { busy = false; attemptId = null; consent.checked = false; select(quantity, false); });
select(quantity, false);
