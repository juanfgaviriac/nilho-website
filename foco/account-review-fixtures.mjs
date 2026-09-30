// Fake, local-only visual fixtures. No requests, accounts, tokens or payment SDKs.
export const BILLING_REVIEW_CASES = [
  'authorize', 'payment', 'payment-trial', 'processing', 'awaiting-card', 'trial', 'active',
  'canceled', 'expired', 'revoked', 'declined', 'source-unknown', 'bank', 'replace-card',
  'replacement-pending', 'replacement-failed', 'payment-attention', 'retry', 'cancel-confirmation', 'consent', 'consent-trial', 'consent-existing',
];
export function billingReviewFixture(name) {
  if (!BILLING_REVIEW_CASES.includes(name)) return null;
  const future = '2099-12-29T00:00:00Z';
  const a = { id: 'visual-review', environment: 'sandbox', plan: 'annual', amountInCents: 11990000,
    initialInCents: 11990000, state: 'active', sourceState: 'available', initialPayment: 'approved',
    useTrial: false, hasCard: true, delivery: {}, periodEndsAt: future, nextChargeAt: future };
  const fixture = { agreement: a, planId: a.plan, useTrial: false, hasCard: true, view: 'proveedor', checkedAt: '2026-09-29T12:00:00Z' };
  if (['authorize','payment','payment-trial','processing','source-unknown','bank'].includes(name)) {
    Object.assign(a, {state:'awaiting_payment',initialPayment:'queued',periodEndsAt:null,nextChargeAt:null});
  }
  if (name === 'authorize') a.sourceState='new';
  if (name === 'payment-trial') Object.assign(a, {useTrial:true,hasCard:false,initialInCents:1000000});
  if (name === 'processing') a.initialPayment='pending';
  if (name === 'source-unknown') a.sourceState='unknown';
  if (name === 'bank') a.sourceState='verifying';
  if (name === 'awaiting-card') Object.assign(a, {state:'awaiting_card',hasCard:false,periodEndsAt:null,nextChargeAt:null});
  if (name === 'trial') Object.assign(a, {state:'trialing',useTrial:true,hasCard:false,periodEndsAt:null,trialEndsAt:future});
  if (['canceled','cancel-confirmation'].includes(name)) {
    if (name==='canceled') Object.assign(a,{state:'canceled',canceledAt:'2026-09-29T12:00:00Z',nextChargeAt:null});
    else fixture.cancelConfirm=true;
  }
  if (name === 'expired') Object.assign(a,{state:'canceled',canceledAt:'2026-09-28T12:00:00Z',periodEndsAt:'2026-09-28T12:00:00Z',nextChargeAt:null});
  if (name === 'revoked') Object.assign(a,{state:'revoked',initialPayment:'voided',periodEndsAt:null,nextChargeAt:null});
  if (name === 'declined') Object.assign(a,{state:'past_due',initialPayment:'declined',periodEndsAt:null,nextChargeAt:null});
  if (['payment-attention','retry','replace-card','replacement-pending','replacement-failed'].includes(name)) {
    Object.assign(a,{state:'past_due',nextChargeAt:null,graceEndsAt:future,latestPayment:{id:'fixture',state:'declined',amountInCents:11990000}});
    if (name==='retry') Object.assign(a,{canRetryPayment:true,sourceChange:{id:'fixture',state:'available'}});
    if (name==='replace-card') Object.assign(fixture,{view:'pago',replacing:true,acceptance:{presigned_acceptance:{permalink:'https://wompi.com/terms'},presigned_personal_data_auth:{permalink:'https://wompi.com/data'}}});
    if (name.startsWith('replacement-')) a.sourceChange={id:'fixture',state:name==='replacement-pending'?'verifying':'failed'};
  }
  if (name.startsWith('consent')) {
    Object.assign(fixture,{view:'pago',hasCard:name==='consent-existing',useTrial:name==='consent-trial',
      acceptance:{presigned_acceptance:{permalink:'https://wompi.com/terms'},presigned_personal_data_auth:{permalink:'https://wompi.com/data'}}});
  }
  return fixture;
}
