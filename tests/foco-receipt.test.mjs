import test from 'node:test';
import assert from 'node:assert/strict';
import { orderReceipt, sendOrderReceipt } from '../server/foco/receipt.mjs';
import { getOffer, FOCO_CHECKOUT } from '../foco/checkout-config.mjs';
const fixture = (quantity = 2) => ({
    order: { id: 'test-order', quantity, offer: getOffer(quantity), seller: FOCO_CHECKOUT.commerce.seller, transactionId: 'test-transaction', amountInCents: getOffer(quantity).amountInCents,
        consent: { acceptedAt: '2026-09-21T22:00:00.000Z', termsVersion: '2026-09-21.1', privacyVersion: '2026-09-21.1' } },
    transaction: { id: 'test-transaction', status: 'APPROVED', currency: 'COP', amount_in_cents: getOffer(quantity).amountInCents,
        customer_email: 'buyer@example.com', customer_data: { full_name: 'Comprador de prueba' } },
});
for (const [quantity, total] of [[1,'110.000'],[2,'200.000'],[3,'250.000']]) {
    test(`receipt ${quantity}: approved amount and conditional discount`, () => {
        const receipt = orderReceipt(fixture(quantity));
        assert.ok(receipt.text.includes(total));
        assert.equal(receipt.text.includes('Descuento del pack'), quantity === 3);
        assert.equal(receipt.html.includes('Descuento del pack'), quantity === 3);
        assert.match(receipt.text, /Solo para iPhone/);
        assert.match(receipt.text, /no es una factura electrónica/);
        assert.doesNotMatch(receipt.text, /\bIVA\b|exento/i);
        assert.match(receipt.html, /lang="es"/);
    });
}
test('rejects unapproved, mismatched and unconsented receipts', () => {
    for (const change of [f=>{f.transaction.status='PENDING'}, f=>{f.transaction.currency='USD'},
        f=>{f.transaction.id='other'}, f=>{f.order.amountInCents=1}, f=>{f.transaction.amount_in_cents=1},
        f=>{delete f.order.consent}, f=>{f.order.consent.acceptedAt='invalid'},
        f=>{f.transaction.customer_email='buyer@example.com\r\nBcc: other@example.com'}]) {
        const data=fixture(); change(data); assert.throws(()=>orderReceipt(data));
    }
});
test('customer text is escaped and cannot inject receipt markup',()=>{
    const data=fixture(); data.transaction.customer_data.full_name='<img src=x onerror="bad()">';
    const receipt=orderReceipt(data); assert.doesNotMatch(receipt.html,/<img src=x/); assert.match(receipt.html,/&lt;img/);
});
test('uses a deterministic Resend key and fixed sender; test makes no network request',async()=>{
    const requests=[];
    const fetchImpl=async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({id:'email-test-id'}),{status:200})};
    assert.deepEqual(await sendOrderReceipt({...fixture(),apiKey:'re_test_fixture',fetchImpl}),{emailId:'email-test-id'});
    assert.equal(requests[0].url,'https://api.resend.com/emails');
    assert.equal(requests[0].options.headers['Idempotency-Key'],'foco-receipt-v1/test-transaction');
    assert.equal(JSON.parse(requests[0].options.body).reply_to,'team@getfoco.co');
    await assert.rejects(sendOrderReceipt({...fixture(),apiKey:'re_test_fixture',from:'Other <other@elsewhere.example>',fetchImpl}));
    assert.equal(requests.length,1);
});
test('fails without sending if receipt is invalid and hides provider errors',async()=>{
    let called=false; const data=fixture(); data.transaction.status='DECLINED';
    await assert.rejects(sendOrderReceipt({...data,apiKey:'re_test_fixture',fetchImpl:async()=>{called=true}}));
    assert.equal(called,false);
    await assert.rejects(sendOrderReceipt({...fixture(),apiKey:'re_test_fixture',fetchImpl:async()=>new Response('private recipient data',{status:429})}),{message:'Resend request failed (429).'});
});
test('a receipt uses its stored price and seller even when the catalog changes',()=>{
    const data=fixture();
    data.order.offer={...data.order.offer,subtotal:180000,total:180000,amountInCents:18000000};
    data.order.amountInCents=18000000; data.transaction.amount_in_cents=18000000;
    data.order.seller={...data.order.seller,name:'Vendedor original'};
    const receipt=orderReceipt(data);
    assert.match(receipt.text,/180\.000/); assert.match(receipt.text,/Vendedor original/);
    assert.match(receipt.html,/versiones\/2026-09-21\.1\/terms.html/);
});
test('sandbox receipts are clearly identified in subject, HTML and plain text',()=>{
    const data=fixture(); data.order.environment='test'; const receipt=orderReceipt(data);
    assert.match(receipt.subject,/^\[PRUEBA\]/);
    assert.match(receipt.html,/NO ES UNA COMPRA/); assert.match(receipt.text,/No hubo dinero real/);
    data.order.environment='prod'; assert.doesNotMatch(orderReceipt(data).subject,/\[PRUEBA\]/);
});
