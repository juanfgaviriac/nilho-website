import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { vercelStore } from '../server/foco/vercel-store.mjs';
import { vercelEnvironment } from '../server/foco/vercel-runtime.mjs';
import { environment } from '../server/foco/commerce.mjs';
import { checkoutRateLimit } from '../server/foco/rate-limit.mjs';
import { checkoutOriginAllowed } from '../server/foco/http.mjs';
function harness() {
    const entries=new Map(),calls=[];let version=0;
    const sdk={
        async get(path,options) {calls.push({method:'get',path,options});const e=entries.get(path);return e ? {statusCode:200,stream:new Response(e.body).body,blob:{etag:e.etag}} : null;},
        async put(path,body,options) {calls.push({method:'put',path,options});const e=entries.get(path);
            if(options.ifMatch && e?.etag!==options.ifMatch)throw new BlobPreconditionFailedError();
            if(!options.allowOverwrite && e)throw new Error('Blob exists');
            const etag=String(++version);entries.set(path,{body,etag});return {etag};}
    };
    return {store:vercelStore({mode:'test',token:'fixture',sdk}),sdk,calls,entries};
}
test('private ledger adapter: strong reads, atomic create and compare-and-swap',async()=>{
    const h=harness();
    assert.equal(await h.store.get('orders/one',{type:'json'}),null);
    const results=await Promise.all([1,2].map(n=>h.store.setJSON('orders/one',{n},{onlyIfNew:true})));
    assert.equal(results.filter(r=>r.modified).length,1);
    const before=await h.store.getWithMetadata('orders/one',{type:'json'});
    const updates=await Promise.all([3,4].map(n=>h.store.setJSON('orders/one',{n},{onlyIfMatch:before.etag})));
    assert.equal(updates.filter(r=>r.modified).length,1);
    assert.equal((await h.store.get('orders/one',{type:'json'})).n,3);
    assert.ok(h.calls.every(c=>c.path.startsWith('test/')&&c.options.access==='private'));
    assert.ok(h.calls.filter(c=>c.method==='get').every(c=>c.options.useCache===false));
});
test('storage outage is never mistaken for a successful claim',async()=>{
    const sdk={get:async()=>{throw Error('outage')},put:async()=>{throw Error('outage')}};
    await assert.rejects(vercelStore({mode:'test',sdk}).setJSON('orders/one',{}, {onlyIfNew:true}),/outage/);
});
test('Vercel preview cannot use production payment credentials',()=>{
    const credentials={WOMPI_ENVIRONMENT:'prod',WOMPI_PRIVATE_KEY:'prv_prod_fixture',WOMPI_PUBLIC_KEY:'pub_prod_fixture',WOMPI_EVENTS_SECRET:'prod_events_fixture',CONTEXT:'production'};
    for(const VERCEL_ENV of [undefined,'preview','development'])assert.throws(()=>environment(vercelEnvironment({...credentials,VERCEL_ENV})),{code:'production_context_required'});
    assert.equal(environment(vercelEnvironment({...credentials,VERCEL_ENV:'production'})).mode,'prod');
});
test('checkout rate limit coordinates concurrent requests and resets each minute',async()=>{
    const {store,entries}=harness(),request=new Request('https://getfoco.co/api/foco/checkout',{headers:{'x-forwarded-for':'192.0.2.1'}});
    for(let i=0;i<9;i++)await checkoutRateLimit(request,store,'fixture-secret',0);
    const r=await Promise.allSettled([1,2,3].map(()=>checkoutRateLimit(request,store,'fixture-secret',0)));
    assert.equal(r.filter(r=>r.status==='fulfilled').length,1);
    assert.ok([...entries.keys()].every(key=>!key.includes('192.0.2.1')));
    await checkoutRateLimit(request,store,'fixture-secret',60000);
});
test('production checkout accepts only the new canonical origin',()=>{
    for(const origin of ['https://getfoco.co','https://www.getfoco.co','https://nilho.co','https://getfoco.co.evil.test']){
        assert.equal(checkoutOriginAllowed(new Request('https://getfoco.co/api/foco/checkout',{headers:{origin}}),{WOMPI_ENVIRONMENT:'prod'}),origin==='https://getfoco.co');
    }
});
