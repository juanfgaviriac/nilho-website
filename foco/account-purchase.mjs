import { PREVIEW_PLANS } from './account-flow.mjs';

const key = 'foco-purchase-choice-v1';
const maxAge = 24 * 60 * 60 * 1000;

// A navigation preference only. Prices, eligibility, consent and account identity
// always come from the current checkout/session, never from this stored choice.
export function purchaseChoice(value, now = Date.now()) {
    if (!value || value.version !== 1 || !PREVIEW_PLANS.some(plan => plan.id === value.planId)
        || typeof value.hasCard !== 'boolean' || typeof value.useTrial !== 'boolean'
        || (value.hasCard && value.useTrial) || !['plan', 'account'].includes(value.stage)
        || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt >= maxAge) return null;
    return { version: 1, planId: value.planId, hasCard: value.hasCard, useTrial: value.useTrial, stage: value.stage, savedAt: value.savedAt };
}

export function readPurchaseChoice(storage, now = Date.now()) {
    try {
        const choice = purchaseChoice(JSON.parse(storage.getItem(key)), now);
        if (!choice) storage.removeItem(key);
        return choice;
    } catch { clearPurchaseChoice(storage); return null; }
}

export function savePurchaseChoice(storage, state, stage, now = Date.now()) {
    const choice = purchaseChoice({ version: 1, planId: state.planId, hasCard: state.hasCard, useTrial: state.useTrial, stage, savedAt: now }, now);
    if (choice) { try { storage.setItem(key, JSON.stringify(choice)); } catch { /* Current-page flow still works without storage. */ } }
    return choice;
}

export function clearPurchaseChoice(storage) {
    try { storage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}

export function purchaseDestination(destination, choice, checkoutEnabled) {
    // Existing access and an unavailable checkout take priority over the intent.
    if (destination !== 'plan') return destination;
    if (!checkoutEnabled) return 'pendiente';
    return choice?.stage === 'account' ? 'envio' : 'plan';
}
