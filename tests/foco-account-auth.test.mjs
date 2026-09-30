import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createAccountAuth } from '../foco/account-auth.mjs';

const config = { enabled: true, appleEnabled: true, supabaseUrl: 'https://test.supabase.co', publishableKey: 'sb_publishable_fixture' };
test('recurring transport is session-bound, allowlisted, no-store and enabled on HTTPS only by server configuration', async()=>{
    const calls=[];
    const options={origin:'http://127.0.0.1:4338',storage:{},clientFactory:()=>({auth:{
        getSession:async()=>({data:{session:{access_token:'fixture-session'}},error:null})}}),
        fetcher:async(url,init)=>{calls.push({url,init});return Response.json({environment:'sandbox'});}};
    const c={...config,recurringCheckout:{enabled:true}};
    const auth=createAccountAuth(c,options);
    await auth.subscription('status');
    await auth.subscription('source',{id:'fixture',token:'tok_test_fixture'});
    assert.equal(calls[0].init.method,'GET');
    assert.equal(calls[1].url,'/api/foco/subscription?action=source');
    assert.equal(calls[1].init.headers.authorization,'Bearer fixture-session');
    assert.equal(calls[1].init.cache,'no-store');
    for(const action of ['renew','worker','https://elsewhere.invalid']) await assert.rejects(auth.subscription(action));
    await createAccountAuth(c,{...options,origin:'https://getfoco.co'}).subscription('source',{});
    await assert.rejects(createAccountAuth(config,options).subscription('status'));
    assert.equal(calls.length,3);
});
function fixture({ response = Response.json({ access: { entitlement: 'lifetime' } }), session = { access_token: 'verified-by-backend', user: { id: 'not-used-to-authorize', user_metadata: { lifetime: true } } } } = {}) {
    const calls = [];
    let handler;
    const auth = Object.fromEntries(['signInWithOtp', 'verifyOtp', 'signInWithOAuth', 'exchangeCodeForSession', 'signOut'].map(name => [name, async input => { calls.push([name, input]); return { data: {}, error: null }; }]));
    auth.getSession = async () => ({ data: { session }, error: null });
    auth.onAuthStateChange = callback => { handler = callback; return { data: { subscription: { unsubscribe() {} } } }; };
    const storage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    const instance = createAccountAuth(config, { origin: 'https://getfoco.co', storage,
        clientFactory: (...args) => { calls.push(['createClient', ...args]); return { auth }; },
        fetcher: async (...args) => { calls.push(['fetch', ...args]); return response; },
    });
    return { instance, calls, storage, emit: event => handler(event) };
}
test('web auth uses the configured app project, PKCE and tab-scoped session storage', () => {
    const { calls, storage } = fixture();
    assert.equal(calls[0][1], config.supabaseUrl);
    assert.equal(calls[0][3].auth.flowType, 'pkce');
    assert.equal(calls[0][3].auth.storage, storage);
    assert.equal(calls[0][3].auth.detectSessionInUrl, false);
});
test('email login does not create accounts implicitly and OTP is verified by Supabase', async () => {
    const { instance, calls } = fixture();
    await instance.sendCode('existing@example.test');
    await instance.sendCode('new@example.test', true);
    await instance.verifyCode('existing@example.test', '123456');
    assert.deepEqual(calls[1], ['signInWithOtp', { email: 'existing@example.test', options: { shouldCreateUser: false } }]);
    assert.equal(calls[2][1].options.shouldCreateUser, true);
    assert.deepEqual(calls[3], ['verifyOtp', { email: 'existing@example.test', token: '123456', type: 'email' }]);
});
test('Apple always returns to the fixed account callback without merging by email', async () => {
    const { instance, calls } = fixture();
    await instance.apple();
    await instance.exchange('one-time-fixture');
    assert.deepEqual(calls[1], ['signInWithOAuth', { provider: 'apple', options: { redirectTo: 'https://getfoco.co/cuenta/' } }]);
    assert.deepEqual(calls[2], ['exchangeCodeForSession', 'one-time-fixture']);
});
test('access comes only from authenticated server verification, not local metadata or email', async () => {
    const { instance, calls } = fixture({ response: Response.json({ access: { entitlement: 'unassigned' } }) });
    assert.deepEqual(await instance.status(), { access: { entitlement: 'unassigned' }, accountEmail: '' });
    const request = calls.find(call => call[0] === 'fetch');
    assert.equal(request[1], '/api/foco/account?action=status');
    assert.deepEqual(request[2].headers, { authorization: 'Bearer verified-by-backend' });
});
test('missing/expired sessions sign out locally; temporary outages retain session and fail closed', async () => {
    const none = fixture({ session: null });
    assert.equal(await none.instance.status(), null);
    assert.ok(!none.calls.some(call => call[0] === 'fetch'));
    const expired = fixture({ response: new Response('', { status: 401 }) });
    assert.equal(await expired.instance.status(), null);
    assert.deepEqual(expired.calls.at(-1), ['signOut', { scope: 'local' }]);
    const offline = fixture({ response: new Response('', { status: 503 }) });
    await assert.rejects(offline.instance.status(), /access_unavailable/);
    assert.ok(!offline.calls.some(call => call[0] === 'signOut'));
});
test('sign-out notification clears account UI without signing out the iPhone', async () => {
    const { instance, calls, emit } = fixture();
    let count = 0;
    instance.onSignedOut(() => { count++; });
    emit('TOKEN_REFRESHED');
    emit('SIGNED_OUT');
    assert.equal(count, 1);
    await instance.signOut();
    assert.deepEqual(calls.at(-1), ['signOut', { scope: 'local' }]);
});

test('Apple stays disabled until configured and rejects unsafe callback schemes', async () => {
    const options = { origin: 'https://getfoco.co', storage: {}, clientFactory: () => ({ auth: {} }) };
    const disabled = createAccountAuth({ ...config, appleEnabled: false }, options);
    await assert.rejects(disabled.apple(), /apple_not_configured/);
    for (const origin of ['http://getfoco.co', 'ftp://localhost', 'file:///tmp']) {
        assert.throws(() => createAccountAuth(config, { ...options, origin }), /auth_not_configured/);
    }
});

test('sandbox checkout transport is session-bound, same-origin and unavailable on production hosts', async () => {
    const calls = [];
    const options = {
        origin: 'http://127.0.0.1:4338', storage: {},
        clientFactory: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'session-only' } }, error: null }) } }),
        fetcher: async (url, init) => { calls.push({ url, init }); return Response.json({ checkout: null }); },
    };
    const sandboxConfig = { ...config, sandboxCheckout: { enabled: true } };
    const auth = createAccountAuth(sandboxConfig, options);
    await auth.checkout('quote', { planId: 'annual' });
    assert.equal(calls[0].url, '/api/foco/subscription-sandbox?action=quote');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.authorization, 'Bearer session-only');
    assert.equal(calls[0].init.cache, 'no-store');
    assert.deepEqual(JSON.parse(calls[0].init.body), { planId: 'annual' });
    await auth.checkout('resume');
    assert.equal(calls[1].init.method, 'GET');
    for (const origin of ['https://getfoco.co', 'https://preview.vercel.app', 'http://localhost:4338']) {
        await assert.rejects(createAccountAuth(sandboxConfig, { ...options, origin }).checkout('quote', {}), /checkout_disabled/);
    }
    await assert.rejects(createAccountAuth(config, options).checkout('quote', {}), /checkout_disabled/);
    assert.equal(calls.length, 2);
});

test('real Supabase SDK binds Apple callback exchange to this tab with PKCE S256', async () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    let authorizeURL;
    let requests = 0;
    let client;
    const auth = createAccountAuth(config, {
        origin: 'http://127.0.0.1:4338', storage,
        clientFactory: (url, key, options) => {
            client = createClient(url, key, { ...options, global: { fetch: async (url, options) => {
                requests++;
                assert.equal(String(url), 'https://test.supabase.co/auth/v1/token?grant_type=pkce');
                const body = JSON.parse(options.body);
                assert.equal(body.auth_code, 'fixture-callback-code');
                assert.ok(body.code_verifier.length >= 43);
                // Reject the synthetic code. Never contact Apple or Supabase.
                return Response.json({ error: 'invalid_grant', error_description: 'Rejected fixture' }, { status: 400 });
            } } });
            const signIn = client.auth.signInWithOAuth.bind(client.auth);
            client.auth.signInWithOAuth = async input => {
                const result = await signIn(input);
                authorizeURL = new URL(result.data.url);
                return result;
            };
            return client;
        },
    });
    try {
        await auth.apple();
        assert.equal(authorizeURL.origin, config.supabaseUrl);
        assert.equal(authorizeURL.pathname, '/auth/v1/authorize');
        assert.equal(authorizeURL.searchParams.get('provider'), 'apple');
        assert.equal(authorizeURL.searchParams.get('redirect_to'), 'http://127.0.0.1:4338/cuenta/');
        assert.equal(authorizeURL.searchParams.get('code_challenge_method'), 's256');
        assert.ok(authorizeURL.searchParams.get('code_challenge').length >= 43);
        await assert.rejects(auth.exchange('fixture-callback-code'), /auth_failed/);
        assert.equal(requests, 1);
        assert.equal(await auth.status(), null);
        // The failed exchange consumes its verifier; replay cannot reach the server.
        await assert.rejects(auth.exchange('fixture-callback-code'), /auth_failed/);
        assert.equal(requests, 1);
    } finally { await client.auth.stopAutoRefresh(); }
});
