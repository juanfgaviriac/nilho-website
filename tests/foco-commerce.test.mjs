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
    FOCO_CHECKOUT_ENABLED: 'true', FOCO_EMAIL_ENABLED: 'true', RESEND_API_KEY: 're_fixture', FOCO_TEST_EMAIL_TO: 'buyer@example.com' });
function harness(options = {}) {
    const store = new MemoryStore(), env = fixtureEnv(), requests = [], acceptedEmails = new Map();
    if (options.mode === 'prod') Object.assign(env, { WOMPI_ENVIRONMENT: 'prod', CONTEXT: 'production',
        WOMPI_PRIVATE_KEY: 'prv_prod_fixture', WOMPI_PUBLIC_KEY: 'pub_prod_fixture', WOMPI_EVENTS_SECRET: 'prod_events_fixture' });
    let clock = new Date('2026-09-21T22:00:00Z'), tx, failEmail = false, linkCounter = 0;
    const fetchImpl = async (url, init) => {
        requests.push({ url, init });
        if (url.endsWith('/payment_links')) {
            const body = JSON.parse(init.body);
            const link = { ...body, id: `${env.WOMPI_ENVIRONMENT === 'test' ? 'test_' : ''}link${++linkCounter}`, active: true, merchant_public_key: env.WOMPI_PUBLIC_KEY };
            options.changeLink?.(link);
            return Response.json({ data: link });
        }
        if (url.includes('/transactions/')) return Response.json({ data: tx });
        if (url === 'https://api.resend.com/emails') {
            const kind = init.headers['Idempotency-Key'].startsWith('foco-merchant-') ? 'merchant' : 'receipt';
            if (failEmail === true || failEmail === kind) return new Response('recipient details must never be logged', { status: 503 });
            const key = init.headers['Idempotency-Key'];
            if (acceptedEmails.has(key)) assert.equal(acceptedEmails.get(key), init.body, 'An idempotent retry must preserve its payload');
            acceptedEmails.set(key, init.body);
            return Response.json({ id: `email-${kind}-fixture` });
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
        return { event: 'transaction.updated', environment: env.WOMPI_ENVIRONMENT, timestamp,
            data: { transaction: structuredClone(transaction) }, signature: { properties, checksum } };
    }
    return { core, store, env, requests, acceptedEmails, input, signed,
        advance: ms => { clock = new Date(clock.getTime()+ms); },
        failEmail: value => { failEmail = value; },
        emailCalls: (kind = 'receipt') => requests.filter(r=>r.url === 'https://api.resend.com/emails' && r.init.headers['Idempotency-Key'].startsWith(`foco-${kind}-v1/`)),
        allEmailCalls: () => requests.filter(r=>r.url === 'https://api.resend.com/emails'),
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

for (const [quantity, amount] of [[1,9500000],[2,18500000],[3,23500000]]) {
    test(`promo for ${quantity} cards: server-priced payment, frozen receipt and merchant alert`, async () => {
        const h = harness(), input = { ...h.input(quantity), promoCode: '  anycode  ', promoDiscount: 999999, amountInCents: 1 };
        const result = await h.core.createCheckout(input);
        assert.equal(JSON.parse(h.requests[0].init.body).amount_in_cents, amount);
        assert.equal(result.amountInCents, amount);
        assert.equal(result.promoCode, 'ANYCODE');
        const order = await h.store.get(`orders/${result.orderId}`);
        assert.equal(order.offer.promoCode, 'ANYCODE');
        assert.equal(order.offer.promoDiscount, 15000);
        assert.equal(order.offer.discount, quantity === 3 ? 50000 : 0);
        await h.approve(result);
        await h.core.handleEvent(h.signed());
        await h.core.handleEvent(h.signed());
        for (const kind of ['receipt', 'merchant']) {
            assert.equal(h.emailCalls(kind).length, 1);
            const message = JSON.parse(h.emailCalls(kind)[0].init.body);
            assert.match(message.text, /ANYCODE/);
            assert.match(message.text, /15\.000/);
        }
    });
}

test('promo retries normalize case and spaces but cannot reuse an attempt with a changed code', async () => {
    const h = harness(), input = { ...h.input(2), promoCode: 'VERANO' };
    const result = await h.core.createCheckout(input);
    assert.deepEqual(await h.core.createCheckout({ ...input, promoCode: ' verano ' }), result);
    for (const promoCode of ['', 'OTROCODIGO']) {
        await assert.rejects(h.core.createCheckout({ ...input, promoCode }), { code: 'checkout_conflict' });
    }
    assert.equal(h.requests.length, 1);
    const plain = h.input(1);
    await h.core.createCheckout(plain);
    await assert.rejects(h.core.createCheckout({ ...plain, promoCode: 'VERANO' }), { code: 'checkout_conflict' });
});

test('legacy orders without promo fields still retry and send their original full-price receipt', async () => {
    const h = harness(), input = h.input(2);
    const result = await h.core.createCheckout(input);
    const order = await h.store.get(`orders/${result.orderId}`);
    delete order.offer.promoCode; delete order.offer.promoDiscount;
    await h.store.setJSON(`orders/${result.orderId}`, order);
    assert.deepEqual(await h.core.createCheckout(input), result);
    await h.approve(result); await h.core.handleEvent(h.signed());
    assert.match(JSON.parse(h.emailCalls()[0].init.body).text, /200\.000/);
});

test('malformed and short codes fail before creating an order or calling Wompi', async () => {
    const h = harness();
    for (const promoCode of ['FOCO', '12345', 'a'.repeat(65), null, {}, ['VERANO'], 'abcde\ncode']) {
        await assert.rejects(h.core.createCheckout({ ...h.input(2), promoCode }), { code: 'invalid_promo_code' });
    }
    assert.equal(h.requests.length, 0);
    assert.equal(h.store.records.size, 0);
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
    assert.equal(h.allEmailCalls().length,0);
});
test('Wompi readback must match order amount and currency',async()=>{
    for(const change of [t=>t.amount_in_cents=1,t=>t.currency='USD']) {
        const h=harness(); const tx=await h.approve(await h.core.createCheckout(h.input(2))); change(tx);
        await assert.rejects(h.core.handleEvent(h.signed()),{code:'order_payment_mismatch'}); assert.equal(h.allEmailCalls().length,0);
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
    const req=(body,headers={})=>new Request('https://getfoco.co/api/foco/checkout',{method:'POST',headers:{'content-type':'application/json',...headers},body});
    await assert.rejects(readJSON(req('a'.repeat(5000)),4096),{code:'request_too_large'});
    await assert.rejects(readJSON(req('{bad'),4096),{code:'invalid_json'});
    await assert.rejects(readJSON(req('{}',{'content-type':'text/plain'}),4096),{code:'json_required'});
    assert.deepEqual(await readJSON(req('{"quantity":2}'),4096),{quantity:2});
    assert.equal(checkoutOriginAllowed(req('{}',{origin:'https://evil.example'}),{WOMPI_ENVIRONMENT:'prod'}),false);
    assert.equal(checkoutOriginAllowed(req('{}',{origin:'https://getfoco.co'}),{WOMPI_ENVIRONMENT:'prod'}),true);
});
test('checkout cannot accept money while email delivery is unconfigured',async()=>{
    for (const change of [h=>h.env.FOCO_EMAIL_ENABLED='false', h=>delete h.env.RESEND_API_KEY]) {
        const h=harness(); change(h);
        await assert.rejects(h.core.createCheckout(h.input(2)),{code:'email_not_configured'});
        assert.equal(h.requests.length,0);
    }
});
test('sandbox only sends to its explicitly configured test recipient',async()=>{
    const h=harness(); const tx=await h.approve(await h.core.createCheckout(h.input(2)));
    tx.customer_email='unexpected@example.com';
    assert.deepEqual(await h.core.handleEvent(h.signed()),{received:true,ignored:'sandbox_recipient'});
    assert.equal(h.allEmailCalls().length,0);
    delete h.env.FOCO_TEST_EMAIL_TO;
    await assert.rejects(h.core.createCheckout(h.input(2)),{code:'test_recipient_not_configured'});
});

for (const quantity of [1, 2, 3]) {
    test(`production purchase of ${quantity} cards sends buyer receipt and merchant alert independently`, async () => {
        const h = harness({ mode: 'prod' });
        const result = await h.core.createCheckout({ ...h.input(quantity), notificationEmail: 'attacker@example.com' });
        await h.approve(result);
        await h.core.handleEvent(h.signed());
        assert.equal(h.allEmailCalls().length, 2);
        const buyer = JSON.parse(h.emailCalls()[0].init.body);
        const alert = JSON.parse(h.emailCalls('merchant')[0].init.body);
        assert.deepEqual(buyer.to, ['buyer@example.com']);
        assert.deepEqual(alert.to, ['team@nilho.co']);
        assert.equal('cc' in buyer || 'bcc' in buyer, false);
        assert.match(alert.subject, /^Nueva compra Foco/);
        assert.match(alert.text, new RegExp(`Cantidad: ${quantity} tarjetas?`));
        assert.ok(alert.text.includes(`FOCO-${result.orderId}`));
        assert.ok(alert.text.includes('https://comercios.wompi.co/home'));
        assert.equal((await h.store.get('alerts/tx-fixture')).state, 'sent');
        assert.equal(h.emailCalls('merchant')[0].init.headers['Idempotency-Key'], 'foco-merchant-v1/tx-fixture');
    });
}

test('concurrent and late duplicate events never duplicate either email', async () => {
    const h = harness({ mode: 'prod' });
    await h.approve(await h.core.createCheckout(h.input(2)));
    await Promise.allSettled(Array.from({ length: 8 }, () => h.core.handleEvent(h.signed())));
    await h.core.handleEvent(h.signed());
    h.advance(48 * 3600000);
    await h.core.handleEvent(h.signed());
    assert.equal(h.emailCalls().length, 1);
    assert.equal(h.emailCalls('merchant').length, 1);
    assert.equal(h.acceptedEmails.size, 2);
});

for (const kind of ['receipt', 'merchant']) {
    test(`failed ${kind} delivery retries only that message, preserving successful delivery of the other`, async () => {
        const h = harness({ mode: 'prod' });
        const tx = await h.approve(await h.core.createCheckout(h.input(2)));
        h.failEmail(kind);
        await assert.rejects(h.core.handleEvent(h.signed()), { code: kind === 'receipt' ? 'receipt_retry_required' : 'alert_retry_required' });
        assert.equal(h.allEmailCalls().length, 2);
        const other = kind === 'receipt' ? 'merchant' : 'receipt';
        assert.equal((await h.store.get(`${other === 'receipt' ? 'receipts' : 'alerts'}/tx-fixture`)).state, 'sent');
        tx.customer_email = 'changed@example.com';
        tx.customer_data.full_name = 'Changed';
        h.failEmail(false);
        await h.core.handleEvent(h.signed());
        assert.equal(h.emailCalls(kind).length, 2);
        assert.equal(h.emailCalls(other).length, 1);
        assert.equal(h.emailCalls(kind)[0].init.body, h.emailCalls(kind)[1].init.body);
        assert.equal(h.acceptedEmails.size, 2);
    });
}

test('an approved order still alerts the merchant when the buyer email is invalid', async () => {
    const h = harness({ mode: 'prod' });
    const tx = await h.approve(await h.core.createCheckout(h.input(2)));
    tx.customer_email = 'invalid';
    await assert.rejects(h.core.handleEvent(h.signed()), /valid customer email/);
    assert.equal(h.emailCalls().length, 0);
    assert.equal(h.emailCalls('merchant').length, 1);
    tx.customer_email = 'corrected@example.com';
    await h.core.handleEvent(h.signed());
    assert.equal(h.emailCalls().length, 1);
    assert.equal(h.emailCalls('merchant').length, 1);
});

test('an ambiguous merchant send uses the same provider key after a lost ledger acknowledgement', async () => {
    const h = harness({ mode: 'prod' });
    await h.approve(await h.core.createCheckout(h.input(2)));
    const original = h.store.setJSON.bind(h.store);
    let drop = true;
    h.store.setJSON = async (key, data, options) => {
        if (drop && key === 'alerts/tx-fixture' && data.state === 'sent') {
            drop = false;
            throw new Error('Storage unavailable after provider acceptance');
        }
        return original(key, data, options);
    };
    await assert.rejects(h.core.handleEvent(h.signed()), /Storage unavailable/);
    await assert.rejects(h.core.handleEvent(h.signed()), { code: 'alert_in_progress' });
    h.advance(120001);
    await h.core.handleEvent(h.signed());
    assert.equal(h.emailCalls().length, 1);
    assert.equal(h.emailCalls('merchant').length, 2);
    assert.equal(h.acceptedEmails.size, 2);
    assert.equal((await h.store.get('alerts/tx-fixture')).state, 'sent');
});

test('expired ambiguous merchant delivery requires review without resending either email', async () => {
    const h = harness({ mode: 'prod' });
    await h.approve(await h.core.createCheckout(h.input(2)));
    h.failEmail('merchant');
    await assert.rejects(h.core.handleEvent(h.signed()), { code: 'alert_retry_required' });
    h.advance(24 * 3600000); h.failEmail(false);
    assert.equal((await h.core.handleEvent(h.signed())).reviewRequired, true);
    assert.equal((await h.store.get('alerts/tx-fixture')).state, 'manual_review');
    assert.equal((await h.store.get('receipts/tx-fixture')).state, 'sent');
    assert.equal(h.allEmailCalls().length, 2);
});

test('a receipt already sent by the previous deployment is not sent again when adding its alert', async () => {
    const h = harness({ mode: 'prod' });
    await h.approve(await h.core.createCheckout(h.input(2)));
    await h.store.setJSON('receipts/tx-fixture', { state: 'sent', createdAt: '2026-09-20T00:00:00Z', emailId: 'legacy-email' });
    await h.core.handleEvent(h.signed());
    await h.core.handleEvent(h.signed());
    assert.equal(h.emailCalls().length, 0);
    assert.equal(h.emailCalls('merchant').length, 1);
});

test('sandbox merchant alerts are visibly test-only and not generated for disallowed recipients', async () => {
    const h = harness();
    const tx = await h.approve(await h.core.createCheckout(h.input(2)));
    tx.customer_email = 'unexpected@example.com';
    await h.core.handleEvent(h.signed());
    assert.equal(h.allEmailCalls().length, 0);
    tx.customer_email = 'buyer@example.com';
    await h.core.handleEvent(h.signed());
    const alert = JSON.parse(h.emailCalls('merchant')[0].init.body);
    assert.match(alert.subject, /^\[PRUEBA\]/);
    assert.match(alert.text, /NO ES UNA COMPRA/);
    assert.match(alert.html, /No despachar tarjetas/);
});
