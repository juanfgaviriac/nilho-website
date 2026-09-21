import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { makeCommerce, environment, verifyWompiEvent } from '../server/foco/commerce.mjs';
import { runtimeEnvironment } from '../server/foco/runtime.mjs';
import { readJSON, checkoutOriginAllowed } from '../server/foco/http.mjs';
import { FOCO_CHECKOUT, getOffer } from '../foco/checkout-config.mjs';

// An atomic, ETag-aware test double. No provider calls, emails or real orders.
class MemoryStore {
    records = new Map(); version = 0;
    async get(key) { return structuredClone(this.records.get(key)?.data ?? null); }
    async getWithMetadata(key) { return structuredClone(this.records.get(key) ?? null); }
    async setJSON(key, value, options = {}) { return this.set(key, value, options); }
    async set(key, value, options = {}) {
        const before = this.records.get(key);
        if ((options.onlyIfNew && before) || (options.onlyIfMatch && before?.etag !== options.onlyIfMatch)) return { modified: false };
        const etag = String(++this.version);
        this.records.set(key, { data: structuredClone(value), etag, metadata: {} });
        return { modified: true, etag };
    }
}
const fixtureEnv = () => ({ WOMPI_ENVIRONMENT: 'test', WOMPI_PRIVATE_KEY: 'prv_test_fixture',
    WOMPI_PUBLIC_KEY: 'pub_test_fixture', WOMPI_EVENTS_SECRET: 'test_events_fixture',
    FOCO_CHECKOUT_ENABLED: 'true', FOCO_EMAIL_ENABLED: 'true', RESEND_API_KEY: 're_fixture' });
function harness(options = {}) {
    const store = new MemoryStore(), env = fixtureEnv(), requests = [];
    let clock = new Date('2026-09-21T22:00:00Z'), tx, failEmail = false, linkCounter = 0;
    const fetchImpl = async (url, init) => {
        requests.push({ url, init });
        if (url.endsWith('/payment_links')) {
            const body = JSON.parse(init.body);
            const link = { ...body, id: `test_link${++linkCounter}`, active: true, merchant_public_key: env.WOMPI_PUBLIC_KEY };
            options.changeLink?.(link);
            return Response.json({ data: link });
        }
        if (url.includes('/transactions/')) return Response.json({ data: tx });
        if (url === 'https://api.resend.com/emails') {
            if (failEmail) return new Response('recipient details must never be logged', { status: 503 });
            return Response.json({ id: 'email-fixture' });
        }
        throw new Error('Unexpected external request');
    };
    const core = makeCommerce({ store, env, policies: { terms: '<p>Fixture terms</p>', privacy: '<p>Fixture privacy</p>' },
        fetchImpl, now: () => clock, ...options });
    const input = quantity => ({ quantity, accepted: true, attemptId: randomUUID(),
        termsVersion: FOCO_CHECKOUT.commerce.termsVersion, privacyVersion: FOCO_CHECKOUT.commerce.privacyVersion });
    function signed(transaction = tx) {
        const properties = ['transaction.id','transaction.status','transaction.amount_in_cents'];
        const timestamp = Math.floor(clock.getTime()/1000);
        const checksum = createHash('sha256').update(properties.map(p=>transaction[p.slice(12)]).join('') + timestamp + env.WOMPI_EVENTS_SECRET).digest('hex');
        return { event: 'transaction.updated', environment: 'test', timestamp,
            data: { transaction: structuredClone(transaction) }, signature: { properties, checksum } };
    }
    return { core, store, env, requests, input, signed,
        advance: ms => { clock = new Date(clock.getTime()+ms); },
        failEmail: value => { failEmail = value; },
        emailCalls: () => requests.filter(r=>r.url === 'https://api.resend.com/emails'),
        approve: async result => { const order = await store.get(`orders/${result.orderId}`); tx = { id: 'tx-fixture', payment_link_id: order.paymentLinkId,
            amount_in_cents: order.amountInCents, status: 'APPROVED', currency: 'COP', customer_email: 'buyer@example.com',
            customer_data: { full_name: 'Prueba' } }; return tx; },
    };
}
for (const [quantity, amount] of [[1,11000000],[2,20000000],[3,25000000]]) {
    test(`${quantity} cards: fixed amount, single-use link, server consent and approved receipt`, async()=>{
        const h=harness(), input=h.input(quantity); input.amountInCents=1; input.redirectUrl='https://evil.example';
        const result=await h.core.createCheckout(input);
        assert.match(result.checkoutURL,/^https:\/\/checkout.wompi.co\/l\/test_link/);
        const request=JSON.parse(h.requests[0].init.body);
        assert.equal(request.amount_in_cents,amount); assert.equal(request.single_use,true); assert.equal(request.collect_shipping,true);
        assert.equal(request.sku,result.orderId); assert.equal(request.redirect_url,FOCO_CHECKOUT.redirectUrl); assert.equal('taxes' in request,false);
        const order=await h.store.get(`orders/${result.orderId}`);
        assert.equal(order.consent.acceptedAt,'2026-09-21T22:00:00.000Z'); assert.equal(order.sku,`FOCO-0${quantity}`);
        assert.equal(await h.store.get(`policies/${order.consent.termsSHA256}`),'<p>Fixture terms</p>');
        await h.approve(result); await h.core.handleEvent(h.signed());
        assert.equal(h.emailCalls().length,1);
        assert.equal((await h.store.get('receipts/tx-fixture')).state,'sent');
        assert.equal(JSON.parse(h.emailCalls()[0].init.body).to[0],'buyer@example.com');
    });
}
test('same request retry returns the existing link, not a second order or link',async()=>{
    const h=harness(), input=h.input(2); const a=await h.core.createCheckout(input), b=await h.core.createCheckout(input);
    assert.deepEqual(a,b); assert.equal(h.requests.length,1);
    await assert.rejects(h.core.createCheckout({...input,quantity:3}),{code:'checkout_conflict'});
    h.advance(3600001); await assert.rejects(h.core.createCheckout(input),{code:'checkout_needs_review'});
});
test('concurrent checkout attempts with the same id create at most one provider link',async()=>{
    const h=harness(), input=h.input(2);
    const results=await Promise.allSettled([h.core.createCheckout(input),h.core.createCheckout(input)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1); assert.equal(h.requests.length,1);
});
test('rejected consent, changed policy versions and unknown quantities never reach Wompi',async()=>{
    const h=harness();
    for(const delta of [{accepted:false},{accepted:'true'},{quantity:4},{quantity:'2'},{attemptId:'bad'},{termsVersion:'stale'},{privacyVersion:'stale'}]) {
        await assert.rejects(h.core.createCheckout({...h.input(2),...delta}),{code:'invalid_checkout'});
    }
    assert.equal(h.requests.length,0);
});
test('disabled checkout and stock threshold fail closed on server',async()=>{
    const h=harness(); h.env.FOCO_CHECKOUT_ENABLED='false';
    await assert.rejects(h.core.createCheckout(h.input(2)),{code:'checkout_unavailable'});
    const low=harness({config:{...FOCO_CHECKOUT,commerce:{...FOCO_CHECKOUT.commerce,availableCards:5}}});
    await assert.rejects(low.core.createCheckout(low.input(2)),{code:'stock_unavailable'});
});
test('production credentials cannot run in preview or mismatch environments',()=>{
    assert.throws(()=>environment({...fixtureEnv(),WOMPI_ENVIRONMENT:'prod'}),{code:'production_context_required'});
    assert.throws(()=>environment({...fixtureEnv(),WOMPI_PRIVATE_KEY:'prv_prod_fixture'}),{code:'commerce_not_configured'});
});
test('Functions runtime uses the trusted deploy context, not a build-only or configured variable',()=>{
    const variables = { WOMPI_ENVIRONMENT: 'prod', WOMPI_PRIVATE_KEY: 'prv_prod_fixture',
        WOMPI_PUBLIC_KEY: 'pub_prod_fixture', WOMPI_EVENTS_SECRET: 'prod_events_fixture' };
    assert.equal(environment(runtimeEnvironment({ deploy: { context: 'production' } }, variables)).mode, 'prod');
    for (const context of [undefined, {}, { deploy: { context: 'deploy-preview' } }, { deploy: { context: 'branch-deploy' } }]) {
        assert.throws(() => environment(runtimeEnvironment(context, { ...variables, CONTEXT: 'production' })),
            { code: 'production_context_required' });
    }
});
test('a mismatched provider link is never returned or retried automatically',async()=>{
    for(const changeLink of [l=>l.amount_in_cents=1,l=>l.collect_shipping=false,l=>l.single_use=false,l=>l.sku='wrong',
        l=>l.redirect_url='https://evil.example',l=>l.merchant_public_key='pub_test_wrong',l=>l.id='production-link',l=>l.active=false,l=>l.expires_at='invalid']) {
        const h=harness({changeLink}), input=h.input(2);
        await assert.rejects(h.core.createCheckout(input),{code:'payment_link_mismatch'});
        await assert.rejects(h.core.createCheckout(input),{code:'checkout_needs_review'});
        assert.equal(h.requests.length,1);
    }
});
test('invalid signatures, amount tampering and wrong environment never query or send',async()=>{
    const h=harness(); await h.approve(await h.core.createCheckout(h.input(2)));
    for(const change of [e=>e.signature.checksum='0'.repeat(64), e=>e.data.transaction.amount_in_cents=1,
        e=>e.environment='prod',e=>e.signature.properties=['transaction.id'],e=>e.signature.properties.push('transaction.id')]) {
        const e=h.signed(); change(e); assert.equal(verifyWompiEvent(e,h.env.WOMPI_EVENTS_SECRET,'test'),false);
        await assert.rejects(h.core.handleEvent(e),{code:'invalid_event'});
    }
    assert.equal(h.requests.length,1);
});
test('unsigned webhook email and link are ignored in favour of authenticated Wompi readback',async()=>{
    const h=harness(); await h.approve(await h.core.createCheckout(h.input(2)));
    const e=h.signed(); e.data.transaction.customer_email='attacker@example.com'; e.data.transaction.payment_link_id='malicious';
    await h.core.handleEvent(e);
    assert.deepEqual(JSON.parse(h.emailCalls()[0].init.body).to,['buyer@example.com']);
    const read=h.requests.find(r=>r.url.includes('/transactions/'));
    assert.equal(read.init.headers.Authorization,'Bearer prv_test_fixture');
});
test('non-approved transactions and unmanaged legacy links never send receipts',async()=>{
    const h=harness(); const tx=await h.approve(await h.core.createCheckout(h.input(2)));
    tx.status='PENDING'; await h.core.handleEvent(h.signed()); assert.equal(h.requests.length,1);
    tx.status='APPROVED'; tx.payment_link_id='unmanaged'; await h.core.handleEvent(h.signed());
    assert.equal(h.emailCalls().length,0);
});
test('Wompi readback must match order amount and currency',async()=>{
    for(const change of [t=>t.amount_in_cents=1,t=>t.currency='USD']) {
        const h=harness(); const tx=await h.approve(await h.core.createCheckout(h.input(2))); change(tx);
        await assert.rejects(h.core.handleEvent(h.signed()),{code:'order_payment_mismatch'}); assert.equal(h.emailCalls().length,0);
    }
});
test('one order cannot confirm two different approved transaction ids',async()=>{
    const h=harness(); const tx=await h.approve(await h.core.createCheckout(h.input(2))); await h.core.handleEvent(h.signed());
    tx.id='tx-second'; await assert.rejects(h.core.handleEvent(h.signed()),{code:'order_already_paid'}); assert.equal(h.emailCalls().length,1);
});
test('duplicate and concurrent callbacks send once, including after the Resend window',async()=>{
    const h=harness(); await h.approve(await h.core.createCheckout(h.input(2)));
    const results=await Promise.allSettled([h.core.handleEvent(h.signed()),h.core.handleEvent(h.signed())]);
    assert.ok(results.some(r=>r.status==='fulfilled')); assert.equal(h.emailCalls().length,1);
    h.advance(25*3600000); await h.core.handleEvent(h.signed()); assert.equal(h.emailCalls().length,1);
});
test('provider failures retry the same frozen receipt and idempotency key',async()=>{
    const h=harness(); const tx=await h.approve(await h.core.createCheckout(h.input(2))); h.failEmail(true);
    await assert.rejects(h.core.handleEvent(h.signed()),{code:'receipt_retry_required'});
    tx.customer_email='changed@example.com'; h.failEmail(false); await h.core.handleEvent(h.signed());
    assert.equal(h.emailCalls().length,2);
    assert.equal(h.emailCalls()[0].init.body,h.emailCalls()[1].init.body);
    assert.equal(h.emailCalls()[0].init.headers['Idempotency-Key'],h.emailCalls()[1].init.headers['Idempotency-Key']);
});
test('ambiguous email after 23 hours requires manual review instead of risking a duplicate',async()=>{
    const h=harness(); await h.approve(await h.core.createCheckout(h.input(2))); h.failEmail(true);
    await assert.rejects(h.core.handleEvent(h.signed())); h.advance(24*3600000); h.failEmail(false);
    assert.equal((await h.core.handleEvent(h.signed())).reviewRequired,true); assert.equal(h.emailCalls().length,1);
    assert.equal((await h.store.get('receipts/tx-fixture')).state,'manual_review');
});
test('HTTP rejects oversized, malformed and non-JSON input and wrong origins',async()=>{
    const req=(body,headers={})=>new Request('https://nilho.co/api/foco/checkout',{method:'POST',headers:{'content-type':'application/json',...headers},body});
    await assert.rejects(readJSON(req('a'.repeat(5000)),4096),{code:'request_too_large'});
    await assert.rejects(readJSON(req('{bad'),4096),{code:'invalid_json'});
    await assert.rejects(readJSON(req('{}',{'content-type':'text/plain'}),4096),{code:'json_required'});
    assert.deepEqual(await readJSON(req('{"quantity":2}'),4096),{quantity:2});
    assert.equal(checkoutOriginAllowed(req('{}',{origin:'https://evil.example'}),{WOMPI_ENVIRONMENT:'prod'}),false);
    assert.equal(checkoutOriginAllowed(req('{}',{origin:'https://nilho.co'}),{WOMPI_ENVIRONMENT:'prod'}),true);
});
test('checkout cannot accept money while email delivery is unconfigured',async()=>{
    for (const change of [h=>h.env.FOCO_EMAIL_ENABLED='false', h=>delete h.env.RESEND_API_KEY]) {
        const h=harness(); change(h);
        await assert.rejects(h.core.createCheckout(h.input(2)),{code:'email_not_configured'});
        assert.equal(h.requests.length,0);
    }
});
