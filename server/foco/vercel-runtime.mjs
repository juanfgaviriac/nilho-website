import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { makeCommerce, environment, CommerceError } from './commerce.mjs';
import { vercelStore } from './vercel-store.mjs';
import { FOCO_CHECKOUT } from '../../foco/checkout-config.mjs';

export function vercelEnvironment(env = process.env) {
    // VERCEL_ENV is supplied by the platform; a configured CONTEXT cannot relabel a preview.
    return {...env,CONTEXT:env.VERCEL_ENV};
}
export async function vercelRuntime(variables = process.env) {
    const env = vercelEnvironment(variables), {mode} = environment(env);
    if (!env.BLOB_READ_WRITE_TOKEN && !env.BLOB_STORE_ID) throw new CommerceError(503,'storage_not_configured');
    const store = vercelStore({mode,token:env.BLOB_READ_WRITE_TOKEN,storeId:env.BLOB_STORE_ID});
    const c = FOCO_CHECKOUT.commerce;
    const policies = Object.fromEntries(await Promise.all(['terms','privacy'].map(async kind =>
        [kind, await readFile(resolve('foco/compra/versiones',c[`${kind}Version`],`${kind}.html`),'utf8')])));
    let config = FOCO_CHECKOUT;
    if (mode === 'test') {
        if (!env.VERCEL_URL || !/^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL)) throw new CommerceError(503,'invalid_sandbox_origin');
        config = {...config,redirectUrl:`https://${env.VERCEL_URL}/pago/`};
    }
    return {commerce:makeCommerce({store,env,policies,config}),store,env};
}
