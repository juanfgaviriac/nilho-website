import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import vm from 'node:vm';
import { CONSENT_KEY, CONSENT_VERSION, readConsent, cleanPage, campaignParameters } from '../foco/analytics-model.mjs';
import { analyticsContext, purchasePayload, submitPurchase } from '../server/foco/analytics.mjs';
import { authorizedReport, commerceReport, reportWindow } from '../server/foco/insights.mjs';
import { renderAnalytics } from '../scripts/analytics.mjs';

class Store {
  records = new Map(); revision=0;
  async get(key) { return structuredClone(this.records.get(key)?.data ?? null); }
  async getWithMetadata(key) { return structuredClone(this.records.get(key) ?? null); }
  async setJSON(key,data,options={}) { const old=this.records.get(key);if((options.onlyIfNew&&old)||(options.onlyIfMatch&&old?.etag!==options.onlyIfMatch))return {modified:false};const etag=String(++this.revision);this.records.set(key,{data:structuredClone(data),etag});return {modified:true,etag}; }
  async listKeys(prefix) { return [...this.records.keys()].filter(key=>key.startsWith(prefix+'/')); }
}
const timestamp = '2026-09-22T18:00:00.000Z';
const order = {id:'order-fixture',environment:'prod',createdAt:timestamp,checkoutURL:'https://checkout.wompi.co/l/fixture',
  sku:'FOCO-01',quantity:1,currency:'COP',amountInCents:9500000,
  offer:{quantity:1,subtotal:100000,discount:0,promoDiscount:15000,promoCode:'PRIVATECODE',shipping:10000,total:95000},
  analytics:analyticsContext({clientId:'12345.67890',sessionId:'1790096400',consentVersion:CONSENT_VERSION},timestamp),
  seller:{name:'Private merchant'},customer_email:'do-not-send@example.test'};
const paid = {transactionId:'verified-tx',approvedAt:timestamp};
test('analytics data is bounded, consented and strips queries/fragments/free text',()=>{
  assert.equal(cleanPage('https://getfoco.co/pago/?id=private#secret'),'https://getfoco.co/pago/');
  assert.equal(cleanPage('https://other.test/private-name'),'https://other.test/');
  assert.deepEqual(campaignParameters('https://getfoco.co/?utm_source=instagram&utm_medium=paid_social&utm_campaign=launch&utm_content=person@example.com&q=private'),{campaign_source:'instagram',campaign_medium:'paid_social',campaign_name:'launch'});
  assert.equal(analyticsContext({clientId:'email@example.test',sessionId:'123',consentVersion:CONSENT_VERSION},timestamp),undefined);
  assert.equal(analyticsContext({...order.analytics,sessionId:'99999999999999999999'},timestamp),undefined);
  const now=Date.now();assert.equal(readConsent(JSON.stringify({version:CONSENT_VERSION,allowed:true,at:now}),now).allowed,true);
  for(const raw of ['broken',JSON.stringify({version:CONSENT_VERSION,allowed:true,at:now-181*86400000}),JSON.stringify({version:CONSENT_VERSION,allowed:true,at:now+1000})])assert.equal(readConsent(raw,now),null);
});
test('one consent bootstrap is injected only into current pages; double install fails',()=>{
  const html=renderAnalytics('<head></head><body><nav class="footer-links"></nav></body>');
  assert.equal((html.match(/src="\/foco\/analytics.js"/g)||[]).length,1);
  assert.match(html,/data-analytics-settings/);
  assert.throws(()=>renderAnalytics(html));
});
const bundle=(await build({entryPoints:[new URL('../foco/analytics.js',import.meta.url).pathname],bundle:true,format:'iife',write:false})).outputFiles[0].text;
function browser(consent,host='getfoco.co') {
  class Element extends EventTarget {dataset={};hidden=true;focus(){} }
  const accept=new Element(),reject=new Element(),settings=new Element(),panel=new Element(),scripts=[],cookies=[];
  accept.dataset.analyticsChoice='accept';reject.dataset.analyticsChoice='reject';
  const document=new EventTarget();Object.assign(document,{title:'Foco',referrer:'https://google.com/?q=private',head:{append:s=>scripts.push(s)},createElement:()=>({}),getElementById:()=>panel,querySelectorAll:()=>[reject,accept],querySelector:()=>settings});
  Object.defineProperty(document,'cookie',{get:()=>'',set:value=>cookies.push(value)});
  const storage=new Map(consent?[[CONSENT_KEY,JSON.stringify(consent)]]:[]),window=new EventTarget();
  const location={hostname:host,protocol:'https:',href:`https://${host}/?utm_source=instagram&email=private@example.test`,reload(){}};
  const sandbox={window,document,location,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},URL,Event,Date};
  vm.runInNewContext(bundle,sandbox);
  return {window,panel,scripts,accept,reject,settings,storage,cookies};
}
test('Google loads only after opt-in, once; previews never load it; rejection is reversible',()=>{
  const b=browser();assert.equal(b.scripts.length,0);assert.equal(b.panel.hidden,false);
  b.reject.dispatchEvent(new Event('click'));assert.equal(b.scripts.length,0);
  b.settings.dispatchEvent(new Event('click'));assert.equal(b.panel.hidden,false);
  b.accept.dispatchEvent(new Event('click'));assert.equal(b.scripts.length,1);
  assert.equal(b.window['ga-disable-G-3CKE5BGZW0'],false);
  b.accept.dispatchEvent(new Event('click'));assert.equal(b.scripts.length,1);
  const events=b.window.dataLayer.filter(a=>a[0]==='event');assert.equal(events.length,1);
  assert.equal(JSON.stringify(b.window.dataLayer).includes('private@example'),false);
  assert.equal(b.window.focoAnalytics.context(),undefined,'blocked/slow GA never stalls checkout');
  assert.equal(b.window.focoAnalytics.event('view_item'),true,'events can queue before Google resolves IDs');
  assert.equal(b.window.focoAnalytics.event('unknown'),false);
  assert.equal(browser({version:CONSENT_VERSION,allowed:true,at:Date.now()},'preview.vercel.app').scripts.length,0);
});
test('MP purchase reports discounted merchandise, separate shipping, no personal/free-form data',()=>{
  const payload=purchasePayload(order,paid),params=payload.events[0].params;
  assert.equal(params.value,85000);assert.equal(params.shipping,10000);assert.equal(params.items[0].price,85000);
  assert.equal(params.transaction_id,'verified-tx');assert.equal(payload.consent.ad_user_data,'DENIED');
  for(const value of ['Private merchant','do-not-send','PRIVATECODE'])assert.equal(JSON.stringify(payload).includes(value),false);
});
test('approved purchase submission is consent gated, lease-safe, retryable and deduplicated',async()=>{
  const store=new Store(),env={CONTEXT:'production',GA4_API_SECRET:'fixture',GA4_PURCHASES_ENABLED:'true'};let calls=0;
  const args={order,paid,store,env,now:()=>new Date(timestamp),fetchImpl:async()=>{calls++;return new Response(null,{status:204});}};
  assert.equal(await submitPurchase({...args,order:{...order,analytics:undefined}}),'disabled');
  assert.equal(await submitPurchase({...args,order:{...order,environment:'test'}}),'disabled');
  const results=await Promise.all([submitPurchase(args),submitPurchase(args)]);assert.equal(calls,1);assert.ok(results.includes('submitted'));
  await submitPurchase(args);assert.equal(calls,1);
  const retryStore=new Store();assert.equal(await submitPurchase({...args,store:retryStore,fetchImpl:async()=>{throw Error('private error')}}),'pending');
  assert.equal(await submitPurchase({...args,store:retryStore}),'submitted');
  assert.equal(await submitPurchase({...args,now:()=>new Date(Date.parse(timestamp)+72*3600000)}),'expired');
});
test('sales aggregate ledger payments in Colombia time, not browser events; immature checkouts excluded',async()=>{
  const store=new Store();await store.setJSON('orders/a',order);await store.setJSON('paid/a',paid);
  await store.setJSON('orders/b',{...order,id:'b',createdAt:'2026-09-22T20:30:00Z'});
  await store.setJSON('orders/c',{...order,id:'c',createdAt:'2026-09-22T16:00:00Z'});
  await store.setJSON('orders/d',{...order,id:'d',createdAt:'2026-09-21T23:00:00Z'});
  await store.setJSON('paid/d',{...paid,transactionId:'d',approvedAt:'2026-09-22T04:59:59Z'});
  const report=await commerceReport(store,7,new Date('2026-09-22T21:00:00Z'));
  assert.equal(report.revenue,190000);assert.equal(report.orders,2);assert.equal(report.checkouts,3);assert.equal(report.completedCheckouts,2);
  assert.equal(report.daily.at(-1).revenue,95000);assert.equal(report.daily.at(-2).revenue,95000);
  assert.equal(report.daily.reduce((n,d)=>n+d.revenue,0),report.revenue);
  assert.equal(JSON.stringify(report).includes('do-not-send'),false);assert.equal(JSON.stringify(report).includes('verified-tx'),false);
  assert.equal(reportWindow(7,new Date('2026-09-23T04:59:59Z')).end,'2026-09-22');
  await store.setJSON('paid/orphan',paid);await assert.rejects(commerceReport(store,7,new Date(timestamp)),/missing its order/);
});
test('report endpoint authorization never accepts missing, wrong or Unicode tokens',()=>{
  const secret='a'.repeat(40);
  assert.equal(authorizedReport(new Request('https://getfoco.co'),secret),false);
  assert.equal(authorizedReport(new Request('https://getfoco.co',{headers:{authorization:'Bearer '+secret}}),secret),true);
  assert.equal(authorizedReport(new Request('https://getfoco.co',{headers:{authorization:'Bearer '+'á'.repeat(40)}}),secret),false);
});
