// Official Wompi widget, loaded only after an explicit sandbox payment action.
// https://docs.wompi.co/docs/colombia/widget-checkout-web/#botón-personalizado-opcional
export function sandboxWidgetOptions(checkoutURL, now = Date.now()) {
    const url = new URL(checkoutURL);
    const get = name => url.searchParams.get(name);
    const amount = get('amount-in-cents');
    const expiration = get('expiration-time');
    if (url.origin !== 'https://checkout.wompi.co' || url.pathname !== '/p/' || url.username || url.password
        || !/^pub_test_[A-Za-z0-9]+$/.test(get('public-key') || '') || get('currency') !== 'COP'
        || !/^[A-Za-z0-9-]{1,100}$/.test(get('reference') || '')
        || !/^[a-f0-9]{64}$/.test(get('signature:integrity') || '')
        || !/^[1-9]\d*$/.test(amount || '') || !Number.isSafeInteger(Number(amount))
        || !Number.isFinite(Date.parse(expiration)) || Date.parse(expiration) <= now) {
        throw Error('invalid_sandbox_checkout');
    }
    // Explicit allowlist: never pass a loopback redirect, identity, delivery data,
    // private credentials, or any arbitrary query parameters to the provider.
    // Also works with previously saved handoffs containing the old redirect URL.
    return { publicKey: get('public-key'), currency: 'COP', amountInCents: Number(amount),
        reference: get('reference'), signature: { integrity: get('signature:integrity') }, expirationTime: expiration };
}

export function createSandboxWompi({ view = window, doc = document, now = Date.now, tokenizationEnvironment = null } = {}) {
    let loading;
    function load() {
        if (typeof view.WidgetCheckout === 'function') return Promise.resolve(view.WidgetCheckout);
        if (loading) return loading;
        loading = new Promise((resolve, reject) => {
            const script = doc.createElement('script');
            let settled = false;
            const finish = ok => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                script.onload = script.onerror = null;
                if (ok && typeof view.WidgetCheckout === 'function') resolve(view.WidgetCheckout);
                else { script.remove(); reject(Error('wompi_unavailable')); }
            };
            const timer = setTimeout(() => finish(false), 12000);
            script.src = 'https://checkout.wompi.co/widget.js';
            script.async = true;
            script.referrerPolicy = 'no-referrer';
            script.onload = () => finish(true);
            script.onerror = () => finish(false);
            doc.head.appendChild(script);
        }).catch(error => { loading = null; throw error; });
        return loading;
    }
    async function prepare(checkoutURL) {
        if (view.location.origin !== 'http://127.0.0.1:4338') throw Error('sandbox_only');
        const options = sandboxWidgetOptions(checkoutURL, now());
        const Widget = await load();
        return onTransaction => {
            // Recheck expiry after loading the provider script.
            sandboxWidgetOptions(checkoutURL, now());
            let delivered = false;
            new Widget(options).open(result => {
                const id = result?.transaction?.id;
                if (delivered || !/^[A-Za-z0-9-]{1,100}$/.test(id || '')) return;
                delivered = true;
                // Status from the browser is deliberately ignored.
                onTransaction(id);
            });
        };
    }
    prepare.tokenize = async publicKey => {
        const environment = tokenizationEnvironment || 'sandbox';
        const local = view.location.origin === 'http://127.0.0.1:4338';
        if ((!local && (!tokenizationEnvironment || !view.location.origin.startsWith('https://')))
            || !new RegExp(`^pub_${environment === 'production' ? 'prod' : 'test'}_[A-Za-z0-9]+$`).test(publicKey)) throw Error('invalid_environment');
        const Widget = await load();
        return onToken => {
            let delivered = false;
            new Widget({ publicKey, widgetOperation: 'tokenize', paymentMethods: ['CARD'] }).open(result => {
                const source = result?.payment_source;
                if (delivered || source?.type !== 'CARD' || !new RegExp(`^tok_${environment === 'production' ? 'prod' : 'test'}_[A-Za-z0-9_]{1,200}$`).test(source.token || '')) return;
                delivered = true;
                onToken(source.token);
            });
        };
    };
    return prepare;
}

// Hosted tokenization is explicitly bound to the server-selected environment.
// The separate loopback widget remains sandbox-only.
export function createHostedWompi(environment, options = {}) {
    if (!['sandbox', 'production'].includes(environment)) throw Error('invalid_environment');
    return createSandboxWompi({ ...options, tokenizationEnvironment: environment });
}
