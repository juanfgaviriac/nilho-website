import { getStore } from '@netlify/blobs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { makeCommerce, environment, CommerceError } from './commerce.mjs';
import { FOCO_CHECKOUT } from '../../foco/checkout-config.mjs';

export function runtimeEnvironment(context, env = process.env) {
    // CONTEXT is build-only. The trusted Functions context supplies this at runtime;
    // never fall back to a configured value that could mislabel a preview.
    return { ...env, CONTEXT: context?.deploy?.context };
}

export async function runtime(context, variables = process.env) {
    const env = runtimeEnvironment(context, variables);
    const { mode } = environment(env);
    let config = FOCO_CHECKOUT;
    if (mode === 'test' && env.FOCO_SANDBOX_ORIGIN) {
        const expected = `https://foco-checkout-sandbox--${env.SITE_NAME}.netlify.app`;
        if (env.FOCO_SANDBOX_ORIGIN !== expected) throw new CommerceError(503, 'invalid_sandbox_origin');
        config = { ...config, redirectUrl: `${expected}/foco/pago/` };
    }
    const c = FOCO_CHECKOUT.commerce;
    const policies = {
        terms: await readFile(resolve('foco/compra/versiones', c.termsVersion, 'terms.html'), 'utf8'),
        privacy: await readFile(resolve('foco/compra/versiones', c.privacyVersion, 'privacy.html'), 'utf8'),
    };
    // Stores are private, persistent across deploys and separated by environment.
    // Strong reads + atomic conditional writes coordinate concurrent callbacks.
    const store = getStore({ name: `foco-orders-${mode}`, consistency: 'strong' });
    return makeCommerce({ store, env, policies, config });
}
