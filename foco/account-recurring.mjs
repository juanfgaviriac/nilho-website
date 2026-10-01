import { SUBSCRIPTION_POLICY_VERSION } from './subscription-policy.mjs';
import { PREVIEW_PLANS, previewTotals } from './account-flow.mjs';

export function resumableAgreement(rows, checkedAt = new Date().toISOString()) {
    const now = Date.parse(checkedAt);
    if (!Number.isFinite(now)) throw Error('invalid_clock');
    return rows.find(a => !a.canceledAt && a.state !== 'revoked')
        ?? rows.find(a => a.state !== 'revoked' && a.initialPayment === 'approved' && !a.useTrial && !a.hasCard && !a.periodEndsAt)
        ?? rows.find(a => a.state !== 'revoked' && [a.periodEndsAt, a.trialEndsAt]
            .some(end => typeof end === 'string' && Date.parse(end) > now));
}

export function recurringCatalog(value, environment = 'sandbox') {
    if (!['sandbox', 'production'].includes(environment) || value?.environment !== environment
        || !new RegExp(`^pub_${environment === 'production' ? 'prod' : 'test'}_[A-Za-z0-9]+$`).test(value.publicKey || '')
        || !Array.isArray(value.products) || value.products.length !== PREVIEW_PLANS.length) throw Error('invalid_catalog');
    for (const plan of PREVIEW_PLANS) {
        const rows = value.products.filter(p => p.plan_code === plan.id);
        const p = rows[0];
        if (rows.length !== 1 || p.amount_in_cents !== plan.amount * 100 || p.interval_months !== plan.months
            || p.currency !== 'COP' || p.trial_days !== 7 || p.shipping_in_cents !== 1000000
            || p.terms_version !== SUBSCRIPTION_POLICY_VERSION || !p.product_id) throw Error('catalog_changed');
    }
    return value;
}

export function recurringAgreement(row, environment = 'sandbox') {
    const plan = PREVIEW_PLANS.find(p => p.id === row?.plan);
    if (!plan || !['sandbox', 'production'].includes(environment) || row.environment !== environment || !/^[a-f\d-]{36}$/i.test(row.id || '')
        || typeof row.useTrial !== 'boolean' || typeof row.hasCard !== 'boolean'
        || (environment === 'sandbox' ? row.accessUntil !== null : row.accessUntil !== null && !Number.isFinite(Date.parse(row.accessUntil))) || row.amountInCents !== plan.amount * 100
        || row.initialInCents !== previewTotals(row.hasCard, plan.id, row.useTrial).today * 100
        || !['setup', 'awaiting_payment', 'awaiting_card', 'trialing', 'active', 'past_due', 'canceled', 'revoked'].includes(row.state)
        || !['new', 'dispatched', 'verifying', 'available', 'unknown'].includes(row.sourceState)
        || ![null, 'queued', 'dispatched', 'pending', 'unknown', 'approved', 'declined', 'voided', 'canceled'].includes(row.initialPayment)) throw Error('invalid_agreement');
    if (row.sourceChange != null && (!/^[a-f\d-]{36}$/i.test(row.sourceChange.id || '')
        || !['dispatched', 'verifying', 'available', 'failed', 'unknown'].includes(row.sourceChange.state))) throw Error('invalid_source_change');
    if (row.latestPayment != null && (!/^[a-f\d-]{36}$/i.test(row.latestPayment.id || '')
        || ![ 'queued', 'dispatched', 'pending', 'unknown', 'approved', 'declined', 'voided', 'canceled'].includes(row.latestPayment.state)
        || !Number.isSafeInteger(row.latestPayment.amountInCents) || row.latestPayment.amountInCents <= 0)) throw Error('invalid_payment');
    if (row.canRetryPayment != null && typeof row.canRetryPayment !== 'boolean') throw Error('invalid_payment');
    return row;
}

export function recurringAcceptance(value) {
    for (const item of [value?.presigned_acceptance, value?.presigned_personal_data_auth]) {
        const url = new URL(item?.permalink || '');
        if (url.protocol !== 'https:' || url.username || url.password
            || !['wompi.co', 'www.wompi.co', 'wompi.com', 'www.wompi.com'].includes(url.hostname)
            || typeof item.acceptance_token !== 'string' || !item.acceptance_token || item.acceptance_token.length > 8192) throw Error('invalid_acceptance');
    }
    return value;
}

// The only place provider HTML is rendered. An opaque-origin, sandboxed iframe
// cannot access Foco's session, parent DOM, local storage or top-level location.
export function mountAuthentication(container, authentication, doc = document) {
    if (!authentication) { container.replaceChildren(); return; }
    if (!['BROWSER_INFO', 'FINGERPRINT', 'CHALLENGE'].includes(authentication.step)
        || typeof authentication.html !== 'string' || authentication.html.length > 131072) throw Error('invalid_authentication');
    const existing = container.firstElementChild;
    if (existing?.dataset.step === authentication.step && existing._providerHTML === authentication.html) return;
    const iframe = doc.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts allow-forms');
    iframe.referrerPolicy = 'no-referrer';
    iframe.title = 'Verificación segura de tu banco';
    iframe.className = authentication.step === 'CHALLENGE' ? 'account-bank-challenge' : 'account-bank-fingerprint';
    if (authentication.step !== 'CHALLENGE') { iframe.tabIndex = -1; iframe.setAttribute('aria-hidden', 'true'); }
    let html = authentication.html;
    if (/^\s*&lt;/i.test(html)) {
        // textContent + textarea decoding avoids executing any provider markup
        // in the parent document, including malformed closing tags.
        const decoder = doc.createElement('textarea');
        decoder.innerHTML = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = decoder.value;
    }
    iframe.dataset.step = authentication.step;
    iframe._providerHTML = authentication.html;
    iframe.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src https: data: 'unsafe-inline'; connect-src https:; form-action https:; base-uri 'none'; object-src 'none'"><meta name="referrer" content="no-referrer">${html}`;
    container.replaceChildren(iframe);
}
