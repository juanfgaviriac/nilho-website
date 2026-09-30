import { billingReviewFixture } from './account-review-fixtures.mjs';
import { PREVIEW_OFFER, PREVIEW_PLANS, REVIEW_VIEWS, isLocalReview, accountDestination, subscriptionPresentation, normalizeEmail, validEmail, validCode, validDelivery, previewPlan, previewPlanSavings, previewTotals, escapeHTML as esc } from './account-flow.mjs';
import { createAccountAuth } from './account-auth.mjs';
import { createSandboxWompi, createHostedWompi } from './account-wompi.mjs';
import { recurringCatalog, recurringAgreement, recurringAcceptance, mountAuthentication, resumableAgreement } from './account-recurring.mjs';
import { departmentField } from './colombia-departments.mjs';

const panel = document.querySelector('#account-panel');
const review = isLocalReview(location, document.body.dataset.review);
const reviewAccessState = review ? new URLSearchParams(location.search).get('estado') : null;
const money = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
// Apple logo artwork from Apple's Sign in with Apple JS SDK; retain its original proportions.
// https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js
const apple = '<svg class="account-apple-logo" viewBox="20.5 16 15 19" width="16" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M28.2226562,20.3846154 C29.0546875,20.3846154 30.0976562,19.8048315 30.71875,19.0317864 C31.28125,18.3312142 31.6914062,17.352829 31.6914062,16.3744437 C31.6914062,16.2415766 31.6796875,16.1087095 31.65625,16 C30.7304687,16.0362365 29.6171875,16.640178 28.9492187,17.4494596 C28.421875,18.06548 27.9414062,19.0317864 27.9414062,20.0222505 C27.9414062,20.1671964 27.9648438,20.3121424 27.9765625,20.3604577 C28.0351562,20.3725366 28.1289062,20.3846154 28.2226562,20.3846154 Z M25.2929688,35 C26.4296875,35 26.9335938,34.214876 28.3515625,34.214876 C29.7929688,34.214876 30.109375,34.9758423 31.375,34.9758423 C32.6171875,34.9758423 33.4492188,33.792117 34.234375,32.6325493 C35.1132812,31.3038779 35.4765625,29.9993643 35.5,29.9389701 C35.4179688,29.9148125 33.0390625,28.9122695 33.0390625,26.0979021 C33.0390625,23.6579784 34.9140625,22.5588048 35.0195312,22.474253 C33.7773438,20.6382708 31.890625,20.5899555 31.375,20.5899555 C29.9804688,20.5899555 28.84375,21.4596313 28.1289062,21.4596313 C27.3554688,21.4596313 26.3359375,20.6382708 25.1289062,20.6382708 C22.8320312,20.6382708 20.5,22.5950413 20.5,26.2911634 C20.5,28.5861411 21.3671875,31.013986 22.4335938,32.5842339 C23.3476562,33.9129053 24.1445312,35 25.2929688,35 Z"/></svg>';
const state = { view: 'cuenta', planId: 'monthly', useTrial: false, email: '', returning: false, hasCard: false, consent: false, delivery: {}, auth: null, account: null, config: null, busy: false, resendAt: 0, generation: 0, checkout: null, returnedPayment: null };
const recurring = () => !review && state.config?.recurringCheckout?.enabled === true;
const billingEnvironment = () => state.config?.recurringCheckout?.environment || 'sandbox';
const testBilling = () => billingEnvironment() === 'sandbox';
const billingView = () => recurring() || (review && Boolean(state.agreement));
const sandbox = () => !recurring() && !review && location.origin === 'http://127.0.0.1:4338' && state.config?.sandboxCheckout?.enabled === true;
const checkoutEnabled = () => sandbox() || recurring();
const canPay = () => state.consent && (recurring() ? Boolean(state.catalog && state.acceptance && state.providerTerms && state.personalData)
    : review || (sandbox() && state.config.sandboxCheckout.paymentReady && state.checkout?.state === 'draft'));
const sandboxNotice = '<p class="account-sandbox-note">Prueba de compra · Sin cargos reales ni envíos. Usa datos ficticios.</p>';
let paymentTimer;
let cooldownTimer;
let prepareWompi;
let celebratedAgreement;
const field = (name, label, options = {}) => name === 'department' ? departmentField(state.delivery.department) : `<div class="account-field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${options.type || 'text'}" autocomplete="${options.autocomplete || 'off'}" ${options.inputmode ? `inputmode="${options.inputmode}"` : ''} ${options.required === false ? '' : 'required'} maxlength="${options.maxlength || 120}" ${options.placeholder ? `placeholder="${esc(options.placeholder)}"` : ''} value="${esc(options.value ?? state.delivery[name] ?? '')}">${options.note ? `<small>${options.note}</small>` : ''}</div>`;
const button = (text, action, light = false) => `<button type="button" class="account-button${light ? ' account-button--light' : ''}" data-action="${action}">${text}</button>`;
const errorLine = '<p class="account-error" id="form-error" role="alert"></p>';
const footnote = '<p class="account-footnote">Tu cuenta es la misma en la app y en la web.</p>';
const appLinks = '<a class="account-button account-button--light" href="foco://focus">Abrir Foco</a><p class="account-footnote">¿Todavía no tienes la app? <a href="https://apps.apple.com/co/app/id6808677908" target="_blank" rel="noopener noreferrer">Descargar en App Store</a></p>';
const planRenewal = plan => `${state.useTrial ? 'Después de la prueba' : 'Renovación'}: ${money(plan.amount)} COP ${plan.cadence}. Puedes cancelar antes del siguiente cobro.`;
const shippingDescription = totals => state.hasCard ? 'No necesitas envío.' : totals.shipping ? `Incluye ${money(totals.shipping)} COP de envío.` : 'Envío incluido.';
const trialDescription = () => `Desde que vinculas tu tarjeta en la app. Solo pagas ${money(PREVIEW_OFFER.shipping)} COP de envío hoy.`;
const trialStart = () => state.hasCard ? '' : state.useTrial ? 'Tus 7 días gratis empiezan al vincular tu tarjeta en la app Foco.' : 'Tu periodo pagado empieza al vincular tu tarjeta en la app Foco.';
function updatePlanPricing() {
    const plan = previewPlan(state.planId);
    const totals = previewTotals(state.hasCard, state.planId, state.useTrial);
    panel.querySelector('#plan-renewal').textContent = planRenewal(plan);
    panel.querySelector('#plan-today').textContent = `${money(totals.today)} COP`;
    panel.querySelector('#plan-shipping').textContent = shippingDescription(totals);
}

function heading(title, lede = '') { return `<h1 id="step-title" tabindex="-1">${title}</h1>${lede ? `<p class="step-lede">${lede}</p>` : ''}`; }
function declinedPayment() {
    return heading('No se completó el pago.', 'Revisa tu plan para intentarlo de nuevo.')
        + errorLine
        + `<div class="account-result-actions">${button('Revisar mi plan', 'plan')}`
        + '<div class="account-inline-actions"><a class="account-text-button" href="/soporte/">Necesito ayuda</a><button class="account-text-button" type="button" data-action="signout">Cerrar sesión</button></div></div>'
        + (!review && !sandbox() ? '<p class="account-footnote">Si ves un movimiento pendiente en tu banco, consúltalo antes de volver a pagar.</p>' : '');
}
function error(message, target) {
    const output = panel.querySelector('#form-error');
    if (output) output.textContent = message;
    if (target) {
        target.setAttribute('aria-invalid', 'true');
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
}
function setBusy(busy) {
    state.busy = busy;
    panel.setAttribute('aria-busy', String(busy));
    panel.querySelectorAll('button, input, select').forEach(el => { el.disabled = busy; });
    if (!busy) {
        updateCooldown();
        if (state.view === 'pago') panel.querySelector('[data-action=pay], [data-action=replace-source]')?.toggleAttribute('disabled', !canPay());
        if (state.view === 'plan' && !review) panel.querySelector('[data-action=delivery]').disabled = !checkoutEnabled();
        if (!review && state.view === 'cuenta') {
            panel.querySelector('[data-action=apple]').disabled = !state.config?.appleEnabled;
            panel.querySelector('button[type=submit]').disabled = !state.config?.enabled;
        }
    }
}
function updateCooldown() {
    const el = panel.querySelector('[data-action=resend]');
    if (!el) return;
    const seconds = Math.max(0, Math.ceil((state.resendAt - Date.now()) / 1000));
    el.textContent = seconds ? `Reenviar en ${seconds}s` : 'Reenviar código';
    el.disabled = state.busy || seconds > 0;
}
async function task(work, message = 'No pudimos continuar. Intenta de nuevo.') {
    if (state.busy) return;
    const generation = state.generation;
    setBusy(true);
    try { await work(); }
    catch { if (generation === state.generation) error(message); }
    finally { if (generation === state.generation) setBusy(false); }
}
function go(view, focus = true) {
    if (!REVIEW_VIEWS.has(view)) return;
    const shouldScrollToStep = window.innerWidth < 701 || panel.getBoundingClientRect().top < 0;
    clearTimeout(paymentTimer);
    state.generation++;
    state.busy = false;
    state.view = view;
    panel.setAttribute('aria-busy', 'false');
    render();
    if (review) {
        history.replaceState(null, '', `${location.pathname}?vista=${view}`);
    }
    if (focus) {
        panel.querySelector('#step-title')?.focus({ preventScroll: true });
        if (shouldScrollToStep) {
            panel.scrollIntoView({ block: 'start', behavior: 'instant' });
        }
    }
}
function render() {
    const plan = previewPlan(state.planId);
    const v = state.view;
    const totals = sandbox() && v === 'pago' && state.checkout ? state.checkout.totals : previewTotals(state.hasCard, state.planId, state.useTrial);
    let html = '';
    if (billingView() && state.agreement && state.replacing && v === 'pago') {
        const a = state.agreement;
        html = heading('Cambia tu tarjeta de pago.', 'Tu plan y fecha de renovación se conservan.')
            + `<p class="account-renewal">${money(a.amountInCents / 100)} COP ${previewPlan(a.plan).cadence}</p>`
            + `<div class="account-payment-authorization"><label class="account-check"><input id="renewal-consent" type="checkbox" ${state.consent ? 'checked' : ''}><span>Autorizo esta tarjeta para las renovaciones de mi plan.</span></label>`
            + providerConsent() + errorLine
            + `<div class="account-actions"><button class="account-button account-button--authorize" data-action="replace-source" type="button" ${!canPay() ? 'disabled' : ''}><span>Autorizar nueva tarjeta</span><small>Para renovar por ${money(a.amountInCents / 100)} COP ${previewPlan(a.plan).cadence}</small></button></div></div>`
            + '<p class="account-footnote">Cambiar la tarjeta no genera un cobro.</p>'
            + '<button class="account-text-button" type="button" data-action="back-to-subscription">Volver a mi suscripción</button>';
    } else if (billingView() && state.agreement && v === 'proveedor') {
        html = recurringResult();
    } else if (review && v === 'autorizacion') {
        html = recurringResult({ id: 'visual-preview', plan: 'monthly', amountInCents: 1490000,
            initialPayment: 'approved', sourceState: 'available', useTrial: false });
    } else if (sandbox() && state.checkout && ['procesando', 'confirmacion', 'error'].includes(v)) {
        const paid = state.checkout.state === 'approved';
        const failed = ['declined', 'voided'].includes(state.checkout.state);
        html = failed ? declinedPayment() : heading(paid ? 'Pago confirmado.' : 'Pago pendiente.',
            paid ? 'Wompi confirmó este pago de prueba. No se enviará una tarjeta ni se activará una suscripción.' : 'Tu intento está guardado. Consulta el resultado antes de volver a pagar.')
            + (paid ? `<p class="account-renewal">${state.useTrial ? 'La prueba queda pendiente de vincular la tarjeta en la app; este pago no inicia los 7 días.' : 'El pago inicial no activa renovaciones.'}<br>La autorización de cobros recurrentes se conectará por separado.</p>` : '')
            + errorLine
            + '<div class="account-result-actions">'
            + (!paid ? button('Consultar estado', 'verify-payment') : '')
            + '<div class="account-inline-actions">'
            + (!paid && state.checkout.checkoutURL && Date.parse(state.checkout.expiresAt) > Date.now() ? '<button class="account-text-button" type="button" data-action="resume-payment">Volver a Wompi</button>' : '<a class="account-text-button" href="/soporte/">Necesito ayuda</a>')
            + '<button class="account-text-button" type="button" data-action="signout">Cerrar sesión</button></div></div>';
    } else if (v === 'cuenta') {
        html = heading('Entra a tu Foco por aquí', 'Si ya usas Foco, entra de la misma forma que en la app.')
            + button(`${apple} Continuar con Apple`, 'apple', true)
            + '<div class="account-divider">o con tu correo</div>'
            + `<form class="account-form" id="email-form" novalidate>${field('email', 'Correo electrónico', { type: 'email', autocomplete: 'email', placeholder: 'tu@correo.com', value: state.email, maxlength: 254 })}${errorLine}<button class="account-button" type="submit">Continuar con correo</button></form>`
            + `<div class="account-inline-actions"><button class="account-text-button" type="button" data-action="returning">${state.returning ? 'Estoy creando mi primera cuenta' : 'Ya tengo una cuenta Foco'}</button></div>`
            + `<p class="account-footnote">${state.returning ? 'Buscaremos tu cuenta existente. No crearemos una nueva.' : 'Sin contraseñas. Si eres nuevo, crearemos tu cuenta al verificar tu correo.'}<br>Al continuar aceptas los <a href="/terminos/" target="_blank" rel="noopener">términos</a> y la <a href="/privacidad/" target="_blank" rel="noopener">política de privacidad</a>.</p>`
            + `<p class="account-hint"><strong>¿Entraste con Apple en la app?</strong><br>${!review && state.config?.enabled && !state.config.appleEnabled ? 'El acceso con Apple en la web estará disponible pronto. No crees otra cuenta con correo: tu cuenta sigue funcionando en la app.' : 'Usa Apple también aquí, incluso si ocultaste tu correo. Así conservas tu cuenta y tu acceso.'}</p>`;
        if (!review && state.config && !state.config.enabled) html += '<p class="account-notice" role="status">Estamos preparando el acceso web. Tu cuenta en la app sigue funcionando normalmente.</p>';
    } else if (v === 'codigo' || v === 'codigo-error') {
        html = heading('Mira tu correo.', `Escribe el código enviado a<br><strong>${esc(state.email || 'hola@ejemplo.com')}</strong>.`)
            + `<form class="account-form account-code" id="code-form" novalidate>${field('code', 'Código de acceso', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 8, placeholder: '······' })}${errorLine}<button class="account-button" type="submit">Verificar y continuar</button></form>`
            + '<div class="account-inline-actions"><button class="account-text-button" type="button" data-action="change-email">Cambiar correo</button><button class="account-text-button" type="button" data-action="resend">Reenviar código</button></div>'
            + (review ? '<p class="account-notice">En esta vista previa, escribe cualquier código de 6 dígitos. No enviamos correos.</p>' : '<p class="account-footnote">Si no lo encuentras, revisa spam. Nunca compartas tu código.</p>');
    } else if (v === 'plan') {
        html = heading('Más vida.<br class="account-title-break"> Menos scroll.', 'Prueba Foco a tu ritmo. Tu tarjeta incluida y todas las herramientas para volver a lo tuyo.')
            + `<fieldset class="plan-choice" aria-describedby="plan-savings-note plan-renewal"><legend>Elige tu plan</legend>${PREVIEW_PLANS.map(option => {
                const savings = previewPlanSavings(option.id);
                return `<label><input type="radio" name="plan" value="${option.id}" ${state.planId === option.id ? 'checked' : ''}><span class="plan-choice-name">${option.label}${savings.percent > 0 ? `<span class="account-badge plan-savings">Ahorras ${savings.percent}%</span>` : ''}</span><span class="plan-choice-price"><strong>${money(option.amount)}</strong><small>COP / ${option.period}</small>${option.months > 1 ? `<small class="plan-equivalent">${Number.isInteger(savings.monthlyEquivalent) ? '' : '≈ '}${money(savings.monthlyEquivalent)} COP/mes</small>` : ''}</span></label>`;
            }).join('')}</fieldset>`
            + '<p class="plan-savings-note" id="plan-savings-note">Ahorro aprox. frente al plan mensual, sin envío.</p>'
            + (!state.hasCard ? `<label class="trial-choice"><span><strong>Añadir ${PREVIEW_OFFER.trialDays} días gratis</strong><small id="trial-note">${trialDescription()}</small></span><input id="trial-choice" type="checkbox" aria-describedby="trial-note" ${state.useTrial ? 'checked' : ''}></label>` : '<p class="plan-savings-note">La prueba solo aplica al solicitar una tarjeta nueva.</p>')
            + `<div class="plan-total" aria-live="polite"><div><span>Total hoy</span><strong id="plan-today">${money(totals.today)} COP</strong></div><p id="plan-shipping">${shippingDescription(totals)}</p><p class="plan-renewal" id="plan-renewal">${planRenewal(plan)}</p></div>`
            + `<details class="account-inclusions"><summary>Qué incluye tu plan</summary><ul class="account-features">${['Tarjeta Foco incluida.', 'Todos tus modos, rutinas y estadísticas.', 'Tu acceso en la app, con la misma cuenta.'].map(text => `<li>${check}<span>${text}</span></li>`).join('')}</ul></details>`
            + (!review && !checkoutEnabled() ? '<p class="account-notice">Oferta en preparación. Todavía no se pueden contratar suscripciones desde la web.</p>' : '')
            + '<div class="account-actions"><div class="account-action-row"><button class="account-text-button" type="button" data-action="signout">Cambiar de cuenta</button>'
            + button('Continuar', 'delivery') + '</div></div>';
    } else if (v === 'envio') {
        html = heading('¿Dónde recibes tu tarjeta?', 'Solo necesitamos los datos para tu entrega en Colombia.')
            + `<fieldset class="card-choice"><legend>¿Necesitas una tarjeta?</legend><label><input type="radio" name="card" value="new" ${!state.hasCard ? 'checked' : ''}><span>Envíenme mi tarjeta Foco<small>Tarjeta incluida · ${previewTotals(false, state.planId, state.useTrial).shipping ? money(PREVIEW_OFFER.shipping) + ' COP de envío' : 'Envío incluido'}</small></span></label><label><input type="radio" name="card" value="existing" ${state.hasCard ? 'checked' : ''}><span>Ya tengo una tarjeta Foco<small>No necesito envío.</small></span></label></fieldset>`
            + `<form class="account-form" id="delivery-form" novalidate>${state.hasCard ? '<p class="account-notice">Usarás tu tarjeta actual, sin envío ni prueba gratuita. Si tu cuenta tiene acceso de por vida, no necesitas una suscripción.</p>' : `<div class="account-field-row account-field-row--desktop">${field('name', 'Nombre de quien recibe', { autocomplete: 'shipping name', placeholder: 'Nombre y apellido' })}${field('phone', 'Celular en Colombia', { type: 'tel', inputmode: 'tel', autocomplete: 'shipping tel-national', placeholder: '300 123 4567', maxlength: 18, note: '+57 · Solo para coordinar tu entrega.' })}</div><div class="account-field-row">${field('department', 'Departamento', { autocomplete: 'shipping address-level1', placeholder: 'Bogotá D.C.' })}${field('city', 'Ciudad', { autocomplete: 'shipping address-level2', placeholder: 'Bogotá' })}</div><div class="account-field-row account-field-row--desktop">${field('address', 'Dirección', { autocomplete: 'shipping address-line1', placeholder: 'Calle, número y barrio' })}${field('detail', 'Apartamento o indicaciones (opcional)', { autocomplete: 'shipping address-line2', placeholder: 'Apto. 302', required: false })}</div>`}${errorLine}<div class="account-actions"><div class="account-action-row"><button class="account-text-button" type="button" data-action="plan">Volver al plan</button><button type="submit" class="account-button">Revisar mi pedido</button></div></div></form>`;
    } else if (v === 'pago') {
        html = heading('Un último vistazo.')
            + `<div class="account-summary-grid${state.hasCard ? ' account-summary-grid--existing' : ''}"><div><dl class="account-receipt"><div><dt>${plan.name}</dt><dd>${state.useTrial ? PREVIEW_OFFER.trialDays + ' días de prueba' : money(totals.subscription) + ' COP'}</dd></div><div><dt>Tarjeta Foco</dt><dd>${state.hasCard ? 'Usas tu tarjeta' : 'Incluida'}</dd></div><div><dt>Envío</dt><dd>${state.hasCard ? 'No lo necesitas' : totals.shipping ? money(totals.shipping) + ' COP' : 'Incluido'}</dd></div><div class="receipt-total"><dt>Total hoy <small>COP</small></dt><dd>${money(totals.today)}</dd></div></dl>`
            + `<p class="account-renewal"><strong>${state.useTrial ? 'Después de la prueba' : 'Renovación'}: ${money(totals.renewal)} COP ${plan.cadence}.</strong><br>${state.useTrial ? '7 días gratis desde que vinculas tu tarjeta. Cancela antes para evitar el cobro.' : state.hasCard ? 'El primer periodo se paga hoy. Puedes cancelar antes del siguiente cobro.' : 'Pagas hoy. Tu periodo empieza al vincular tu tarjeta Foco.'}</p>`
            + '<button type="button" class="account-text-button" data-action="plan">Cambiar plan</button></div><div>'
            + (!state.hasCard ? `<div class="account-delivery"><p><strong>${esc(state.delivery.name || 'Nombre de ejemplo')}</strong></p><p>${esc(state.delivery.address || 'Calle 100 # 10-20')}${state.delivery.detail ? ', ' + esc(state.delivery.detail) : ''}<br>${esc(state.delivery.city || 'Bogotá')}, ${esc(state.delivery.department || 'Bogotá D.C.')}</p>${state.delivery.phone ? `<p class="account-delivery-phone">Celular: +57 ${esc(state.delivery.phone)}</p>` : ''}<button type="button" class="account-text-button" data-action="delivery">Editar entrega</button></div>` : '<button type="button" class="account-text-button" data-action="delivery">Cambiar opción de tarjeta</button>')
            + '</div></div>'
            + `<details class="account-terms"><summary>Condiciones</summary><p><a href="/suscripciones/" target="_blank" rel="noopener noreferrer">Condiciones y privacidad de la suscripción</a></p><p>${plan.name}: renovación automática de ${money(totals.renewal)} COP ${plan.cadence}. Una tarjeta incluida por cuenta elegible. ${state.useTrial ? 'La prueba es gratuita; el envío de la tarjeta cuesta ' + money(PREVIEW_OFFER.shipping) + ' COP. ' + trialStart() + ' Ni la compra ni la entrega inician la prueba. Volver a escanear o vincular la tarjeta no reinicia los 7 días.' : 'El primer periodo se paga hoy. ' + trialStart() + ' El envío está incluido al pagar por adelantado 3 meses o un año; en el mensual cuesta ' + money(PREVIEW_OFFER.shipping) + ' COP.'} No hay envío si usas tu tarjeta actual. Cancelar la suscripción evita futuros cargos; no cancela un envío ya despachado. Los usuarios con acceso de por vida no necesitan pagar.</p><p>${billingView() ? testBilling() ? 'Modo de prueba: sin cobros reales ni envíos.' : 'Consulta las condiciones de suscripción y privacidad antes de autorizar.' : 'Esta es una propuesta en revisión. No reemplaza las condiciones de compra publicadas ni autoriza ningún cobro. Las condiciones de devolución de la tarjeta, activación en la app y elegibilidad deben cerrarse antes del lanzamiento.'}</p></details>`
            + `<div class="account-payment-authorization"><label class="account-check"><input id="renewal-consent" type="checkbox" ${state.consent ? 'checked' : ''}><span>${billingView() ? 'Autorizo el pago de hoy y las renovaciones automáticas con mi tarjeta en Wompi. Acepto las condiciones de suscripción.' : `Entiendo el total de hoy y la renovación de ${money(totals.renewal)} COP ${plan.cadence}${state.useTrial ? ' después de la prueba' : ''}. Acepto las condiciones de esta propuesta.`}</span></label>`
            + (billingView() ? providerConsent() : '')
            + errorLine + `<div class="account-actions"><button class="account-button${billingView() ? ' account-button--authorize' : ''}" data-action="pay" type="button" ${!canPay() ? 'disabled' : ''}>${billingView() ? `<span>Autorizar ${state.useTrial ? 'envío' : 'pago'} de ${money(totals.today)} COP</span><small>y renovación de ${money(totals.renewal)} COP ${plan.cadence}${state.useTrial ? ' después de la prueba' : ''}</small>` : sandbox() ? 'Probar pago con Wompi' : totals.today ? 'Continuar con Wompi' : 'Configurar mi suscripción'}</button>`
            + `<p class="account-footnote">${billingView() ? testBilling() ? 'Usa una tarjeta de prueba en Wompi. Sin cobros reales.' : 'Los datos de tu tarjeta se ingresan de forma segura en Wompi.' : review ? 'En esta revisión simulamos el resultado.<br>No pedimos datos de tarjeta ni hacemos cobros.' : sandbox() ? state.config.sandboxCheckout.paymentReady ? 'Abrirás Wompi Sandbox. Solo usa sus medios de pago de prueba.<br>Este paso no autoriza cargos recurrentes.' : 'Tu resumen está listo. Falta conectar las llaves de Wompi Sandbox para probar el pago.' : 'El pago se habilitará cuando las suscripciones estén disponibles.'}</p></div></div>`;
    } else if (v === 'proveedor') {
        html = heading('El pago,<br>en manos de Wompi.', 'En el flujo final, aquí abrirás Wompi para autorizar tu medio de pago.')
            + '<p class="account-notice">Este panel marca el cambio de plataforma; no reproduce la interfaz de Wompi. El paso real de autorización está pendiente de configurar y probar en sandbox.</p>'
            + '<p class="step-lede">En esta revisión puedes explorar cada resultado, sin escribir datos bancarios.</p>'
            + button('Simular pago aprobado', 'approved')
            + '<div class="account-inline-actions"><button class="account-text-button" type="button" data-action="declined">Ver pago no aprobado</button><button class="account-text-button" type="button" data-action="payment">Volver sin pagar</button></div>';
    } else if (v === 'procesando') {
        html = '<div class="account-status-symbol"><span class="account-spinner" aria-hidden="true"></span></div>'
            + heading('Estamos confirmando<br>tu pago.', 'No vuelvas a pagar. Esperamos la confirmación segura del proveedor.')
            + '<p class="account-notice" role="status">Tu pedido aún no está confirmado. Actualizaremos este estado cuando recibamos la respuesta.</p>'
            + (review ? button('Ver confirmación de ejemplo', 'success') : button('Consultar estado', 'retry'));
    } else if (v === 'confirmacion') {
        html = `<div class="account-status-symbol">${check}</div>` + heading('Listo.<br>Lo que sigue es tuyo.', state.hasCard ? 'Tu acceso está listo. Abre la app con esta misma cuenta y vincula tu tarjeta.' : 'Tu pedido está confirmado. Ahora nos encargamos de llevar Foco hasta ti.')
            + `<p class="account-renewal"><strong>${plan.name}</strong><br>${planRenewal(plan)}</p>`
            + `<ol class="account-steps"><li><div><strong>Abre la app Foco</strong><span>Entra con el mismo método que usaste aquí.</span></div></li><li><div><strong>${state.hasCard ? 'Vincula tu tarjeta' : 'Recibe tu tarjeta'}</strong><span>${state.hasCard ? 'Acércala a tu iPhone desde la app.' : 'Te avisaremos cuando tu envío esté en camino.'}</span></div></li><li><div><strong>${state.useTrial ? 'Tus 7 días, a tu ritmo' : 'Empieza a usar Foco'}</strong><span>${state.useTrial ? trialStart() : 'Configura tus modos y rutinas en la app.'}</span></div></li></ol>`
            + appLinks
            + (review ? '<p class="account-footnote">Confirmación de ejemplo. No se creó ningún pedido.</p>' : footnote);
    } else if (v === 'vitalicio') {
        html = `<div class="account-status-symbol">${check}</div>` + heading('Tu Foco.<br>Para siempre.', 'Tu cuenta tiene acceso de por vida. No necesitas suscribirte ni añadir un medio de pago.')
            + '<div class="account-plan"><div class="account-plan-top"><span>Acceso de por vida</span><span class="account-badge">Activo</span></div><p style="margin-top:16px">Sin mensualidades. Sin fecha de vencimiento.<br>Ligado a tu cuenta, no a una tarjeta específica.</p></div>'
            + '<p class="step-lede">Sigue usando tu tarjeta. Si la reemplazas, vincula una tarjeta Foco válida en la app con esta misma cuenta.</p>'
            + appLinks
            + '<div class="account-inline-actions"><a class="account-text-button" href="/soporte/">Necesito ayuda</a><button class="account-text-button" type="button" data-action="signout">Cerrar sesión</button></div>';
    } else if (v === 'activo') {
        const account = review ? { needsBillingReview: false, subscriptions: [{ provider: 'apple', plan: 'monthly', status: 'active', autoRenews: true, periodEndsAt: '2099-10-01T00:00:00Z', gracePeriodEndsAt: null }] } : state.account;
        if (review) {
            const status = reviewAccessState;
            if (['awaiting_payment', 'awaiting_card', 'trialing', 'canceled', 'payment_attention', 'expired'].includes(status)) {
                account.subscriptions = [{ provider: 'wompi', plan: 'monthly', status,
                    autoRenews: ['awaiting_card', 'trialing'].includes(status),
                    periodEndsAt: ['trialing', 'canceled'].includes(status) ? '2099-10-01T00:00:00Z' : null }];
            }
        }
        html = `<div class="account-status-symbol">${check}</div>` + heading('Tu suscripción.', account.needsBillingReview ? 'Hay suscripciones que debemos revisar. No necesitas contratar otra.' : 'Consulta tu suscripción existente antes de hacer una nueva compra.')
            + account.subscriptions.map(row => {
                const details = subscriptionPresentation(row);
                const end = row.accessUntil || row.gracePeriodEndsAt || row.periodEndsAt;
                const until = end ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' }).format(new Date(end)) : null;
                const period = until ? `Periodo hasta el ${esc(until)}.` : row.status === 'awaiting_card'
                    ? 'Vincula tu tarjeta en la app para activar tu acceso.'
                    : row.status === 'payment_attention' ? 'Revisa el pago antes de volver a pagar.'
                    : ['expired', 'revoked', 'canceled'].includes(row.status) ? 'No hay un periodo de acceso vigente.'
                    : 'La autorización aún no confirma un periodo de acceso.';
                return `<div class="account-plan"><div class="account-plan-top"><span>${esc(details.plan)}</span><span class="account-badge">${details.status}</span></div><p style="margin-top:16px">Gestionada por ${details.provider}.<br>${period}${review && until ? ' Fecha de ejemplo.' : ''}<br>${row.autoRenews ? 'Renovación automática activada.' : 'Renovación automática desactivada.'}</p></div>`;
            }).join('')
            + (account.subscriptions.some(row => row.provider === 'apple') ? '<a class="account-button" href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noopener">Gestionar en Apple</a>' : '')
            + (account.needsBillingReview || account.subscriptions.some(row => row.provider === 'wompi') ? '<a class="account-button account-button--light" href="/soporte/">Ayuda con mi suscripción</a>' : '')
            + '<p class="account-footnote">Cambiar de tarjeta Foco no requiere otra suscripción.</p><button type="button" class="account-text-button" data-action="signout">Cerrar sesión</button>';
    } else if (v === 'pendiente') {
        html = heading('Ya entraste<br>a tu Foco.', 'Tu cuenta está conectada. Los nuevos planes todavía no están disponibles para contratar.')
            + '<p class="account-notice">Si ya compraste tu tarjeta, continúa en la app con esta misma cuenta. No necesitas contratar otro plan aquí.</p>'
            + appLinks
            + button('Consultar de nuevo', 'retry')
            + '<div class="account-inline-actions"><a href="/soporte/">Necesito ayuda</a><button class="account-text-button" type="button" data-action="signout">Cerrar sesión</button></div>';
    } else if (v === 'error') {
        html = declinedPayment();
    } else if (v === 'sinconexion') {
        html = heading('No pudimos<br>verificar tu cuenta.', 'Esto no significa que hayas perdido tu acceso. Inténtalo de nuevo en un momento.')
            + errorLine + button('Volver a intentar', 'retry') + '<div class="account-inline-actions"><a class="account-text-button" href="/soporte/">Necesito ayuda</a><button type="button" class="account-text-button" data-action="signout">Cerrar sesión</button></div>';
    }
    panel.dataset.view = v;
    const resultView = ['procesando', 'confirmacion', 'error', 'proveedor'].includes(v);
    const notice = checkoutEnabled() && testBilling() && !['cuenta', 'codigo', 'vitalicio', 'activo', 'pendiente', 'sinconexion'].includes(v)
        ? resultView ? '<p class="account-sandbox-note">Modo de prueba · Sin cargos reales.</p>' : sandboxNotice
        : review && ['error', 'autorizacion'].includes(v) ? '<p class="account-sandbox-note">Vista previa · Sin cargos reales.</p>' : '';
    const bankFrame = v === 'proveedor' && (state.agreement?.sourceState === 'verifying' || state.agreement?.sourceChange?.state === 'verifying') && !state.agreement.canceledAt && !state.sourceFailed
        ? panel.querySelector('#bank-authentication iframe') : null;
    const identity = !review && state.account && state.email
        ? `<p class="account-identity">${esc(state.email)}</p>` : '';
    panel.innerHTML = `<div class="step-content">${identity}${notice}${html}</div>`;
    if (review && v === 'autorizacion') panel.querySelectorAll('button').forEach(el => { el.disabled = true; });
    if (bankFrame) panel.querySelector('#bank-authentication')?.append(bankFrame);
    if (v === 'codigo-error') error('El código venció o no es válido. Solicita uno nuevo.');
    if (v === 'cuenta' && !review) {
        panel.querySelector('[data-action=apple]').disabled = !state.config?.appleEnabled;
        panel.querySelector('button[type=submit]').disabled = !state.config?.enabled;
    }
    if (v === 'plan' && !review) panel.querySelector('[data-action=delivery]').disabled = !checkoutEnabled();
    updateCooldown();
}

async function readAccess() {
    const generation = state.generation;
    try {
        const result = await state.auth.status();
        if (generation !== state.generation) return;
        if (!result) return clearAccount();
        state.account = result;
        state.email = typeof result.accountEmail === 'string' ? result.accountEmail : state.email;
        const destination = accountDestination(result);
        if (recurring() && destination !== 'vitalicio' && !result.needsBillingReview
            && !result.subscriptions.some(row => row.provider === 'apple' && (row.accessUntil || row.autoRenews))) {
            const saved = await state.auth.subscription('status');
            if (generation !== state.generation) return;
            if (saved.environment !== billingEnvironment() || !Array.isArray(saved.agreements)) throw Error('invalid_status');
            state.checkedAt = saved.checkedAt;
            const row = resumableAgreement(saved.agreements, saved.checkedAt);
            if (row) { restoreAgreement(row); return go('proveedor'); }
            const catalog = await state.auth.subscription('catalog');
            if (generation !== state.generation) return;
            if (!catalog.products?.length) return go('pendiente');
            state.catalog = recurringCatalog(catalog, billingEnvironment());
            state.agreement = null; state.creationId = null;
            return go('plan');
        }
        if (destination === 'plan' && sandbox()) {
            const saved = await state.auth.checkout('resume');
            if (generation !== state.generation) return;
            if (saved.checkout) {
                restoreCheckout(saved);
                if (state.returnedPayment) return verifyPayment();
                return go(saved.checkout.state === 'draft' ? 'pago' : checkoutView(saved.checkout));
            }
        }
        go(destination === 'plan' && !checkoutEnabled() ? 'pendiente' : destination);
    } catch { if (generation === state.generation) { state.account = null; go('sinconexion'); } }
}
function clearAccount() {
    state.account = null; state.email = ''; state.delivery = {}; state.consent = false;
    state.hasCard = false; state.planId = 'monthly'; state.useTrial = false; state.returning = false; state.resendAt = 0;
    state.checkout = null; state.returnedPayment = null; prepareWompi = null;
    state.agreement = null; state.catalog = null; state.acceptance = null;
    state.providerTerms = false; state.personalData = false; state.creationId = null;
    state.sourceFailed = false; state.cancelConfirm = false; state.replacing = false; state.sourceChangeId = null;
    state.authPolls = 0; state.paymentPolls = 0;
    go('cuenta');
}
function restoreCheckout(result) {
    const row = result.checkout;
    if (!row || row.environment !== 'sandbox' || row.recurringAuthorized !== false || row.trialStartsAt !== null) throw Error('invalid_checkout');
    state.checkout = row;
    state.config.sandboxCheckout = result.config;
    state.planId = row.planId; state.useTrial = row.useTrial; state.hasCard = row.hasCard; state.delivery = row.delivery;
    state.consent = false;
}
const checkoutView = row => row.state === 'approved' ? 'confirmacion' : ['declined', 'voided'].includes(row.state) ? 'error' : 'procesando';
async function verifyPayment() {
    const generation = state.generation;
    try {
        const result = await state.auth.checkout('verify', { transactionId: state.returnedPayment || undefined });
        if (generation !== state.generation) return;
        restoreCheckout(result); state.returnedPayment = null;
        go(checkoutView(result.checkout));
    } catch {
        if (generation !== state.generation) return;
        go('procesando'); error('Aún no pudimos confirmar el resultado. Vuelve desde Wompi o consulta de nuevo; no repitas el pago.');
    }
}
async function openSandboxPayment() {
    if (!sandbox()) throw Error('sandbox_only');
    const generation = state.generation;
    prepareWompi ||= createSandboxWompi();
    const open = await prepareWompi(state.checkout?.checkoutURL || '');
    if (generation !== state.generation) return;
    go('procesando');
    const paymentGeneration = state.generation;
    open(transactionId => {
        if (paymentGeneration !== state.generation) return;
        // A widget callback is not payment proof. Only the backend can confirm it.
        state.returnedPayment = transactionId;
        void task(verifyPayment);
    });
}

function providerConsent() {
    if (!state.acceptance) return '<p class="account-notice">No pudimos cargar las condiciones de Wompi. Vuelve al paso anterior para intentar de nuevo.</p>';
    return `<div class="account-provider-consent"><label class="account-check"><input id="provider-terms" type="checkbox" ${state.providerTerms ? 'checked' : ''}><span>Acepto los <a href="${esc(state.acceptance.presigned_acceptance.permalink)}" target="_blank" rel="noopener noreferrer">términos de Wompi</a>.</span></label><label class="account-check"><input id="personal-data" type="checkbox" ${state.personalData ? 'checked' : ''}><span>Autorizo el <a href="${esc(state.acceptance.presigned_personal_data_auth.permalink)}" target="_blank" rel="noopener noreferrer">tratamiento de datos por Wompi</a>.</span></label></div>`;
}
function restoreAgreement(row) {
    state.agreement = recurringAgreement(row, billingEnvironment());
    state.planId = row.plan; state.useTrial = row.useTrial; state.hasCard = row.hasCard; state.delivery = row.delivery;
}
function recurringResult(a = state.agreement) {
    const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
        ? new Date(value).toLocaleDateString('es-CO', { dateStyle: 'long' }) : null;
    const trial = a.state === 'trialing', active = a.state === 'active';
    const attention = a.state === 'past_due', revoked = a.state === 'revoked';
    const canceled = Boolean(a.canceledAt) || ['canceled', 'revoked'].includes(a.state);
    // Use the server's clock, including sandbox time. The browser clock is not billing authority.
    const end = a.periodEndsAt || a.trialEndsAt;
    const expired = a.state === 'expired' || (canceled && end && state.checkedAt && Date.parse(end) <= Date.parse(state.checkedAt));
    const paid = a.initialPayment === 'approved', ready = a.sourceState === 'available';
    const failed = state.sourceFailed || ['declined', 'voided'].includes(a.initialPayment);
    const needsPayment = ready && a.initialPayment === 'queued' && !canceled && !failed && !attention;
    const complete = paid && ready && !canceled && !failed && !attention && !expired;
    const changing = ['dispatched', 'verifying', 'unknown'].includes(a.sourceChange?.state);
    const animate = complete && celebratedAgreement !== a.id;
    if (complete) celebratedAgreement = a.id;
    const title = changing ? 'Verificando tu tarjeta.' : revoked ? 'Suscripción anulada.' : expired ? 'Tu plan finalizó.' : canceled ? 'Renovación cancelada.'
        : attention ? a.canRetryPayment ? 'Confirma tu pago.' : 'Actualiza tu pago.'
        : trial ? 'Prueba activa.' : active ? 'Suscripción activa.' : failed ? 'No se completó el pago.'
        : paid ? 'Tu tarjeta, el siguiente paso.' : needsPayment ? 'Todo listo para pagar.'
        : ready ? 'Confirmando tu pago.' : a.sourceState === 'verifying' ? 'Confirma con tu banco.' : a.sourceState === 'unknown' ? 'Verificando autorización.' : 'Autoriza tu pago.';
    const lede = changing ? 'Termina la verificación con tu banco. Conservamos tu plan.' : revoked ? 'Contacta a soporte si necesitas ayuda.' : expired ? 'Puedes elegir un nuevo plan en la app.'
        : canceled ? end ? 'Conservas el acceso hasta la fecha indicada.' : paid ? 'No habrá renovaciones. Tu periodo pagado empieza al vincular la tarjeta.' : 'No habrá nuevos cobros.'
        : attention ? a.canRetryPayment ? 'Tu nueva tarjeta está lista.' : 'Cambia tu tarjeta y confirma el pago para continuar.'
        : trial || active ? '' : failed ? 'Cancela este intento antes de usar otra tarjeta de pago.'
        : paid ? a.useTrial ? 'Tus 7 días gratis empiezan al vincular tu tarjeta Foco en la app.' : 'Tu periodo pagado empieza al vincular tu tarjeta Foco en la app.'
        : needsPayment ? a.useTrial ? '7 días gratis al vincular tu tarjeta. Hoy pagas el envío.' : 'Tu tarjeta de pago está autorizada.'
        : ready ? 'Tu intento está guardado. No repitas el pago.'
        : a.sourceState === 'new' ? 'Completa el formulario de Wompi para continuar.'
        : a.sourceState === 'verifying' ? 'Termina la verificación para continuar.' : 'Estamos consultando a Wompi. No repitas la autorización.';
    let html = complete ? `<div class="account-authorization${animate ? ' account-authorization--arrive' : ''}">
        <div class="authorization-art" aria-hidden="true"><img class="authorization-emblem" src="/foco/assets/authorization-seal.svg" alt="" width="216" height="144"></div>${heading(title, lede)}`
        : `${needsPayment ? '<div class="account-payment-confirmation">' : ''}${heading(title, lede)}`;
    if (ready && !needsPayment) html += `<div class="authorization-renewal"><p class="billing-plan-name">${previewPlan(a.plan).name}</p><p><strong>${money(a.amountInCents / 100)}</strong> <span>COP ${previewPlan(a.plan).cadence}${a.useTrial && !active && !canceled && !attention ? ', después de la prueba' : ''}.</span></p></div>`;
    const next = !canceled && !attention && date(a.nextChargeAt);
    const until = date(attention ? a.graceEndsAt : end);
    if (next || until) html += `<div class="billing-date"><span>${next ? 'Próxima renovación' : attention ? 'Acceso temporal hasta' : expired ? 'Finalizó el' : 'Acceso hasta'}</span><strong>${next || until}</strong></div>`;
    if (!canceled && a.sourceChange) html += `<p class="account-notice" role="status">${a.sourceChange.state === 'available' ? 'Tarjeta de pago actualizada.' : a.sourceChange.state === 'failed' ? 'No se cambió la tarjeta. Puedes probar con otra.' : a.sourceChange.state === 'verifying' ? 'Confirma el cambio con tu banco.' : 'Verificando tu nueva tarjeta. No repitas la autorización.'}</p>`;
    if (paid && !revoked && !expired) html += '<p class="account-hint">Abre Foco e inicia sesión con la misma cuenta que usaste aquí. Tu plan se reconocerá sin volver a pagar.</p>' + appLinks;
    html += '<div id="bank-authentication"></div>' + errorLine + '<div class="account-result-actions">';
    if (a.canRetryPayment && !canceled && a.latestPayment?.state === 'declined') html += `<button type="button" class="account-button account-button--authorize" data-action="retry-payment"><span>Pagar · ${money(a.latestPayment.amountInCents / 100)} COP</span><small>Con tu nueva tarjeta de pago</small></button>`;
    if (paid || canceled || attention) html += '<button class="account-text-button" type="button" data-action="refresh-authorization">Actualizar estado</button>';
    if (!canceled && !failed && !paid) {
        if (a.sourceState === 'new') html += button('Autorizar tarjeta de pago', 'authorize-again');
        else if (needsPayment) html += `<button type="button" class="account-button account-button--authorize" data-action="charge-initial"><span>Pagar${a.useTrial ? ' envío' : ''} · ${money(a.initialInCents / 100)} COP</span><small>${a.useTrial ? 'Después de la prueba' : 'Renovación'}: ${money(a.amountInCents / 100)} COP ${previewPlan(a.plan).cadence}</small></button>`;
        else html += button('Consultar estado', 'refresh-authorization');
    }
    if (ready && !canceled && !changing) html += attention && !a.canRetryPayment ? button('Cambiar tarjeta de pago', 'change-payment-card') : '<button class="account-text-button" type="button" data-action="change-payment-card">Cambiar tarjeta de pago</button>';
    if (state.cancelConfirm && !canceled) {
        const inflight = ['pending', 'dispatched', 'unknown'].includes(a.initialPayment) || ['pending', 'dispatched', 'unknown'].includes(a.latestPayment?.state);
        html += `<div class="account-cancel-confirmation"><h2>¿Cancelar ${paid ? 'la suscripción' : 'la autorización'}?</h2><p>${end ? 'Conservas el acceso hasta ' + date(end) + '. No habrá más renovaciones.' : paid ? 'Conservas tu periodo pagado. No habrá renovaciones.' : 'No se programarán nuevos cobros.'}${inflight ? ' El pago en curso aún puede completarse.' : ''} Esto no solicita un reembolso.</p>`
            + button('Sí, cancelar', 'confirm-cancel', true)
            + '<button type="button" class="account-text-button" data-action="keep-authorization">Volver</button></div>';
    } else html += `<div class="account-inline-actions">${canceled ? '<a class="account-text-button" href="/soporte/">Necesito ayuda</a>' : `<button class="account-text-button account-cancel" type="button" data-action="cancel-authorization">Cancelar ${paid ? 'suscripción' : 'autorización'}</button>`}<button class="account-text-button" type="button" data-action="signout">Cerrar sesión</button></div>`;
    html += '</div>';
    if (complete || needsPayment) html += '</div>';
    return html;
}
async function prepareAuthorization() {
    const generation = state.generation;
    const [catalog, terms] = await Promise.all([state.auth.subscription('catalog'), state.auth.subscription('acceptance')]);
    const acceptance = recurringAcceptance(terms);
    const validatedCatalog = recurringCatalog(catalog, billingEnvironment());
    if (generation !== state.generation) return;
    state.catalog = validatedCatalog;
    state.acceptance = acceptance;
    state.consent = false; state.providerTerms = false; state.personalData = false;
    state.sourceFailed = false; state.authPolls = 0;
    go('pago');
}
async function prepareReplacement() {
    const a = state.agreement;
    if (!a || a.canceledAt || a.sourceState !== 'available') return;
    state.replacing = true; state.sourceChangeId = null;
    await prepareAuthorization();
}
async function replaceSource() {
    if (!state.replacing || !canPay()) return;
    const a = state.agreement, generation = state.generation;
    prepareWompi ||= createHostedWompi(billingEnvironment());
    const open = await prepareWompi.tokenize(state.catalog.publicKey);
    if (generation !== state.generation) return;
    const acceptance = state.acceptance;
    state.sourceChangeId ||= crypto.randomUUID();
    const changeId = state.sourceChangeId;
    go('proveedor');
    const widgetGeneration = state.generation;
    open(token => {
        if (widgetGeneration !== state.generation) return;
        void task(async () => {
            try {
                const result = await state.auth.subscription('replace-source', { id: a.id, changeId, token,
                    acceptanceToken: acceptance.presigned_acceptance.acceptance_token,
                    personalDataToken: acceptance.presigned_personal_data_auth.acceptance_token,
                    acceptedProviderTerms: true, acceptedPersonalData: true, acceptedRenewal: true });
                if (widgetGeneration === state.generation) applyReplacement(result);
            } catch { if (widgetGeneration === state.generation) await readAccess(); }
        });
    });
}
function applyReplacement(result) {
    restoreAgreement(result.agreement);
    state.replacing = false;
    go('proveedor');
    if (state.agreement.sourceChange?.state === 'verifying' && !state.agreement.canceledAt) {
        mountAuthentication(panel.querySelector('#bank-authentication'), result.authentication);
        state.authPolls = (state.authPolls || 0) + 1;
        if (state.authPolls < 60) {
            const generation = state.generation;
            paymentTimer = setTimeout(() => { if (generation === state.generation) void task(refreshAuthorization); }, 2000);
        }
    }
}
async function startAuthorization() {
    if (!recurring() || !canPay()) return;
    const generation = state.generation;
    prepareWompi ||= createHostedWompi(billingEnvironment());
    // Load the provider before creating an agreement, so a blocked script is
    // recoverable without a half-created authorization.
    const open = await prepareWompi.tokenize(state.catalog.publicKey);
    if (generation !== state.generation) return;
    if (!state.agreement) {
        const product = state.catalog.products.find(p => p.plan_code === state.planId);
        const delivery = state.hasCard ? {} : Object.fromEntries(['name', 'phone', 'department', 'city', 'address', 'detail'].map(k => [k, String(state.delivery[k] || '').trim()]));
        if (delivery.phone) delivery.phone = delivery.phone.replace(/[\s()-]/g, '');
        state.creationId ||= crypto.randomUUID();
        try {
            const result = await state.auth.subscription('create', { id: state.creationId, productId: product.product_id,
                useTrial: state.useTrial, hasCard: state.hasCard, delivery, termsVersion: product.terms_version, acceptedRenewal: true });
            if (generation !== state.generation) return;
            restoreAgreement(result.agreement);
        } catch {
            // A lost response may already have created the agreement. Re-read
            // ownership before permitting any new setup or changed selection.
            if (generation === state.generation) await readAccess();
            return;
        }
    }
    if (state.agreement.sourceState !== 'new') return go('proveedor');
    const acceptance = state.acceptance;
    const id = state.agreement.id;
    go('proveedor');
    const widgetGeneration = state.generation;
    open(token => {
        if (widgetGeneration !== state.generation) return;
        void task(async () => {
            try {
                const result = await state.auth.subscription('source', { id, token,
                    acceptanceToken: acceptance.presigned_acceptance.acceptance_token,
                    personalDataToken: acceptance.presigned_personal_data_auth.acceptance_token,
                    acceptedProviderTerms: true, acceptedPersonalData: true });
                if (widgetGeneration !== state.generation) return;
                applySource(result);
            } catch {
                if (widgetGeneration === state.generation) await readAccess();
            }
        });
    });
}
function applySource(result) {
    const previousSourceState = state.agreement?.sourceState;
    restoreAgreement(result.agreement);
    state.sourceFailed = result.sourceFailed === true;
    // Preserve a running bank iframe across polls. Replacing it would reset 3DS.
    if (previousSourceState !== state.agreement.sourceState || state.agreement.sourceState !== 'verifying' || state.sourceFailed || !panel.querySelector('#bank-authentication')) go('proveedor');
    if (state.agreement.sourceState === 'verifying' && !state.sourceFailed) {
        mountAuthentication(panel.querySelector('#bank-authentication'), result.authentication);
        state.authPolls = (state.authPolls || 0) + 1;
        if (state.authPolls < 60) {
            const generation = state.generation;
            clearTimeout(paymentTimer);
            paymentTimer = setTimeout(() => { if (generation === state.generation) void task(refreshAuthorization); }, 2000);
        }
    }
}
async function refreshAuthorization() {
    const generation = state.generation;
    const a = state.agreement;
    if (!a) return;
    if (a.canceledAt) return readAccess();
    if (a.sourceChange?.state === 'verifying') {
        const result = await state.auth.subscription('verify-replacement', { id: a.id });
        if (generation === state.generation) applyReplacement(result);
    } else if (a.sourceState === 'verifying') {
        const result = await state.auth.subscription('verify-source', { id: a.id });
        if (generation === state.generation) applySource(result);
    } else if (['pending', 'dispatched', 'unknown'].includes(a.latestPayment?.state)) {
        const result = await state.auth.subscription('refresh-payment', { id: a.id });
        if (generation === state.generation) { restoreAgreement(result.agreement); go('proveedor'); }
    } else if (['pending', 'dispatched', 'unknown'].includes(a.initialPayment)) {
        await chargeInitial(); // Server only reconciles this already-reserved charge.
    } else await readAccess();
}
async function chargeInitial() {
    const generation = state.generation;
    const a = state.agreement;
    if (!a || a.sourceState !== 'available' || a.canceledAt || state.sourceFailed) return;
    const result = await state.auth.subscription('pay', { id: a.id });
    if (generation !== state.generation) return;
    restoreAgreement(result.agreement);
    go('proveedor');
    if (state.agreement.initialPayment === 'pending') {
        state.paymentPolls = (state.paymentPolls || 0) + 1;
        if (state.paymentPolls >= 24) return;
        const next = state.generation;
        paymentTimer = setTimeout(() => { if (next === state.generation) void task(refreshAuthorization); }, 2500);
    }
}
async function retryPayment() {
    const a = state.agreement, generation = state.generation;
    if (!a?.canRetryPayment || a.canceledAt || a.latestPayment?.state !== 'declined') return;
    try {
        const result = await state.auth.subscription('retry-payment', { id: a.id, failedPaymentId: a.latestPayment.id, acceptedPayment: true });
        if (generation === state.generation) { restoreAgreement(result.agreement); go('proveedor'); }
    } catch { if (generation === state.generation) await readAccess(); }
}
async function cancelAuthorization() {
    const generation = state.generation;
    const result = await state.auth.subscription('cancel', { id: state.agreement.id });
    if (generation !== state.generation) return;
    restoreAgreement(result.agreement); state.cancelConfirm = false;
    go('proveedor');
    if (result.paymentInFlight) error('La autorización está cancelada, pero hay un pago en proceso. Consulta a soporte antes de intentar otro.');
}
panel.addEventListener('input', e => {
    e.target.removeAttribute('aria-invalid');
    if (e.target.name === 'email') state.email = e.target.value;
    if (['name', 'phone', 'department', 'city', 'address', 'detail'].includes(e.target.name)) state.delivery[e.target.name] = e.target.value;
});
panel.addEventListener('change', e => {
    if (e.target.name === 'department') { state.delivery.department = e.target.value; e.target.removeAttribute('aria-invalid'); }
    if (e.target.name === 'plan' && PREVIEW_PLANS.some(plan => plan.id === e.target.value)) {
        state.planId = e.target.value;
        state.consent = false;
        updatePlanPricing();
    }
    if (e.target.id === 'trial-choice') { state.useTrial = !state.hasCard && e.target.checked; state.consent = false; updatePlanPricing(); }
    if (e.target.name === 'card') {
        state.hasCard = e.target.value === 'existing';
        if (state.hasCard) state.useTrial = false;
        state.consent = false;
        render();
    }
    if (e.target.id === 'renewal-consent') { state.consent = e.target.checked; panel.querySelector('[data-action=pay], [data-action=replace-source]').disabled = !canPay(); }
    if (['provider-terms', 'personal-data'].includes(e.target.id)) {
        state[e.target.id === 'provider-terms' ? 'providerTerms' : 'personalData'] = e.target.checked;
        panel.querySelector('[data-action=pay], [data-action=replace-source]').disabled = !canPay();
    }
});
panel.addEventListener('submit', e => {
    e.preventDefault();
    if (state.busy) return;
    const form = e.target;
    if (form.id === 'email-form') {
        state.email = normalizeEmail(form.elements.email.value);
        if (!validEmail(state.email)) return error('Escribe un correo válido, por ejemplo, tu@correo.com.', form.elements.email);
        void task(async () => {
            if (!review) { if (!state.auth) throw Error('unavailable'); await state.auth.sendCode(state.email, !state.returning); }
            state.resendAt = Date.now() + 60000;
            go('codigo');
        }, 'No pudimos enviar el código. Comprueba el correo e inténtalo de nuevo. Si usas Apple en la app, entra con Apple aquí.');
    } else if (form.id === 'code-form') {
        const code = form.elements.code.value.trim();
        if (!validCode(code)) return error('Escribe el código completo de tu correo.', form.elements.code);
        void task(async () => {
            if (review) return go('plan');
            await state.auth.verifyCode(state.email, code);
            await readAccess();
        }, 'El código no es válido o venció. Solicita uno nuevo.');
    } else if (form.id === 'delivery-form') {
        if (!review && !checkoutEnabled()) return;
        if (!state.hasCard) {
            state.delivery.department = form.elements.department.value;
            if (!state.delivery.department) return error('Selecciona tu departamento.', form.elements.department);
        }
        if (!state.hasCard && !validDelivery(state.delivery)) {
            return error('Completa la dirección y un celular colombiano de 10 dígitos que empiece por 3.', form.querySelector('input:invalid') || form.elements.phone);
        }
        state.consent = false;
        if (review) return go('pago');
        if (recurring()) return void task(prepareAuthorization, 'No pudimos cargar las condiciones de Wompi. Intenta de nuevo; no se ha iniciado un cobro.');
        if (state.hasCard && state.useTrial) return error('La prueba solo aplica al solicitar una tarjeta nueva.');
        void task(async () => {
            const generation = state.generation;
            const result = await state.auth.checkout('quote', { planId: state.planId, useTrial: state.useTrial, hasCard: state.hasCard, delivery: state.delivery });
            if (generation !== state.generation) return;
            restoreCheckout(result); go('pago');
        }, 'No pudimos guardar el resumen. Comprueba los datos y tu conexión; no se ha iniciado un pago.');
    }
});
panel.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action || state.busy) return;
    if (action === 'apple') {
        if (review) { state.email = 'cuenta-apple@ejemplo.com'; go('plan'); }
        else void task(() => state.auth.apple(), 'No pudimos conectar con Apple. Inténtalo de nuevo.');
    } else if (action === 'returning') { state.returning = !state.returning; render(); }
    else if (action === 'change-email') go('cuenta');
    else if (action === 'resend' && Date.now() >= state.resendAt) void task(async () => {
        if (!review) await state.auth.sendCode(state.email, !state.returning);
        state.resendAt = Date.now() + 60000;
        go('codigo');
    }, 'Espera un momento antes de pedir otro código.');
    else if (action === 'signout') void task(async () => {
        if (!review) await state.auth?.signOut();
        clearAccount();
    });
    else if (action === 'retry') { if (review) go('plan'); else void task(readAccess); }
    else if (recurring()) {
        if (['delivery', 'plan'].includes(action) && state.agreement) {
            go('proveedor');
            error('Cancela esta autorización antes de cambiar el plan o la entrega.');
            return;
        }
        if (action === 'delivery') { state.consent = false; go('envio'); }
        if (action === 'plan') { state.consent = false; go('plan'); }
        if (action === 'pay' && canPay()) void task(startAuthorization, 'No pudimos completar la autorización. Consulta el estado antes de intentar de nuevo.');
        if (action === 'change-payment-card') void task(prepareReplacement);
        if (action === 'replace-source' && canPay()) void task(replaceSource);
        if (action === 'back-to-subscription') { state.replacing = false; go('proveedor'); }
        if (action === 'authorize-again') void task(prepareAuthorization);
        if (action === 'refresh-authorization') void task(refreshAuthorization);
        if (action === 'retry-payment') void task(retryPayment);
        if (action === 'charge-initial') void task(chargeInitial);
        if (action === 'cancel-authorization') { state.cancelConfirm = true; render(); }
        if (action === 'keep-authorization') { state.cancelConfirm = false; render(); }
        if (action === 'confirm-cancel') void task(cancelAuthorization);
    } else if (sandbox()) {
        if (action === 'delivery') { state.consent = false; go('envio'); }
        if (action === 'plan') { state.consent = false; go('plan'); }
        if (action === 'verify-payment') void task(verifyPayment);
        if (action === 'resume-payment') void task(async () => openSandboxPayment());
        if (action === 'pay' && canPay()) void task(async () => {
            const generation = state.generation;
            const result = await state.auth.checkout('start', { quoteId: state.checkout.id, accepted: true, termsVersion: state.checkout.termsVersion });
            if (generation !== state.generation) return;
            restoreCheckout(result);
            if (result.checkout.state === 'approved') return go('confirmacion');
            await openSandboxPayment();
        }, 'No pudimos abrir Wompi. Recarga tu cuenta para retomar el mismo intento; no hagas otro pago.');
    }
    else if (review) {
        if (action === 'delivery') go('envio');
        if (action === 'plan') go('plan');
        if (action === 'payment') go('pago');
        if (action === 'success') go('confirmacion');
        if (action === 'pay' && state.consent) go('proveedor');
        if (action === 'declined') go('error');
        if (action === 'approved') {
            go('procesando');
            const generation = state.generation;
            paymentTimer = setTimeout(() => { if (state.generation === generation) go('confirmacion'); }, 1800);
        }
    }
});

async function init() {
    if (review) {
        const params = new URL(location.href).searchParams;
        const fixture = billingReviewFixture(params.get('escenario'));
        if (fixture) Object.assign(state, fixture);
        if (['monthly','quarterly','annual'].includes(params.get('plan'))) state.planId=params.get('plan');
        if (params.get('trial')==='true') state.useTrial=true;
        if (params.get('tarjeta')==='existing') {state.hasCard=true;state.useTrial=false;}
        const view = fixture?.view || params.get('vista');
        go(REVIEW_VIEWS.has(view) ? view : 'cuenta', false);
    } else {
        const params = new URL(location.href).searchParams;
        const code = params.get('code');
        const paymentId = params.get('id');
        if (paymentId && /^[A-Za-z0-9-]{1,100}$/.test(paymentId)) state.returnedPayment = paymentId;
        const oauthError = params.has('error') || new URLSearchParams(location.hash.slice(1)).has('error');
        // Remove callback codes/error details before loading anything else.
        if (location.search || location.hash) history.replaceState(null, '', location.pathname);
        try {
            const response = await fetch('/api/foco/account?action=config', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
            if (!response.ok) throw Error('unavailable');
            state.config = await response.json();
            if (state.config.enabled) {
                state.auth = createAccountAuth(state.config);
                state.auth.onSignedOut(clearAccount);
                if (oauthError) throw Error('oauth_failed');
                if (code) await state.auth.exchange(code);
                await readAccess();
            } else go('cuenta', false);
        } catch {
            if (!state.auth) state.config = { enabled: false, appleEnabled: false };
            go('cuenta', false);
            error(state.auth ? 'No se completó el inicio de sesión. Intenta de nuevo con Apple o tu correo.' : 'No pudimos abrir el acceso web. Tu cuenta en la app no cambia. Intenta de nuevo más tarde.');
        }
    }
    cooldownTimer = setInterval(updateCooldown, 1000);
}
window.addEventListener('pagehide', () => { state.generation++; clearInterval(cooldownTimer); clearTimeout(paymentTimer); panel.querySelector('#bank-authentication')?.replaceChildren(); });
window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    cooldownTimer = setInterval(updateCooldown, 1000);
    if (!review && state.auth) void task(readAccess);
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || review || !state.auth || state.busy) return;
    // Pick up NFC activation or cancellation performed in the app. Leave an
    // unfinished form or bank authentication in place when switching apps.
    const completedAgreement = state.view === 'proveedor' && state.agreement?.initialPayment === 'approved'
        && !state.replacing && !['dispatched', 'verifying', 'unknown'].includes(state.agreement.sourceChange?.state);
    if (completedAgreement || ['vitalicio', 'activo', 'pendiente'].includes(state.view)) void task(readAccess);
});
void init();
