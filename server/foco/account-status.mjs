const providers = new Set(['apple', 'wompi']);
const statuses = new Set(['active', 'trialing', 'grace_period', 'expired', 'billing_retry', 'revoked']);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const unavailable = () => { throw new Error('access_unavailable'); };
const accessStates = new Set(['awaiting_payment', 'awaiting_card', 'trialing', 'active', 'canceled', 'payment_attention', 'expired', 'revoked']);

export function accountAccessV2(value, environment = 'production') {
    if (value?.schemaVersion !== 2 || !['production', 'sandbox'].includes(environment) || value.environment !== environment || value.availability !== 'ready'
        || !timestamp(value.checkedAt) || value.chargingEnabled !== false || typeof value.enforcementEnabled !== 'boolean'
        || !Array.isArray(value.subscriptions) || value.subscriptions.length > 200
        || typeof value.needsBillingReview !== 'boolean'
        || !['none', 'link_card', 'complete_payment', 'review_payment', 'contact_support'].includes(value.action)
        || !['lifetime', 'unassigned', ...accessStates].includes(value.state)) return unavailable();
    const access = accountAccess(value.access, true);
    const subscriptions = value.subscriptions.map(row => {
        if (!providers.has(row?.provider) || !accessStates.has(row.state) || typeof row.plan !== 'string'
            || !row.plan || row.plan.length > 255 || typeof row.autoRenews !== 'boolean'
            || ![row.periodEndsAt, row.accessUntil, row.nextChargeAt].every(date => date === null || timestamp(date))
            || (!row.autoRenews && row.nextChargeAt !== null)
            || (row.accessUntil !== null && (Date.parse(row.accessUntil) <= Date.parse(value.checkedAt)
                || !['active', 'trialing', 'canceled', 'payment_attention'].includes(row.state)))) return unavailable();
        return { provider: row.provider, plan: row.plan, status: row.state, autoRenews: row.autoRenews,
            periodEndsAt: row.periodEndsAt, accessUntil: row.accessUntil, nextChargeAt: row.nextChargeAt };
    });
    if (access.entitlement === 'lifetime' && value.state !== 'lifetime') return unavailable();
    if (access.entitlement !== 'lifetime' && value.state === 'lifetime') return unavailable();
    if (value.state !== 'lifetime' && value.state !== (subscriptions[0]?.status ?? 'unassigned')) return unavailable();
    if (access.entitlement === 'subscription' && (!subscriptions.some(row => row.provider === access.source && row.accessUntil === access.expiresAt)
        || Date.parse(access.expiresAt) <= Date.parse(value.checkedAt))) return unavailable();
    if (access.entitlement === 'unassigned' && subscriptions.some(row => row.accessUntil !== null)) return unavailable();
    return { access, subscriptions, state: value.state, action: value.action, checkedAt: value.checkedAt,
        schemaVersion: 2, environment, needsBillingReview: value.needsBillingReview, billingReady: true, checkoutEnabled: false };
}

// Only verified backend responses enter here. Never pass through provider IDs,
// payment references, user metadata, or arbitrary management URLs to the browser.
export function accountAccess(value, allowSubscription = false) {
    if (value?.entitlement === 'lifetime' && value.expiresAt === null
        && ['existing_user', 'verified_legacy_purchase'].includes(value.source) && timestamp(value.grantedAt)) {
        return { entitlement: 'lifetime', source: value.source, grantedAt: value.grantedAt, expiresAt: null };
    }
    if (value?.entitlement === 'unassigned' && value.source === null && value.grantedAt === null && value.expiresAt === null) {
        return { entitlement: 'unassigned', source: null, grantedAt: null, expiresAt: null };
    }
    if (allowSubscription && value?.entitlement === 'subscription' && providers.has(value.source) && timestamp(value.expiresAt)) {
        return { entitlement: 'subscription', source: value.source, expiresAt: value.expiresAt };
    }
    return unavailable();
}

export function accountBilling(value) {
    if (value?.rollout !== 'shadow' || !Array.isArray(value.subscriptions) || value.subscriptions.length > 100
        || value.chargingEnabled !== false || value.enforcementEnabled !== false
        || typeof value.needsBillingReview !== 'boolean') return unavailable();
    const access = accountAccess(value.access, true);
    const subscriptions = value.subscriptions.map(row => {
        if (!providers.has(row?.provider) || !statuses.has(row.status) || typeof row.plan !== 'string'
            || !row.plan || row.plan.length > 255 || typeof row.autoRenews !== 'boolean'
            || !timestamp(row.periodEndsAt) || !(row.gracePeriodEndsAt === null || timestamp(row.gracePeriodEndsAt))) return unavailable();
        return { provider: row.provider, plan: row.plan, status: row.status, autoRenews: row.autoRenews,
            periodEndsAt: row.periodEndsAt, gracePeriodEndsAt: row.gracePeriodEndsAt };
    });
    if (access.entitlement === 'subscription' && !subscriptions.some(row => row.provider === access.source
        && ['active', 'trialing', 'grace_period'].includes(row.status)
        && (row.status === 'grace_period' ? row.gracePeriodEndsAt : row.periodEndsAt) === access.expiresAt)) return unavailable();
    return { access, subscriptions, needsBillingReview: value.needsBillingReview, billingReady: true, checkoutEnabled: false };
}
