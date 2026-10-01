import test from 'node:test';
import { SUBSCRIPTION_POLICY_VERSION } from '../foco/subscription-policy.mjs';
import assert from 'node:assert/strict';
import { handleHostedSubscription, hostedSubscriptionConfig, billingPath } from '../server/foco/subscription.mjs';
import { recurringCatalog, recurringAgreement, resumableAgreement } from '../foco/account-recurring.mjs';
import { accountAccessV2 } from '../server/foco/account-status.mjs';
import { createHostedWompi } from '../foco/account-wompi.mjs';
import { PREVIEW_PLANS } from '../foco/account-flow.mjs';

const env = { FOCO_WEB_ACCOUNT_ENABLED:'true',FOCO_AUTH_URL:'https://test.supabase.co',FOCO_AUTH_PUBLISHABLE_KEY:'sb_publishable_fixture',
    FOCO_WEB_SUBSCRIPTION_MODE:'production',FOCO_WEB_SUBSCRIPTION_LIVE_APPROVED:'true' };
const request = (action, changes = {}) => new Request(`https://getfoco.co/api/foco/subscription?action=${action}&environment=sandbox&userId=another`, {
    method:'POST', headers:{ origin:'https://getfoco.co', authorization:'Bearer owner-session-token-fixture', 'content-type':'application/json' }, body:'{"id":"fixture"}', ...changes,
});
test('hosted checkout needs explicit environment gates and never accepts an upstream from the request',async()=>{
    assert.deepEqual(hostedSubscriptionConfig({}),{enabled:false});
    assert.deepEqual(hostedSubscriptionConfig({...env,FOCO_WEB_SUBSCRIPTION_LIVE_APPROVED:'false'}),{enabled:false});
    assert.equal(billingPath(env,'/api/v1/subscription'),'https://foco-backend.vercel.app/api/v1/subscription');
    const calls=[];
    const response=await handleHostedSubscription(request('create'),env,async(url,init)=>{
        calls.push({url,init});return Response.json({agreement:{id:'fixture'}});
    });
    assert.equal(response.status,200);
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,'https://foco-backend.vercel.app/api/v1/subscription?action=create');
    assert.equal(calls[0].init.headers.authorization,'Bearer owner-session-token-fixture');
    assert.equal(calls[0].init.redirect,'error');
    assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('wrong origin, missing identity, wrong method and oversized requests cannot reach billing',async()=>{
    let calls=0;const fetcher=async()=>{calls++;throw Error('must not call');};
    for(const [req,status] of [[request('pay',{headers:{origin:'https://attacker.test'}}),403],
        [request('pay',{headers:{origin:'https://getfoco.co'}}),401],
        [request('pay',{method:'GET',body:undefined}),405],
        [request('renew'),404], [request('pay',{body:JSON.stringify({value:'x'.repeat(25000)})}),413]]) {
        assert.equal((await handleHostedSubscription(req,env,fetcher)).status,status);
    }
    assert.equal(calls,0);
});
test('ambiguous mutations are not retried or exposed as successful payments',async()=>{
    let calls=0;
    const response=await handleHostedSubscription(request('pay'),env,async()=>{calls++;throw Error('private provider detail');});
    assert.equal(response.status,503);assert.equal(calls,1);
    assert.deepEqual(await response.json(),{error:{code:'billing_unavailable'}});
});
test('staging uses only its separate hosted sandbox path',async()=>{
    const stage={...env,FOCO_WEB_SUBSCRIPTION_MODE:'sandbox',FOCO_WEB_SANDBOX_APPROVED:'true',FOCO_WEB_ORIGIN:'https://getfoco-test-juanfgaviriacs-projects.vercel.app'};
    let destination;
    const req=request('status',{method:'GET',body:undefined});
    assert.equal((await handleHostedSubscription(req,stage,async url=>{destination=url;return Response.json({environment:'sandbox',agreements:[]});})).status,200);
    assert.equal(destination,'https://foco-backend.vercel.app/billing-sandbox/api/v1/subscription?action=status');
});
const catalog=environment=>({environment,publicKey:`pub_${environment==='production'?'prod':'test'}_fixture`,products:PREVIEW_PLANS.map(p=>({
    product_id:`foco.web.${p.id}.v1`,plan_code:p.id,interval_months:p.months,amount_in_cents:p.amount*100,currency:'COP',trial_days:7,shipping_in_cents:1000000,terms_version:SUBSCRIPTION_POLICY_VERSION}))});
test('browser catalog rejects mixed environments, changed prices and unexpected currency',()=>{
    assert.equal(recurringCatalog(catalog('production'),'production').products.length,3);
    assert.throws(()=>recurringCatalog(catalog('sandbox'),'production'));
    assert.throws(()=>recurringCatalog(catalog('production')));
    const changed=catalog('production');changed.products[0].amount_in_cents=1;
    assert.throws(()=>recurringCatalog(changed,'production'));
});
test('paid canceled cards can still activate without initiating another purchase',()=>{
    const row={id:'7b6483d7-f2ea-4b5f-a238-724810d9c884',environment:'production',plan:'monthly',useTrial:false,hasCard:false,
        amountInCents:1490000,initialInCents:2490000,state:'canceled',sourceState:'available',initialPayment:'approved',
        canceledAt:'2026-09-30T00:00:00Z',periodEndsAt:null,trialEndsAt:null,accessUntil:null};
    assert.equal(recurringAgreement(row,'production'),row);
    assert.equal(resumableAgreement([row]),row);
    assert.throws(()=>recurringAgreement(row,'sandbox'));
});
test('sandbox access cannot enter the production account reader',()=>{
    const body={schemaVersion:2,environment:'sandbox',availability:'ready',checkedAt:'2026-09-30T00:00:00Z',chargingEnabled:false,enforcementEnabled:true,
        access:{entitlement:'unassigned',source:null,grantedAt:null,expiresAt:null},state:'unassigned',subscriptions:[],needsBillingReview:false,action:'none'};
    assert.throws(()=>accountAccessV2(body));
    assert.equal(accountAccessV2(body,'sandbox').environment,'sandbox');
});
test('hosted Wompi tokenization validates provider keys and token environments',async()=>{
    let callback;const received=[];
    const view={location:{origin:'https://getfoco.co'},WidgetCheckout:class{open(fn){callback=fn;}}};
    const widget=createHostedWompi('production',{view,doc:{}});
    await assert.rejects(widget.tokenize('pub_test_fixture'));
    const open=await widget.tokenize('pub_prod_fixture');open(token=>received.push(token));
    callback({payment_source:{type:'CARD',token:'tok_test_wrong'}});
    assert.deepEqual(received,[]);
    callback({payment_source:{type:'CARD',token:'tok_prod_fixture'}});
    callback({payment_source:{type:'CARD',token:'tok_prod_second'}});
    assert.deepEqual(received,['tok_prod_fixture']);
});
