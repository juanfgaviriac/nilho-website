import { createClient } from '@supabase/supabase-js';

// Loaded only after an explicitly enabled public configuration is received.
// Auth stays in this tab; no email/address/code is written to our own storage.
export function createAccountAuth(config, { origin = window.location.origin, storage = window.sessionStorage, fetcher = fetch, clientFactory = createClient } = {}) {
    if (config.enabled !== true || !config.publishableKey?.startsWith('sb_publishable_')
        || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl)) throw new Error('auth_not_configured');
    const callback = new URL('/cuenta/', origin);
    const localHTTP = callback.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(callback.hostname);
    if (callback.protocol !== 'https:' && !localHTTP) throw new Error('auth_not_configured');
    const client = clientFactory(config.supabaseUrl, config.publishableKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true,
            detectSessionInUrl: false, storage, storageKey: 'foco-web-account' },
    });
    const checked = result => { if (result.error) throw new Error('auth_failed'); return result.data; };
    return {
        async sendCode(email, shouldCreateUser) {
            checked(await client.auth.signInWithOtp({ email, options: { shouldCreateUser: shouldCreateUser === true } }));
        },
        async verifyCode(email, token) { checked(await client.auth.verifyOtp({ email, token, type: 'email' })); },
        async apple() {
            if (!config.appleEnabled) throw new Error('apple_not_configured');
            checked(await client.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: callback.href } }));
        },
        async exchange(code) { checked(await client.auth.exchangeCodeForSession(code)); },
        async status() {
            const { session } = checked(await client.auth.getSession());
            if (!session) return null;
            // getSession is used only to obtain the token. The backend verifies
            // identity and access; local user metadata never grants rights.
            const response = await fetcher('/api/foco/account?action=status', {
                headers: { authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
                signal: AbortSignal.timeout(15000),
            });
            if (response.status === 401) { await client.auth.signOut({ scope: 'local' }); return null; }
            if (!response.ok) throw new Error('access_unavailable');
            const account = await response.json();
            // Display identity only after the server accepted this session. This
            // label never decides ownership or access; the backend does that.
            const accountEmail = typeof session.user?.email === 'string' ? session.user.email : '';
            return { ...account, accountEmail };
        },
        async checkout(action, input) {
            if (origin !== 'http://127.0.0.1:4338' || config.sandboxCheckout?.enabled !== true
                || !['resume', 'quote', 'start', 'verify'].includes(action)) throw new Error('checkout_disabled');
            const { session } = checked(await client.auth.getSession());
            if (!session) throw new Error('unauthorized');
            const response = await fetcher(`/api/foco/subscription-sandbox?action=${action}`, {
                method: action === 'resume' ? 'GET' : 'POST', cache: 'no-store',
                headers: { authorization: `Bearer ${session.access_token}`, ...(action === 'resume' ? {} : { 'content-type': 'application/json' }) },
                ...(action === 'resume' ? {} : { body: JSON.stringify(input) }), signal: AbortSignal.timeout(35000),
            });
            if (response.status === 401) { await client.auth.signOut({ scope: 'local' }); throw new Error('unauthorized'); }
            const result = await response.json();
            if (!response.ok) throw Object.assign(new Error('checkout_failed'), { code: result.error });
            return result;
        },
        async signOut() { checked(await client.auth.signOut({ scope: 'local' })); },
        async subscription(action, input) {
            if (config.recurringCheckout?.enabled !== true || !(localHTTP || callback.protocol === 'https:')
                || !['status', 'catalog', 'acceptance', 'create', 'source', 'verify-source', 'replace-source', 'verify-replacement', 'retry-payment', 'refresh-payment', 'pay', 'cancel'].includes(action)) throw Error('checkout_disabled');
            const { session } = checked(await client.auth.getSession());
            if (!session) throw Error('unauthorized');
            const read = ['status', 'catalog', 'acceptance'].includes(action);
            const response = await fetcher(`/api/foco/subscription?action=${action}`, {
                method: read ? 'GET' : 'POST', cache: 'no-store',
                headers: { authorization: `Bearer ${session.access_token}`, ...(!read ? { 'content-type': 'application/json' } : {}) },
                ...(!read ? { body: JSON.stringify(input) } : {}), signal: AbortSignal.timeout(35000),
            });
            if (response.status === 401) { await client.auth.signOut({ scope: 'local' }); throw Error('unauthorized'); }
            const result = await response.json();
            if (!response.ok) throw Object.assign(Error('subscription_failed'), { code: result.error?.code });
            return result;
        },
        onSignedOut(callback) {
            const { data } = client.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') callback(); });
            return () => data.subscription.unsubscribe();
        },
    };
}
