import { FOCO_CHECKOUT, FOCO_WHATSAPP_URL, getOffer, getCheckoutOffer, normalizePromoCode, offerName, formatCOP, checkoutAvailable, checkoutCanStart, safeCheckoutURL } from './checkout-config.mjs';

const checkout = document.querySelector('#comprar');
const options = document.querySelector('#offer-options');
const pay = document.querySelector('#wompi-pay');
const consent = document.querySelector('#purchase-consent');
const discountRow = document.querySelector('#summary-discount-row');
const promoRow = document.querySelector('#summary-promo-row');
const promoToggle = document.querySelector('#promo-toggle');
const promoEditor = document.querySelector('#promo-editor');
const promoContent = document.querySelector('.promo-input-row');
const promoInput = document.querySelector('#promo-code');
const promoApply = document.querySelector('#promo-apply');
const promoApplied = document.querySelector('#promo-applied');
const promoRemove = document.querySelector('#promo-remove');
const promoMessage = document.querySelector('#promo-message');
const summary = document.querySelector('.order-summary');
const summaryMovingRows = [promoRow, document.querySelector('#summary-shipping-row'), document.querySelector('.checkout-promo'), document.querySelector('.summary-footer')];
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
        tops: summaryMovingRows.map(row => row.hidden ? null : row.getBoundingClientRect().top) };
    settleSummaryMotion();
    return frame;
}

function transitionSummary(frame, showDiscount) {
    const height = summary.getBoundingClientRect().height;
    if (Math.abs(frame.height - height) > 0.5) {
        animateSummary(summary, [{ height: `${frame.height}px` }, { height: `${height}px` }]);
    }
    summaryMovingRows.forEach((row, index) => {
        if (row.hidden || frame.tops[index] === null) return;
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
let appliedCode = '';
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
    button.innerHTML = `<span class="offer-radio" aria-hidden="true"></span>
        <span class="offer-title-line"><span class="offer-name">${offerName(value)}</span>${offer.badge ? `<span class="offer-badge">${offer.badge}</span>` : ''}</span>
        <span class="offer-price">${formatCOP(offer.subtotal - offer.discount)}</span>
        <span class="offer-total-label">COP</span>
        <span class="offer-shipping">${offer.shipping ? `+ ${formatCOP(offer.shipping)} de envío` : 'Envío gratis'}</span>
        ${offer.discount ? `<span class="offer-saving">Ahorras ${formatCOP(offer.discount)}</span>` : ''}`;
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
    checkout.dataset.quantity = String(quantity);
    const offer = getCheckoutOffer(quantity, appliedCode);
    for (const button of options.children) {
        const selected = Number(button.dataset.quantity) === quantity;
        button.setAttribute('aria-checked', String(selected));
        button.tabIndex = selected ? 0 : -1;
    }
    setText('summary-subtotal', formatCOP(offer.subtotal));
    discountRow.hidden = offer.discount === 0;
    setText('summary-discount', offer.discount ? `−${formatCOP(offer.discount)}` : '');
    promoRow.hidden = offer.promoDiscount === 0;
    setText('summary-promo', offer.promoDiscount ? `−${formatCOP(offer.promoDiscount)}` : '');
    setText('summary-shipping', offer.shipping ? formatCOP(offer.shipping) : 'Envío gratis');
    document.getElementById('summary-shipping').dataset.free = String(offer.shipping === 0);
    setText('summary-total', formatCOP(offer.total));
    updatePayment();
    const whatsapp = document.querySelector('#checkout-whatsapp');
    const url = new URL(FOCO_WHATSAPP_URL);
    url.searchParams.set('text', `Hola, quiero información sobre ${offerName(quantity)} Foco. Total: ${formatCOP(offer.total)} COP. ¿Me ayudan?`);
    whatsapp.href = url.href;
    whatsapp.hidden = false;
    if (frame) transitionSummary(frame, offer.discount > 0);
    const savings = offer.discount + offer.promoDiscount;
    if (announce) setText('checkout-announcement', `${offerName(quantity)}. Total ${formatCOP(offer.total)} COP.${offer.shipping ? ' Envío incluido.' : ' Envío gratis.'}${savings ? ` Ahorras ${formatCOP(savings)}.` : ''}`);
}

function promoFeedback(message, error = false) {
    promoMessage.textContent = message;
    promoMessage.dataset.error = String(error);
    promoInput.setAttribute('aria-invalid', String(error));
}

function setPromoOpen(open, animate = true) {
    // A measured accordion height lets CSS reverse from the current position.
    // Closed controls leave the focus order immediately, even during the fade.
    if (!open && promoEditor.contains(document.activeElement)) promoToggle.focus({ preventScroll: true });
    promoEditor.dataset.instant = String(!animate);
    promoEditor.style.height = open ? `${promoContent.offsetHeight}px` : '0px';
    promoEditor.dataset.open = String(open);
    promoEditor.inert = !open;
    promoEditor.setAttribute('aria-hidden', String(!open));
    promoToggle.setAttribute('aria-expanded', String(open));
    promoToggle.querySelector('span').textContent = open ? '−' : '+';
}

function applyPromo() {
    if (busy) return false;
    let code;
    try {
        code = normalizePromoCode(promoInput.value);
        if (!code) throw new RangeError('empty_code');
    } catch {
        setPromoOpen(true, false);
        promoFeedback('Código inválido.', true);
        promoInput.focus();
        return false;
    }
    if (code !== appliedCode) attemptId = null;
    appliedCode = code;
    promoInput.value = code;
    setText('promo-applied-code', code);
    setPromoOpen(false, false);
    promoToggle.hidden = true;
    promoApplied.hidden = false;
    promoFeedback(`Descuento aplicado: ahorras ${formatCOP(getCheckoutOffer(quantity, code).promoDiscount)}.`);
    select(quantity);
    return true;
}

promoToggle.addEventListener('click', () => {
    if (busy) return;
    const open = promoEditor.dataset.open !== 'true';
    setPromoOpen(open);
    if (open) promoInput.focus({ preventScroll: true });
});
promoEditor.addEventListener('submit', event => {
    event.preventDefault();
    if (applyPromo()) promoRemove.focus();
});
promoInput.addEventListener('input', () => { promoFeedback(''); });
promoRemove.addEventListener('click', () => {
    if (busy) return;
    appliedCode = '';
    attemptId = null;
    promoInput.value = '';
    promoApplied.hidden = true;
    promoToggle.hidden = false;
    setPromoOpen(true, false);
    promoFeedback('');
    select(quantity);
    promoInput.focus();
});

pay.addEventListener('click', async () => {
    if (busy || !checkoutCanStart(quantity, consent.checked)) return;
    // Do not silently charge full price when someone typed a code but skipped Apply.
    if (!appliedCode && promoInput.value.trim() && !applyPromo()) return;
    busy = true;
    checkoutError = '';
    attemptId ||= crypto.randomUUID();
    updatePayment();
    try {
        const response = await fetch(FOCO_CHECKOUT.endpoint, {
            method: 'POST', credentials: 'same-origin', redirect: 'error',
            headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ attemptId, quantity, promoCode: appliedCode, accepted: true,
                termsVersion: FOCO_CHECKOUT.commerce.termsVersion,
                privacyVersion: FOCO_CHECKOUT.commerce.privacyVersion }),
        });
        if (!response.ok) throw new Error('checkout_unavailable');
        const result = await response.json();
        const offer = getCheckoutOffer(quantity, appliedCode);
        if (result.amountInCents !== offer.amountInCents || result.promoCode !== appliedCode) throw new Error('checkout_price_changed');
        const url = safeCheckoutURL(result.checkoutURL);
        if (!url) throw new Error('invalid_checkout');
        window.location.assign(url);
    } catch (error) {
        busy = false;
        if (error.message === 'checkout_price_changed') attemptId = null;
        checkoutError = error.message === 'checkout_price_changed'
            ? 'El total cambió. Actualiza esta página antes de pagar.'
            : 'No pudimos abrir el pago. Intenta de nuevo o escríbenos por WhatsApp.';
        updatePayment();
    }
});

function updatePayment() {
    const available = checkoutAvailable();
    pay.disabled = busy || !checkoutCanStart(quantity, consent.checked);
    pay.setAttribute('aria-busy', String(busy));
    pay.textContent = busy ? 'Preparando tu pago…' : 'Pagar con Wompi';
    consent.disabled = busy;
    for (const control of [promoToggle, promoInput, promoApply, promoRemove]) control.disabled = busy;
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
