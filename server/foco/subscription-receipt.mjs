import { timingSafeEqual } from 'node:crypto';
import { CommerceError } from './commerce.mjs';
import { FOCO_MERCHANT_EMAIL, sendPreparedEmail } from './email.mjs';

const fail = (status, code) => { throw new CommerceError(status, code); };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const escape = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => `$${new Intl.NumberFormat('es-CO').format(cents / 100)} COP`;
const plans = { monthly: 'Plan mensual', quarterly: 'Plan trimestral', annual: 'Plan anual' };
const periods = { monthly: 'al mes', quarterly: 'cada 3 meses', annual: 'al año' };
const date = value => new Intl.DateTimeFormat('es-CO', {dateStyle:'long',timeZone:'America/Bogota'}).format(new Date(value));

export function authorizeSubscriptionReceipt(request, env) {
    const key = env.FOCO_SUBSCRIPTION_RECEIPT_SECRET;
    if (!key || key.length < 32 || env.VERCEL_ENV !== 'production') fail(503, 'receipt_unavailable');
    const actual = Buffer.from(request.headers.get('authorization') || ''), expected = Buffer.from(`Bearer ${key}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) fail(401, 'unauthorized');
}

export function subscriptionMessages(p) {
    if (!p || p.environment !== 'production' || !uuid.test(p.reference) || !uuid.test(p.agreementId)
        || !/^[A-Za-z0-9-]{1,100}$/.test(p.transactionId) || !Object.hasOwn(plans, p.plan)
        || !Number.isSafeInteger(p.amountInCents) || p.amountInCents <= 0
        || !Number.isSafeInteger(p.renewalInCents) || p.renewalInCents <= 0
        || !Number.isSafeInteger(p.cycle) || p.cycle < 0 || typeof p.useTrial !== 'boolean'
        || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(p.email || '') || p.email.length > 254
        || p.termsVersion !== 'foco-web-subscription-2026-09-30.1'
        || !Number.isFinite(Date.parse(p.paidAt))
        || (p.periodEnd !== null && !Number.isFinite(Date.parse(p.periodEnd)))) fail(400, 'invalid_receipt');
    if (p.delivery !== null) {
        if (p.cycle !== 0 || typeof p.delivery !== 'object' || !p.delivery
            || !['name','phone','department','city','address','detail'].every(k => typeof p.delivery[k] === 'string'
                && p.delivery[k].length <= 160 && !/[\x00-\x1f\x7f]/.test(p.delivery[k]))
            || !p.delivery.name || !p.delivery.address) fail(400, 'invalid_delivery');
    }
    const trialShipping = p.useTrial && p.cycle === 0;
    const rows = [['Plan', plans[p.plan]], ['Pago confirmado', money(p.amountInCents)],
        ['Concepto', trialShipping ? 'Envío de tu tarjeta · prueba de 7 días' : p.cycle ? 'Renovación' : 'Primer periodo y envío aplicable'],
        ['Fecha', date(p.paidAt)], ['Referencia', p.reference], ['Transacción Wompi', p.transactionId]];
    const access = trialShipping ? 'Tus siete días gratis empiezan al vincular la tarjeta en la app.'
        : p.periodEnd ? `Periodo pagado hasta el ${date(p.periodEnd)}.` : 'Tu primer periodo empieza al vincular la tarjeta en la app.';
    const renewal = `Precio de renovación: ${money(p.renewalInCents)} ${periods[p.plan]}. Consulta su fecha y cancela futuras renovaciones en Mi cuenta.`;
    const shipping = p.delivery ? 'Entregamos tu tarjeta en Colombia en 3 a 10 días hábiles desde el pago aprobado. Te enviamos la guía y el nombre de la transportadora al despachar.' : '';
    const policy = 'https://getfoco.co/foco/suscripciones/versiones/2026-09-30.1/terms.html';
    const seller = 'Juan Felipe Gaviria Campo · NIT 1001368555. Comprobante de pago; no es una factura electrónica.';
    const build = (to, subject, lines) => ({to,subject,text:lines.join('\n\n'),
        html:`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f7f7f4;color:#101110;font-family:Arial,sans-serif"><main style="max-width:560px;margin:auto;padding:32px 24px"><p style="letter-spacing:5px;font-weight:700">FOCO</p><h1 style="font-size:32px;line-height:1.15">${escape(subject)}</h1>${lines.map(t=>`<p style="font-size:15px;line-height:1.7;white-space:pre-line;overflow-wrap:anywhere">${escape(t)}</p>`).join('')}<p><a href="https://getfoco.co/cuenta/" style="color:#2d7470">Mi cuenta</a> · <a href="${policy}" style="color:#2d7470">Condiciones aceptadas</a></p></main></body></html>`});
    const details = rows.map(([k,v])=>`${k}: ${v}`).join('\n');
    const receipt = build(p.email,'Tu pago Foco está confirmado',[details,access,renewal,shipping,`Condiciones aceptadas: ${policy}`,'Ayuda: team@getfoco.co',seller].filter(Boolean));
    const dispatch = p.delivery ? `Preparar una tarjeta Foco para:\n${p.delivery.name}\n${p.delivery.address}\n${p.delivery.detail}\n${p.delivery.city}, ${p.delivery.department}\nTeléfono: ${p.delivery.phone}\nCorreo: ${p.email}\n\nAntes de despachar, verifica el pago en Wompi y que no exista un despacho, reversión o reembolso previo. Registra la guía y envíala al comprador. Cancelar una prueba no añade un cobro por la tarjeta.` : 'No despachar una tarjeta: este pago corresponde a una renovación o a una cuenta con tarjeta.';
    const merchant = build(FOCO_MERCHANT_EMAIL,p.delivery?'Foco · tarjeta pendiente de despacho':'Foco · pago de suscripción',[details,dispatch,`Acuerdo: ${p.agreementId}`,'Revisar pago: https://comercios.wompi.co/transactions']);
    return {receipt,merchant};
}

export async function deliverSubscriptionReceipts(p, {store, env, fetcher=fetch, now=()=>new Date(), send=sendPreparedEmail}) {
    const messages=subscriptionMessages(p);
    const deliver=async kind=>{
        const key=`${kind==='receipt'?'subscriptionreceipts':'subscriptionalerts'}/${p.reference}`;
        let current=await store.getWithMetadata(key,{type:'json'});
        if(!current){await store.setJSON(key,{state:'pending',createdAt:now().toISOString(),payload:messages[kind]}, {onlyIfNew:true});current=await store.getWithMetadata(key,{type:'json'});}
        if(!current)fail(503,'receipt_retry_required');
        if(current.data.state==='sent')return false;
        if(current.data.state==='manual_review')return true;
        if(env.FOCO_EMAIL_ENABLED!=='true')fail(503,'email_disabled');
        const age=now().getTime()-Date.parse(current.data.createdAt);
        if(!Number.isFinite(age)||age>=23*3600000){
            if(!(await store.setJSON(key,{...current.data,state:'manual_review'},{onlyIfMatch:current.etag})).modified)fail(503,'receipt_retry_required');
            return true;
        }
        if(Date.parse(current.data.leaseUntil||'')>now().getTime())fail(503,'receipt_in_progress');
        const lease=await store.setJSON(key,{...current.data,state:'sending',leaseUntil:new Date(now().getTime()+120000).toISOString()},{onlyIfMatch:current.etag});
        if(!lease.modified)fail(503,'receipt_in_progress');
        let sent;
        try {sent=await send({message:current.data.payload,transactionId:`subscription-${p.reference}`,kind,apiKey:env.RESEND_API_KEY,fetchImpl:fetcher});}
        catch {await store.setJSON(key,{...current.data,state:'pending',leaseUntil:null},{onlyIfMatch:lease.etag});fail(503,'receipt_retry_required');}
        if(!(await store.setJSON(key,{...current.data,state:'sent',emailId:sent.emailId,sentAt:now().toISOString(),leaseUntil:null},{onlyIfMatch:lease.etag})).modified)fail(503,'receipt_retry_required');
        return false;
    };
    const receipt=await deliver('receipt'),merchant=await deliver('merchant');
    return {delivered:!receipt&&!merchant,reviewRequired:receipt||merchant};
}
