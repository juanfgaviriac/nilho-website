import test from 'node:test';
import assert from 'node:assert/strict';
import { readPurchaseChoice, savePurchaseChoice, clearPurchaseChoice, purchaseDestination } from '../foco/account-purchase.mjs';
import { accountPage } from '../scripts/account-pages.mjs';
import { accountDestination, previewTotals } from '../foco/account-flow.mjs';

function storage() {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
}
const selected = { planId: 'annual', useTrial: true, hasCard: false };
const now = 100000000;
test('purchase renders all plans before account creation, including before JavaScript', () => {
    const html = accountPage({ purchase: true });
    assert.match(html, /data-entry="purchase"/);
    assert.match(html, /data-view="plan"/);
    for (const plan of ['monthly', 'quarterly', 'annual']) assert.ok(html.includes(`value="${plan}"`));
    assert.doesNotMatch(html, /id="email-form"|Sin suscripciones|checkout\.js|application\/ld\+json/);
    assert.match(html, /no-referrer/);
    assert.doesNotMatch(accountPage(), /name="plan"/);
});
test('refresh and fixed Apple callback recover only a validated, tab-local plan choice', () => {
    const tab = storage();
    savePurchaseChoice(tab, { ...selected, email: 'private@example.com', delivery: { address: 'private' }, consent: true, token: 'private', price: 1, userId: 'forged' }, 'account', now);
    const restored = readPurchaseChoice(tab, now + 1);
    assert.deepEqual(restored, { version: 1, ...selected, stage: 'account', savedAt: now });
    assert.doesNotMatch([...tab.values.values()][0], /private|consent|token|price|userId/);
    assert.equal(purchaseDestination('plan', restored, true), 'envio');
    assert.equal(previewTotals(restored.hasCard, restored.planId, restored.useTrial).today, 10000);
    assert.equal(readPurchaseChoice(storage(), now), null);
});
test('editing a plan returns to selection and logout clears the pending purchase', () => {
    const tab = storage();
    savePurchaseChoice(tab, selected, 'account', now);
    savePurchaseChoice(tab, { ...selected, planId: 'quarterly', useTrial: false }, 'plan', now + 1);
    const choice = readPurchaseChoice(tab, now + 2);
    assert.equal(choice.planId, 'quarterly');
    assert.equal(choice.useTrial, false);
    assert.equal(purchaseDestination('plan', choice, true), 'plan');
    clearPurchaseChoice(tab);
    assert.equal(readPurchaseChoice(tab, now + 2), null);
});
test('expired, malformed and incompatible selections are discarded without changing checkout eligibility', () => {
    const tab = storage();
    savePurchaseChoice(tab, selected, 'account', now);
    assert.equal(readPurchaseChoice(tab, now + 86400000), null);
    assert.equal(tab.values.size, 0);
    for (const malformed of ['{', 'null', JSON.stringify({ version: 1, ...selected, planId: 'free', stage: 'account', savedAt: now }), JSON.stringify({ version: 1, ...selected, hasCard: true, stage: 'account', savedAt: now })]) {
        tab.setItem('foco-purchase-choice-v1', malformed);
        assert.equal(readPurchaseChoice(tab, now), null);
    }
    assert.equal(savePurchaseChoice(tab, selected, 'payment', now), null);
    assert.equal(readPurchaseChoice(undefined, now), null);
    assert.equal(savePurchaseChoice(undefined, selected, 'account', now).planId, 'annual');
});
test('an intent cannot bypass lifetime access, existing subscriptions, review or disabled checkout', () => {
    const choice = savePurchaseChoice(storage(), selected, 'account', now);
    const accounts = [
        [{ access: { entitlement: 'lifetime', expiresAt: null } }, 'vitalicio'],
        [{ access: { entitlement: 'unassigned' }, billingReady: false }, 'pendiente'],
        [{ access: { entitlement: 'unassigned' }, billingReady: true, schemaVersion: 2, needsBillingReview: false, subscriptions: [{ status: 'awaiting_card' }] }, 'activo'],
        [{ access: { entitlement: 'unassigned' }, billingReady: true, needsBillingReview: true, subscriptions: [] }, 'activo'],
    ];
    for (const [account, expected] of accounts) assert.equal(purchaseDestination(accountDestination(account), choice, true), expected);
    assert.equal(purchaseDestination('plan', choice, false), 'pendiente');
    assert.equal(purchaseDestination('plan', null, true), 'plan');
});
