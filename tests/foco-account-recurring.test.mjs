import test from 'node:test';
import assert from 'node:assert/strict';
import { recurringCatalog, recurringAgreement, recurringAcceptance, mountAuthentication, resumableAgreement } from '../foco/account-recurring.mjs';
import { PREVIEW_PLANS, previewPlan } from '../foco/account-flow.mjs';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const catalog = () => ({ environment:'sandbox',publicKey:'pub_test_fixture',products:PREVIEW_PLANS.map(p=>({
    plan_code:p.id,product_id:`test.${p.id}`,amount_in_cents:p.amount*100,interval_months:p.months,currency:'COP',
    trial_days:7,shipping_in_cents:1000000,terms_version:'test-v1' })) });
test('recurring checkout refuses drift in server pricing, trial, shipping or environment',()=>{
    assert.equal(recurringCatalog(catalog()).products.length,3);
    for(const changes of [{amount_in_cents:1},{interval_months:12},{currency:'USD'},{trial_days:14},{shipping_in_cents:0},{terms_version:''}]) {
        const c=catalog(); Object.assign(c.products[0],changes); assert.throws(()=>recurringCatalog(c));
    }
    assert.throws(()=>recurringCatalog({...catalog(),environment:'production'}));
    assert.throws(()=>recurringCatalog({...catalog(),publicKey:'pub_prod_fixture'}));
});
test('saved agreements cannot turn sandbox payments into live access or existing-card trials',()=>{
    const a={id:'00000000-0000-4000-8000-000000000001',environment:'sandbox',plan:'monthly',hasCard:false,useTrial:true,
        accessUntil:null,amountInCents:1490000,initialInCents:1000000,state:'awaiting_card',sourceState:'available',initialPayment:'approved'};
    assert.equal(recurringAgreement(a),a);
    for(const changes of [{environment:'production'},{accessUntil:'2099-01-01'},{hasCard:true},{amountInCents:1},{initialPayment:'fake'}]) assert.throws(()=>recurringAgreement({...a,...changes}));
});
test('provider acceptance links are HTTPS Wompi links, never arbitrary URLs',()=>{
    const item={permalink:'https://wompi.com/terms',acceptance_token:'fixture'};
    assert.ok(recurringAcceptance({presigned_acceptance:item,presigned_personal_data_auth:item}));
    for(const permalink of ['http://wompi.com/terms','https://wompi.com.evil.invalid/','javascript:alert(1)','https://user@wompi.com/'])
        assert.throws(()=>recurringAcceptance({presigned_acceptance:{...item,permalink},presigned_personal_data_auth:item}));
});
test('bank verification is isolated and preserves the same iframe across polls',()=>{
    const doc={createElement:()=>({dataset:{},setAttribute(k,v){this[k]=v;}})};
    const container={firstElementChild:null,replaceChildren(el){this.firstElementChild=el;}};
    const auth={step:'CHALLENGE',html:'<form action="https://bank.example/verify"><button>Confirmar</button></form>'};
    mountAuthentication(container,auth,doc);
    const frame=container.firstElementChild;
    assert.equal(frame.sandbox,'allow-scripts allow-forms');
    assert.equal(frame.referrerPolicy,'no-referrer');
    assert.match(frame.srcdoc,/base-uri 'none'/);
    assert.match(frame.srcdoc,/connect-src https:/);
    mountAuthentication(container,auth,doc); assert.equal(container.firstElementChild,frame);
    mountAuthentication(container,null,doc); assert.equal(container.firstElementChild,undefined);
    assert.throws(()=>mountAuthentication(container,{...auth,step:'UNKNOWN'},doc));
});
test('authorization is explicit and tokens never enter browser persistence or telemetry',async()=>{
    const source=await readFile(new URL('../foco/account.js',import.meta.url),'utf8');
    assert.match(source,/state\.providerTerms = false; state\.personalData = false/);
    assert.match(source,/widgetGeneration !== state\.generation/);
    assert.match(source,/acceptedProviderTerms: true, acceptedPersonalData: true/);
    assert.match(source,/if \(state\.authPolls < 60\)/);
    assert.doesNotMatch(source,/localStorage|\.setItem\(|console\.log|gtag\(/);

});

async function resultRenderer(state = {}) {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    const render = source.slice(source.indexOf('function recurringResult('), source.indexOf('async function prepareAuthorization('));
    const appLinks = source.match(/^const appLinks = (.+);$/m)[0];
    return runInNewContext(`let celebratedAgreement; ${appLinks} ${render}; recurringResult`, {
        state, previewPlan, money: value => String(value), check: '<svg aria-hidden="true"></svg>', errorLine: '',
        heading: (title, lede) => `<h1>${title}</h1><p>${lede}</p>`,
        button: (text, action) => `<button data-action="${action}">${text}</button>`,
    });
}
const approvedAgreement = { id: 'test-success', plan: 'monthly', amountInCents: 1490000,
    sourceState: 'available', initialPayment: 'approved', useTrial: false };

test('authorization completion artwork requires both payment and a usable source, never a failed or canceled result', async () => {
    const render = await resultRenderer();
    const html = render(approvedAgreement);
    assert.match(html, /class="account-authorization account-authorization--arrive"/);
    assert.match(html, /Tu tarjeta, el siguiente paso\./);
    assert.match(html, /authorization-art" aria-hidden="true"/);
    assert.match(html, /src="\/foco\/assets\/authorization-seal.svg"/);
    assert.doesNotMatch(html, /foco-card-orbit|authorization-card/);
    assert.doesNotMatch(html, /reloj de prueba|manualmente|build de prueba/);
    for (const changes of [{ initialPayment: 'pending' }, { initialPayment: 'declined' },
        { initialPayment: 'voided' }, { sourceState: 'verifying' }, { state: 'canceled' },
        { state: 'revoked' }, { canceledAt: '2026-09-29' }]) {
        assert.doesNotMatch(render({ ...approvedAgreement, ...changes }), /class="account-authorization/);
    }
    assert.doesNotMatch((await resultRenderer({ sourceFailed: true }))(approvedAgreement), /class="account-authorization/);
});

test('completion motion does not replay during cancellation confirmation or subsequent renders', async () => {
    const state = {};
    const render = await resultRenderer(state);
    assert.match(render(approvedAgreement), /account-authorization--arrive/);
    state.cancelConfirm = true;
    const confirm = render(approvedAgreement);
    assert.doesNotMatch(confirm, /account-authorization--arrive/);
    assert.match(confirm, /confirm-cancel/);
    state.cancelConfirm = false;
    assert.doesNotMatch(render(approvedAgreement), /account-authorization--arrive/);
});

test('completion preserves every plan cadence and explains that payment does not start the trial', async () => {
    const render = await resultRenderer();
    for (const plan of PREVIEW_PLANS) {
        const html = render({ ...approvedAgreement, plan: plan.id, amountInCents: plan.amount * 100, useTrial: true });
        assert.ok(html.includes(`<strong>${plan.amount}</strong>`));
        assert.ok(html.includes(`COP ${plan.cadence}, después de la prueba.`));
        assert.match(html, /7 días gratis empiezan al vincular/);
    }
});

test('completion preview stays local and reduced motion leaves the artwork visible', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../foco/account.css', import.meta.url), 'utf8');
    assert.match(source, /review && v === 'autorizacion'/);
    assert.match(source, /if \(review && v === 'autorizacion'\).*el\.disabled = true/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*animation: none !important/);
    assert.doesNotMatch(css.match(/\.authorization-emblem \{[^}]+\}/)[0], /opacity:\s*0/);
});

test('trial, renewal, decline and cancellation show their dates and permit refreshing',async()=>{
    const render=await resultRenderer();
    const a={...approvedAgreement,useTrial:true,trialEndsAt:'2026-10-06T23:00:00Z',nextChargeAt:'2026-10-06T23:00:00Z'};
    const trial=render({...a,state:'trialing'});
    assert.match(trial,/Prueba activa/); assert.match(trial,/Próxima renovación/);
    assert.match(trial,/Actualizar estado/); assert.doesNotMatch(trial,/sigue pendiente de vincular/);
    const paid=render({...a,state:'active',periodEndsAt:'2026-11-06T23:00:00Z'});
    assert.match(paid,/Suscripción activa/); assert.match(paid,/Próxima renovación/);
    assert.doesNotMatch(paid,/sigue pendiente de vincular/);
    const declined=render({...a,state:'past_due'});
    assert.match(declined,/Actualiza tu pago/); assert.doesNotMatch(declined,/account-authorization|Próxima renovación|sigue pendiente de vincular/);
    const canceled=render({...a,state:'canceled',canceledAt:'2026-09-30T00:00:00Z'});
    assert.match(canceled,/Renovación cancelada/); assert.match(canceled,/Acceso hasta/);
    assert.doesNotMatch(canceled,/Próxima renovación/);
});

test('a canceled trial resumes management until the server clock reaches its end',()=>{
    const a={state:'canceled',canceledAt:'2026-09-29T00:00:00Z',trialEndsAt:'2026-10-06T00:00:00Z',periodEndsAt:null};
    assert.equal(resumableAgreement([a],'2026-10-05T23:59:59Z'),a);
    assert.equal(resumableAgreement([a],'2026-10-06T00:00:00Z'),undefined);
    assert.equal(resumableAgreement([{...a,state:'revoked'}],'2026-10-05T23:59:59Z'),undefined);
    assert.throws(()=>resumableAgreement([a],'invalid'));
});
