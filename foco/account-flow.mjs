// Commercial prices confirmed; checkout still requires its separate release gate.
export const PREVIEW_OFFER = Object.freeze({ shipping: 10000, trialDays: 7, confirmed: true });
export const PREVIEW_PLANS = Object.freeze([
    Object.freeze({ id: 'monthly', label: 'Mensual', name: 'Foco mensual', amount: 14900, months: 1, period: 'mes', cadence: 'al mes' }),
    Object.freeze({ id: 'quarterly', label: '3 meses', name: 'Foco trimestral', amount: 39900, months: 3, period: '3 meses', cadence: 'cada 3 meses' }),
    Object.freeze({ id: 'annual', label: 'Anual', name: 'Foco anual', amount: 119900, months: 12, period: 'año', cadence: 'al año' }),
]);
export function previewPlan(id) {
    const plan = PREVIEW_PLANS.find(plan => plan.id === id);
    if (!plan) throw new Error('unknown_preview_plan');
    return plan;
}
export function previewPlanSavings(id) {
    const plan = previewPlan(id);
    const monthlyTotal = previewPlan('monthly').amount * plan.months;
    return {
        monthlyEquivalent: plan.amount / plan.months,
        percent: Math.round((monthlyTotal - plan.amount) / monthlyTotal * 100),
    };
}
export const REVIEW_STEPS = Object.freeze([
    ['cuenta', '01 · Tu cuenta'], ['codigo', '02 · Código de acceso'],
    ['plan', '03 · Tu plan'], ['envio', '04 · Tu tarjeta'],
    ['pago', '05 · Revisa y confirma'], ['proveedor', '06 · Paso por Wompi'],
    ['procesando', '07 · Verificando el pago'], ['confirmacion', '08 · Todo listo'], ['vitalicio', 'Acceso de por vida'],
    ['activo', 'Suscripción existente'], ['pendiente', 'Cuenta conectada'], ['error', 'Pago no aprobado'],
    ['codigo-error', 'Código vencido'], ['sinconexion', 'No pudimos verificar'],
    ['autorizacion', 'Autorización confirmada'],
]);
export const REVIEW_VIEWS = new Set(REVIEW_STEPS.map(([value]) => value));
export function isLocalReview(location, enabled) {
    return enabled === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
        && location.pathname === '/revision/suscripcion/';
}
export function accountDestination(result) {
    if (!result || !result.access) throw new Error('access_unavailable');
    if (result.access.entitlement === 'lifetime' && result.access.expiresAt === null) return 'vitalicio';
    if (!['subscription', 'unassigned'].includes(result.access.entitlement)) throw new Error('access_unavailable');
    if (result.billingReady !== true) return 'pendiente';
    if (!Array.isArray(result.subscriptions) || typeof result.needsBillingReview !== 'boolean') throw new Error('access_unavailable');
    // Resume or manage any existing agreement, including one awaiting a card.
    if (result.schemaVersion === 2 && result.subscriptions.length) return 'activo';
    if (result.access.entitlement === 'subscription' || result.needsBillingReview
        || result.subscriptions.some(row => row.autoRenews || ['active', 'trialing', 'grace_period', 'billing_retry'].includes(row.status))) return 'activo';
    if (result.access.entitlement === 'unassigned') return 'plan';
    throw new Error('access_unavailable');
}
export function subscriptionPresentation(row) {
    const provider = { apple: 'Apple', wompi: 'Foco · Wompi' }[row.provider];
    const status = { active: 'Activa', trialing: 'En prueba', grace_period: 'Revisar pago', expired: 'Finalizada', billing_retry: 'Revisar pago', revoked: 'Revocada', awaiting_payment: 'Autorización pendiente', awaiting_card: 'Vincula tu tarjeta', canceled: 'Renovación cancelada', payment_attention: 'Revisar pago' }[row.status];
    if (!provider || !status) throw new Error('access_unavailable');
    const plans = { monthly: 'Foco mensual', quarterly: 'Foco trimestral', annual: 'Foco anual' };
    return { provider, status, plan: Object.hasOwn(plans, row.plan) ? plans[row.plan] : 'Suscripción Foco' };
}
export function normalizeEmail(value) { return String(value).trim(); }
export function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
export function validCode(value) { return /^\d{6,8}$/.test(value); }
export function validDelivery(data) {
    return data.name?.trim().length >= 2 && /^3\d{9}$/.test(String(data.phone).replace(/[\s()-]/g, ''))
        && data.city?.trim().length >= 2 && data.department?.trim().length >= 2 && data.address?.trim().length >= 5;
}
export function previewTotals(hasCard, planId = 'monthly', useTrial = false, offer = PREVIEW_OFFER) {
    if (hasCard && useTrial) throw new Error('trial_requires_requested_card');
    const plan = previewPlan(planId);
    const shipping = hasCard || (!useTrial && plan.months > 1) ? 0 : offer.shipping;
    const subscription = useTrial ? 0 : plan.amount;
    return { today: shipping + subscription, shipping, subscription, renewal: plan.amount, trialDays: useTrial ? offer.trialDays : 0 };
}
export function escapeHTML(value = '') {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
