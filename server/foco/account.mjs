import { accountAccess, accountBilling, accountAccessV2 } from './account-status.mjs';
import { hostedSubscriptionConfig, billingPath } from './subscription.mjs';
const backend = 'https://foco-backend.vercel.app';
const reply = (data, status = 200) => Response.json(data, { status, headers: {
    'cache-control': 'private, no-store', 'vary': 'Authorization',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
} });
export function publicAccountConfig(env) {
    const enabled = env.FOCO_WEB_ACCOUNT_ENABLED === 'true'
        && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.FOCO_AUTH_URL || '')
        && /^sb_publishable_[A-Za-z0-9_-]+$/.test(env.FOCO_AUTH_PUBLISHABLE_KEY || '');
    return enabled ? {
        enabled: true, supabaseUrl: env.FOCO_AUTH_URL, publishableKey: env.FOCO_AUTH_PUBLISHABLE_KEY,
        appleEnabled: env.FOCO_WEB_APPLE_ENABLED === 'true', checkoutEnabled: false,
        ...(hostedSubscriptionConfig(env).enabled ? { recurringCheckout: hostedSubscriptionConfig(env) } : {}),
    } : { enabled: false, appleEnabled: false, checkoutEnabled: false };
}
export async function handleAccount(request, env = process.env, fetcher = fetch) {
    if (request.method !== 'GET') return reply({ error: 'method_not_allowed' }, 405);
    const action = new URL(request.url).searchParams.get('action');
    if (action === 'config') return reply(publicAccountConfig(env));
    if (action !== 'status') return reply({ error: 'not_found' }, 404);
    if (!publicAccountConfig(env).enabled) return reply({ error: 'account_not_enabled' }, 503);
    const authorization = request.headers.get('authorization');
    if (!/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(authorization || '')) return reply({ error: 'unauthorized' }, 401);
    try {
        // No user ID/email is accepted. The existing API resolves its own user.
        const options = {
            headers: { authorization, accept: 'application/json' }, redirect: 'error',
            cache: 'no-store', signal: AbortSignal.timeout(10000),
        };
        const response = await fetcher(`${backend}/api/v1/access`, options);
        if (response.status === 401) return reply({ error: 'unauthorized' }, 401);
        if (!response.ok) return reply({ error: 'access_unavailable' }, 503);
        const access = accountAccess(await response.json());
        const pending = { access, subscriptions: [], needsBillingReview: false, checkoutEnabled: false, billingReady: false };
        // Lifetime access never depends on the new subscription tables or rollout.
        if (access.entitlement === 'lifetime') return reply(pending);
        // Enable with the backend's complete v2 reader after both migrations.
        const unified = env.FOCO_WEB_ACCOUNT_ACCESS_V2 === 'true';
        const environment = hostedSubscriptionConfig(env).environment || 'production';
        const billing = await fetcher(unified ? billingPath(env, '/api/v2/access') : `${backend}/api/v1/billing`, options);
        if (billing.status === 401) return reply({ error: 'unauthorized' }, 401);
        // An undeployed/disabled ledger is unknown, not proof of no subscription.
        if (billing.status === 404) return reply(pending);
        if (!billing.ok) return reply({ error: 'access_unavailable' }, 503);
        const result = await billing.json();
        if (!unified && result.rollout === 'disabled') return reply(pending);
        return reply(unified ? accountAccessV2(result, environment) : accountBilling(result));
    } catch { return reply({ error: 'access_unavailable' }, 503); }
}
