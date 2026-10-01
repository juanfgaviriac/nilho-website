import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildKnowledge, buildInstantAnswers} from '../scripts/faq.mjs';
import {findInstantAnswer} from '../foco/faq-matching.mjs';
import {retrieveKnowledge, FAQ_CONTEXT_LIMIT} from '../server/foco/faq-retrieval.mjs';

const docs = await buildKnowledge();
const instant = buildInstantAnswers(docs);
const source = id => docs.find(d => d.id === id).text;

test('subscription prices distinguish channel and full billing period', () => {
    const prices = source('suscripciones-precios');
    for (const amount of ['14.900','39.900','119.900','17.500','45.900','137.900']) assert.ok(prices.includes(amount));
    for (const phrase of ['COP', 'Cada periodo se cobra completo']) assert.ok(prices.includes(phrase));
    const card = source('suscripciones-tarjeta');
    assert.match(card, /10\.000 COP en el mensual/);
    assert.match(card, /incluido al pagar tres meses o un año/);
    assert.match(card, /Apple.*no incluyen tarjeta ni envío/);
    assert.match(source('precios'), /14\.900/);
    assert.doesNotMatch(source('precios'), /100\.000|110\.000|200\.000|250\.000|oferta de pago único/i);
});

test('canceling the trial keeps the card; claiming the refund guarantee requires a return', () => {
    const answer = findInstantAnswer('¿Me cobran la tarjeta si cancelo la prueba?', instant).answer;
    assert.match(answer, /conservar la tarjeta sin devolverla ni pagar un cargo adicional/);
    assert.match(answer, /no devuelve automáticamente el envío/);
    assert.match(answer, /sí debes devolver la tarjeta/);
    const guarantee = source('suscripciones-garantia-30-dias');
    assert.match(guarantee, /30 días calendario siguientes a la entrega/);
    assert.match(guarantee, /no a las renovaciones posteriores ni a las compras Apple/);
    assert.match(guarantee, /primer periodo.*envío inicial/);
    assert.match(guarantee, /solo pagaste el envío.*reembolsamos ese importe/);
});

test('trial starts on verified linking and payment, while Apple has no introductory trial', () => {
    const trial = source('suscripciones-prueba');
    assert.match(trial, /vinculación verificada.*una vez aprobado el pago del envío/);
    assert.match(trial, /Comprar o recibir la tarjeta no inicia/);
    assert.match(trial, /Apple no incluyen una prueba gratuita/);
    assert.match(trial, /no reinicia la prueba/);
    assert.match(source('suscripciones-activacion'), /si el pago se confirma después del vínculo/);
});

test('seller and privacy roles distinguish the individual Wompi merchant from Nilho on Apple', () => {
    const seller = source('suscripciones-vendedor');
    assert.match(seller, /Compras web.*Juan Felipe Gaviria Campo, NIT 1001368555/);
    assert.match(seller, /Compras en App Store.*Nilho S\.A\.S\., NIT 902003133-7/);
    assert.match(source('suscripciones-datos'), /vendedor Juan Felipe Gaviria Campo trata/);
    assert.match(source('suscripciones-datos'), /Nilho S\.A\.S\., operador de la app, recibe/);
});

test('cancellation, restore and emergency access do not create extra renewals or entitlements', () => {
    const canceled = source('suscripciones-cancelacion');
    assert.match(canceled, /Restaurar una compra no vuelve a activar/);
    assert.match(canceled, /eliminar la cuenta Foco no cancela una suscripción de Apple/);
    const offline = source('suscripciones-sin-conexion');
    assert.match(offline, /72 horas desde el final del periodo confirmado/);
    assert.match(offline, /No se extienden pruebas gratuitas, cancelaciones o revocaciones/);
    assert.match(offline, /Terminar una sesión y usar un desbloqueo de emergencia disponible siguen siendo posibles/);
    const grace = findInstantAnswer('¿Apple tiene tres días de gracia?', instant).answer;
    assert.match(grace, /no son una promesa de gracia para compras Apple/);
});

for (const [question, expected] of [
    ['¿Cuándo empieza la prueba, con la entrega o al vincular?', 'suscripciones-prueba'],
    ['¿Quién me vende por Wompi y quién por Apple?', 'suscripciones-vendedor'],
    ['¿Si cancelo durante la prueba cuánto me cobran por quedarme con la tarjeta?', 'faq-devolucion-prueba'],
    ['¿Mi acceso de por vida cambia con los nuevos precios?', 'suscripciones-alcance'],
    ['¿Qué pasa si no pasa el cobro de mi suscripción?', 'suscripciones-pagos'],
]) test(`subscription FAQ retrieves reviewed evidence: ${question}`, () => {
    const found = retrieveKnowledge(question, docs);
    assert.ok(found.some(d => d.id === expected), found.map(d => d.id).join(','));
    assert.ok(JSON.stringify(found).length <= FAQ_CONTEXT_LIMIT);
});

test('client can render subscription citations and both builds publish the canonical route', () => {
    const client = readFileSync(new URL('../foco/faq.js', import.meta.url), 'utf8');
    assert.match(client, /terminos\|suscripciones/);
    for (const file of ['build-site.mjs', 'build-vercel.mjs']) {
        assert.match(readFileSync(new URL(`../scripts/${file}`, import.meta.url), 'utf8'), /'suscripciones\/'/);
    }
});
