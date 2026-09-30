import { PREVIEW_OFFER, PREVIEW_PLANS, previewPlan, previewPlanSavings, previewTotals } from './account-flow.mjs';
const money = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const heading = (title, lede) => `<h1 id="step-title" tabindex="-1">${title}</h1><p class="step-lede">${lede}</p>`;
export function renderPlanSelection(state = { planId: 'monthly', hasCard: false, useTrial: false }, { available = false, ready = false, signedIn = false } = {}) {
    const plan = previewPlan(state.planId);
    const totals = previewTotals(state.hasCard, state.planId, state.useTrial);
    const planRenewal = plan => `${state.useTrial ? 'Después de la prueba' : 'Renovación'}: ${money(plan.amount)} COP ${plan.cadence}. Puedes cancelar antes del siguiente cobro.`;
    const shippingDescription = totals => state.hasCard ? 'No necesitas envío.' : totals.shipping ? `Incluye ${money(totals.shipping)} COP de envío.` : 'Envío incluido.';
    const trialDescription = () => `Desde que vinculas tu tarjeta en la app. Solo pagas ${money(PREVIEW_OFFER.shipping)} COP de envío hoy.`;
    return heading('Más vida.<br class="account-title-break"> Menos scroll.', 'Prueba Foco a tu ritmo. Tu tarjeta incluida y todas las herramientas para volver a lo tuyo.')
            + `<fieldset class="plan-choice" aria-describedby="plan-savings-note plan-renewal"><legend>Elige tu plan</legend>${PREVIEW_PLANS.map(option => {
                const savings = previewPlanSavings(option.id);
                return `<label><input type="radio" name="plan" value="${option.id}" ${state.planId === option.id ? 'checked' : ''}><span class="plan-choice-name">${option.label}${savings.percent > 0 ? `<span class="account-badge plan-savings">Ahorras ${savings.percent}%</span>` : ''}</span><span class="plan-choice-price"><strong>${money(option.amount)}</strong><small>COP / ${option.period}</small>${option.months > 1 ? `<small class="plan-equivalent">${Number.isInteger(savings.monthlyEquivalent) ? '' : '≈ '}${money(savings.monthlyEquivalent)} COP/mes</small>` : ''}</span></label>`;
            }).join('')}</fieldset>`
            + '<p class="plan-savings-note" id="plan-savings-note">Ahorro aprox. frente al plan mensual, sin envío.</p>'
            + (!state.hasCard ? `<label class="trial-choice"><span><strong>Añadir ${PREVIEW_OFFER.trialDays} días gratis</strong><small id="trial-note">${trialDescription()}</small></span><input id="trial-choice" type="checkbox" aria-describedby="trial-note" ${state.useTrial ? 'checked' : ''}></label>` : '<p class="plan-savings-note">La prueba solo aplica al solicitar una tarjeta nueva.</p>')
            + `<div class="plan-total" aria-live="polite"><div><span>Total hoy</span><strong id="plan-today">${money(totals.today)} COP</strong></div><p id="plan-shipping">${shippingDescription(totals)}</p><p class="plan-renewal" id="plan-renewal">${planRenewal(plan)}</p></div>`
            + `<details class="account-inclusions"><summary>Qué incluye tu plan</summary><ul class="account-features">${['Tarjeta Foco incluida.', 'Todos tus modos, rutinas y estadísticas.', 'Tu acceso en la app, con la misma cuenta.'].map(text => `<li>${check}<span>${text}</span></li>`).join('')}</ul></details>`
            + (!available ? '<p class="account-notice">Los planes estarán disponibles pronto. Puedes elegir el tuyo y entrar a tu cuenta.</p>' : '')
            + '<p class="account-error" id="form-error" role="alert"></p>'
            + '<div class="account-actions"><button class="account-button" type="button" data-action="choose-plan"' + (ready ? '' : ' disabled') + '>Continuar con este plan</button></div>'
            + (signedIn ? '<div class="account-inline-actions"><button class="account-text-button" type="button" data-action="signout">Cambiar de cuenta</button></div>' : '');
}
