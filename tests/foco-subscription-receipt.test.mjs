import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {authorizeSubscriptionReceipt,subscriptionMessages,deliverSubscriptionReceipts} from '../server/foco/subscription-receipt.mjs';
const fixture=()=>({environment:'production',reference:randomUUID(),agreementId:randomUUID(),transactionId:'provider-1',plan:'monthly',amountInCents:1000000,renewalInCents:1490000,cycle:0,useTrial:true,email:'buyer@example.com',termsVersion:'foco-web-subscription-2026-09-30.1',paidAt:'2026-10-04T12:00:00Z',periodEnd:null,delivery:{name:'Test <script>',phone:'3000000000',department:'Bogotá',city:'Bogotá',address:'Direccion ficticia 123',detail:''}});
class Store {
 records=new Map();version=0;
 async getWithMetadata(k){return structuredClone(this.records.get(k)??null);}
 async setJSON(k,data,o={}){const before=this.records.get(k);if((o.onlyIfNew&&before)||(o.onlyIfMatch&&before?.etag!==o.onlyIfMatch))return {modified:false};const etag=String(++this.version);this.records.set(k,{data:structuredClone(data),etag});return {modified:true,etag};}
}
const harness=()=>{let clock=new Date('2026-10-04T12:00:00Z'),failMerchant=false;const store=new Store(),calls=[];
 return {store,calls,advance:ms=>{clock=new Date(+clock+ms);},failMerchant:()=>{failMerchant=true;},fix:()=>{failMerchant=false;},
  options:{store,env:{FOCO_EMAIL_ENABLED:'true'},now:()=>clock,send:async x=>{calls.push(x);if(failMerchant&&x.kind==='merchant')throw Error('provider unavailable');return {emailId:'email-1'};}}};};
test('receipt endpoint requires a strong server credential and production environment',()=>{
 const secret='server-only-credential-'.repeat(3),env={FOCO_SUBSCRIPTION_RECEIPT_SECRET:secret,VERCEL_ENV:'production'};
 assert.throws(()=>authorizeSubscriptionReceipt(new Request('https://getfoco.co'),env),{status:401});
 assert.throws(()=>authorizeSubscriptionReceipt(new Request('https://getfoco.co',{headers:{authorization:'Bearer '+secret}}),{...env,VERCEL_ENV:'preview'}),{status:503});
 assert.doesNotThrow(()=>authorizeSubscriptionReceipt(new Request('https://getfoco.co',{headers:{authorization:'Bearer '+secret}}),env));
});
test('trial receipt separates shipping from renewal and gives dispatch details only to the approved merchant',()=>{
 const p=fixture(),m=subscriptionMessages(p);
 assert.match(m.receipt.text,/10\.000 COP/);assert.match(m.receipt.text,/14\.900 COP al mes/);assert.match(m.receipt.text,/al vincular/);
 assert.match(m.receipt.text,/2026-09-30\.1\/terms\.html/);assert.equal(m.merchant.to,'team@nilho.co');
 assert.match(m.merchant.text,/Direccion ficticia 123/);assert.doesNotMatch(m.merchant.html,/<script>/);assert.match(m.merchant.html,/&lt;script&gt;/);
 assert.doesNotMatch(m.receipt.text,/Direccion ficticia/);
});
test('renewal receipt does not instruct shipping another card and preserves the paid period',()=>{
 const p={...fixture(),cycle:1,useTrial:false,amountInCents:1490000,delivery:null,periodEnd:'2026-11-04T12:00:00Z'};
 const m=subscriptionMessages(p);assert.match(m.receipt.text,/noviembre/);assert.match(m.merchant.text,/No despachar/);
 assert.throws(()=>subscriptionMessages({...p,delivery:fixture().delivery}),{status:400});
});
test('sandbox, invalid amounts, recipient injection and unrecognized terms are rejected before delivery',()=>{
 for(const patch of [{environment:'sandbox'},{amountInCents:-1},{email:'buyer@example.com,other@example.com'},{termsVersion:'old-offer'}])assert.throws(()=>subscriptionMessages({...fixture(),...patch}),{status:400});
});
test('duplicate requests send each frozen message once',async()=>{
 const h=harness(),p=fixture();assert.deepEqual(await deliverSubscriptionReceipts(p,h.options),{delivered:true,reviewRequired:false});
 await deliverSubscriptionReceipts({...p,email:'changed@example.com'},h.options);assert.equal(h.calls.length,2);
 assert.equal(h.calls[0].message.to,'buyer@example.com');assert.match(h.calls[0].transactionId,/^subscription-/);
});
test('concurrent deliveries cannot claim the same message twice',async()=>{
 const h=harness(),p=fixture();await Promise.allSettled([deliverSubscriptionReceipts(p,h.options),deliverSubscriptionReceipts(p,h.options)]);
 await deliverSubscriptionReceipts(p,h.options);assert.equal(h.calls.filter(c=>c.kind==='receipt').length,1);assert.equal(h.calls.filter(c=>c.kind==='merchant').length,1);
});
test('merchant outage preserves the sent customer receipt and retries only the merchant',async()=>{
 const h=harness(),p=fixture();h.failMerchant();await assert.rejects(deliverSubscriptionReceipts(p,h.options),{status:503});
 h.fix();await deliverSubscriptionReceipts(p,h.options);assert.equal(h.calls.filter(c=>c.kind==='receipt').length,1);assert.equal(h.calls.filter(c=>c.kind==='merchant').length,2);
});
test('an ambiguous send beyond the provider dedupe window requires review instead of resending',async()=>{
 const h=harness(),p=fixture();h.failMerchant();await assert.rejects(deliverSubscriptionReceipts(p,h.options));h.fix();h.advance(24*3600000);
 assert.deepEqual(await deliverSubscriptionReceipts(p,h.options),{delivered:false,reviewRequired:true});assert.equal(h.calls.length,2);
});
