import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAccount } from '../server/foco/account.mjs';
import { accountDestination, subscriptionPresentation } from '../foco/account-flow.mjs';

const env = { FOCO_WEB_ACCOUNT_ACCESS_V2: 'true', FOCO_WEB_ACCOUNT_ENABLED: 'true', FOCO_AUTH_URL: 'https://test.supabase.co', FOCO_AUTH_PUBLISHABLE_KEY: 'sb_publishable_fixture' };
const authorization = 'Bearer fixture-valid-session-token';
const request = () => new Request('https://getfoco.co/api/foco/account?action=status&userId=victim', { headers: { authorization } });
const unassigned = { entitlement: 'unassigned', source: null, grantedAt: null, expiresAt: null };
const lifetime = { entitlement: 'lifetime', source: 'existing_user', grantedAt: '2026-09-29T00:00:00Z', expiresAt: null };
const row = { provider: 'apple', plan: 'annual', state: 'active', autoRenews: true, periodEndsAt: '2099-10-01T00:00:00Z', accessUntil: '2099-10-01T00:00:00Z', nextChargeAt: '2099-10-01T00:00:00Z' };
const billing = (subscriptions = [row]) => ({ schemaVersion: 2, environment: 'production', availability: 'ready', checkedAt: '2026-09-29T00:00:00Z', state: 'active', action: 'none', chargingEnabled: false, enforcementEnabled: false, access: { entitlement: 'subscription', source: 'apple', expiresAt: row.periodEndsAt }, subscriptions, needsBillingReview: false });
const fetcher = result => async url => url.endsWith('/v1/access') ? Response.json(unassigned) : result instanceof Response ? result : Response.json(result);

test('lifetime access does not depend on an unavailable billing service', async () => {
    let calls = 0;
    const response = await handleAccount(request(), env, async () => { calls++; return Response.json(lifetime); });
    assert.equal(calls, 1);
    assert.equal(accountDestination(await response.json()), 'vitalicio');
});
test('an undeployed v2 endpoint never sends a signed-in user to buy', async () => {
    const response = await handleAccount(request(), env, fetcher(new Response('', { status: 404 })));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.billingReady, false);
    assert.equal(accountDestination(data), 'pendiente');
});
test('both providers use the shared authenticated endpoint and strip private fields', async () => {
    for (const provider of ['apple', 'wompi']) {
        const body = billing([{ ...row, provider, private_token: 'never-forward-this' }]);
        body.access.source = provider;
        const calls = [];
        const response = await handleAccount(request(), env, async (url, options) => {
            calls.push(url);
            assert.equal(options.headers.authorization, authorization);
            assert.equal(options.redirect, 'error');
            assert.ok(!url.includes('victim'));
            return Response.json(url.endsWith('/v1/access') ? unassigned : body);
        });
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(accountDestination(data), 'activo');
        assert.equal(data.subscriptions[0].provider, provider);
        assert.equal(data.checkoutEnabled, false);
        assert.ok(!JSON.stringify(data).includes('never-forward-this'));
        assert.equal(calls[1], 'https://foco-backend.vercel.app/api/v2/access');
    }
});
test('only a verified account without any agreements is classified as no subscription', async () => {
    const response = await handleAccount(request(), env, fetcher({ ...billing([]), access: unassigned, state: 'unassigned' }));
    assert.equal(accountDestination(await response.json()), 'plan');
});
test('waiting activation, incomplete authorization and canceled agreements resume management instead of duplicate checkout', async () => {
    for (const state of ['awaiting_card', 'awaiting_payment', 'payment_attention', 'expired', 'revoked']) {
        const response = await handleAccount(request(), env, fetcher({ ...billing([{ ...row, state, periodEndsAt: null, accessUntil: null, nextChargeAt: null, autoRenews: false }]), state, access: unassigned }));
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(accountDestination(data), 'activo');
        assert.equal(data.subscriptions[0].periodEndsAt, null);
    }
    const response = await handleAccount(request(), env, fetcher({ ...billing([{ ...row, state: 'canceled', autoRenews: false, nextChargeAt: null }]), state: 'canceled' }));
    assert.equal((await response.json()).access.entitlement, 'subscription');
});
test('failures and malformed contracts remain unavailable and expose no provider details', async () => {
    for (const result of [new Response('private', { status: 500 }), { ...billing(), subscriptions: null }, billing([{ ...row, provider: 'attacker' }]), billing([{ ...row, periodEndsAt: 'invalid' }]), billing([]), { ...billing(), schemaVersion: 3 }, { ...billing(), environment: 'sandbox' }, { ...billing(), availability: 'unavailable' }, { ...billing(), state: 'lifetime' }, { ...billing(), access: unassigned }]) {
        const response = await handleAccount(request(), env, fetcher(result));
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'access_unavailable' });
    }
    assert.equal((await handleAccount(request(), env, fetcher(new Response('', { status: 401 })))).status, 401);
});
test('access reads accept enforcement while still rejecting an invalid contract', async () => {
    for (const flags of [{ chargingEnabled: true }, { enforcementEnabled: 'true' }, { chargingEnabled: undefined }, { enforcementEnabled: undefined }]) {
        assert.equal((await handleAccount(request(), env, fetcher({ ...billing(), ...flags }))).status, 503);
    }
});
test('plan/provider names and pending statuses are mapped explicitly', () => {
    assert.deepEqual(subscriptionPresentation({ provider: 'wompi', plan: 'quarterly', status: 'awaiting_card' }), { provider: 'Foco · Wompi', plan: 'Foco trimestral', status: 'Vincula tu tarjeta' });
    assert.equal(subscriptionPresentation({ provider: 'apple', plan: '<script>private-id</script>', status: 'active' }).plan, 'Suscripción Foco');
    assert.equal(subscriptionPresentation({ provider: 'apple', plan: 'constructor', status: 'active' }).plan, 'Suscripción Foco');
});

test('existing local sandbox remains on its legacy reader until the explicit v2 rollout', async () => {
    const urls = [];
    const response = await handleAccount(request(), { ...env, FOCO_WEB_ACCOUNT_ACCESS_V2: 'false' }, async url => {
        urls.push(url);
        return Response.json(url.endsWith('/v1/access') ? unassigned : {
            rollout: 'shadow', chargingEnabled: false, enforcementEnabled: false,
            access: unassigned, subscriptions: [], needsBillingReview: false,
        });
    });
    assert.equal(response.status, 200);
    assert.equal(accountDestination(await response.json()), 'plan');
    assert.equal(urls[1], 'https://foco-backend.vercel.app/api/v1/billing');
});

test('an enforced paid period remains visible to the same account on the website', async () => {
    const response = await handleAccount(request(), env, fetcher({ ...billing(), enforcementEnabled: true }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).access.expiresAt, row.periodEndsAt);
});
