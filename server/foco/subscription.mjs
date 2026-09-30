import { publicAccountConfig } from './account.mjs';

export const BILLING_BACKEND = 'https://foco-backend.vercel.app';
const readActions = new Set(['status', 'catalog', 'acceptance']);
const writeActions = new Set(['create', 'source', 'verify-source', 'replace-source', 'verify-replacement',
    'retry-payment', 'refresh-payment', 'pay', 'cancel']);
export function hostedSubscriptionConfig(env) {
    const environment = env.FOCO_WEB_SUBSCRIPTION_MODE;
    const enabled = (environment === 'sandbox' && env.FOCO_WEB_SANDBOX_APPROVED === 'true')
        || (environment === 'production' && env.FOCO_WEB_SUBSCRIPTION_LIVE_APPROVED === 'true');
    if (!enabled) return { enabled: false };
    return { enabled: true, environment };
}
export function billingPath(env, path) {
    return `${BILLING_BACKEND}${hostedSubscriptionConfig(env).environment === 'sandbox' ? '/billing-sandbox' : ''}${path}`;
}
export function webOrigin(env) {
    const value = env.FOCO_WEB_ORIGIN || 'https://getfoco.co';
    const url = new URL(value);
    if (url.origin !== value || url.protocol !== 'https:' || url.username || url.password
        || !(url.hostname === 'getfoco.co' || /^getfoco-[a-z0-9-]+\.vercel\.app$/.test(url.hostname))) throw Error('invalid_origin');
    return value;
}
const reply = (data, status = 200) => Response.json(data, { status, headers: {
    'cache-control': 'private, no-store', vary: 'Authorization', 'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
} });
async function body(request) {
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw Object.assign(Error(), { status: 415 });
    const reader = request.body?.getReader();
    if (!reader) throw Object.assign(Error(), { status: 400 });
    const chunks = []; let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 24000) { await reader.cancel(); throw Object.assign(Error(), { status: 413 }); }
        chunks.push(Buffer.from(value));
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    try { JSON.parse(raw); } catch { throw Object.assign(Error(), { status: 400 }); }
    return raw;
}

// Bearer authentication is verified again by the billing backend. No browser
// parameter selects a provider, backend, account identity or billing environment.
export async function handleHostedSubscription(request, env = process.env, fetcher = fetch) {
    try {
        if (!publicAccountConfig(env).enabled || !hostedSubscriptionConfig(env).enabled)
            return reply({ error: { code: 'checkout_disabled' } }, 404);
        const action = new URL(request.url).searchParams.get('action');
        if (!(readActions.has(action) || writeActions.has(action))) return reply({ error: { code: 'not_found' } }, 404);
        const read = readActions.has(action);
        if (request.method !== (read ? 'GET' : 'POST')) return reply({ error: { code: 'method_not_allowed' } }, 405);
        if (!read && request.headers.get('origin') !== webOrigin(env)) return reply({ error: { code: 'origin_not_allowed' } }, 403);
        const authorization = request.headers.get('authorization');
        if (!/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(authorization || '')) return reply({ error: { code: 'unauthorized' } }, 401);
        const payload = read ? undefined : await body(request);
        const response = await fetcher(`${billingPath(env, '/api/v1/subscription')}?action=${action}`, {
            method: request.method, body: payload, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000),
            // The validated same-origin website acts as the backend's web client.
            headers: { authorization, accept: 'application/json', ...(!read ? { 'content-type': 'application/json', origin: 'https://getfoco.co' } : {}) },
        });
        const result = await response.json();
        return reply(result, response.status);
    } catch (error) {
        // A timeout can follow a successful provider mutation. Never retry a POST
        // here; the saved agreement/charge is reconciled by the next status read.
        return reply({ error: { code: error.status ? 'invalid_request' : 'billing_unavailable' } }, error.status || 503);
    }
}
