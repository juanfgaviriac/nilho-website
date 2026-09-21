import { getStore } from '@netlify/blobs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { makeCommerce, environment } from './commerce.mjs';
import { FOCO_CHECKOUT } from '../../foco/checkout-config.mjs';

export async function runtime(env = process.env) {
    const { mode } = environment(env);
    const c = FOCO_CHECKOUT.commerce;
    const policies = {
        terms: await readFile(resolve('foco/compra/versiones', c.termsVersion, 'terms.html'), 'utf8'),
        privacy: await readFile(resolve('foco/compra/versiones', c.privacyVersion, 'privacy.html'), 'utf8'),
    };
    // Stores are private, persistent across deploys and separated by environment.
    // Strong reads + atomic conditional writes coordinate concurrent callbacks.
    const store = getStore({ name: `foco-orders-${mode}`, consistency: 'strong' });
    return makeCommerce({ store, env, policies });
}
