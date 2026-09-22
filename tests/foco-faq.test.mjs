import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildKnowledge, renderFAQ, commonQuestions } from '../scripts/faq.mjs';
import { FAQ_MODEL, faqRateLimit, makeFAQHandler, answerQuestion, validateAnswer, questionGuard } from '../server/foco/faq.mjs';

function memoryStore() {
    let value, version = 0;
    return {
        getWithMetadata:async key => { assert.equal(key, 'faq/budget'); return value ? {data:structuredClone(value), etag:String(version)} : null; },
        setJSON:async (key, data, options) => {
            assert.equal(key, 'faq/budget');
            if ((options.onlyIfNew && value) || (options.onlyIfMatch && options.onlyIfMatch !== String(version))) return {modified:false};
            value = structuredClone(data); version++; return {modified:true};
        },
    };
}
const request = (question = '¿Funciona en Android?', {ip='192.0.2.1', origin='https://getfoco.co', method='POST', body} = {}) => new Request('https://getfoco.co/api/foco/faq', {
    method, headers:{origin, 'content-type':'application/json', 'x-forwarded-for':ip},
    ...(method === 'POST' ? {body:body ?? JSON.stringify({question})} : {}),
});
const docs = [{id:'compatibilidad', title:'Compatibilidad', url:'/soporte/#empezar', text:'iPhone con iOS 17.6. No Android.'}];
const goodOutput = {answer:'Solo funciona en iPhone con iOS 17.6 o posterior, no en Android.', sourceIds:['compatibilidad'], supported:true};
const fixture = (overrides = {}) => {
    const store = memoryStore(); let calls = 0;
    const handler = makeFAQHandler({env:{FOCO_FAQ_ENABLED:'true', FOCO_FAQ_RATE_SECRET:'test-only-secret', VERCEL_ENV:'production'},
        loadDocuments:async () => docs, makeStore:() => store,
        generate:async () => { calls++; return {output:goodOutput}; }, ...overrides});
    return {handler, calls:() => calls};
};

test('knowledge is public, sourced, bounded, current and uses actual checkout prices', async () => {
    const documents = await buildKnowledge();
    assert.ok(documents.length >= 40);
    assert.ok(JSON.stringify(documents).length < 50000);
    assert.equal(new Set(documents.map(d => d.id)).size, documents.length);
    for (const doc of documents) {
        assert.ok(doc.text.length > 20);
        const [path, fragment] = doc.url.split('#');
        const html = renderFAQ(readFileSync(new URL(`../foco${path}index.html`, import.meta.url), 'utf8'));
        if (fragment) assert.ok(html.includes(`id="${fragment}"`), doc.url);
    }
    assert.match(documents.find(d => d.id === 'precios').text, /110\.000/);
    assert.match(documents.find(d => d.id === 'soporte-sesiones').text, /tres desbloqueos/);
    assert.doesNotMatch(JSON.stringify(documents), /WOMPI_PRIVATE_KEY|ANALYTICS_READ_TOKEN|availableCards/);
});

test('homepage and support share accessible, no-JS FAQs without changing other sections', () => {
    for (const path of ['index.html', 'soporte/index.html']) {
        const source = readFileSync(new URL(`../foco/${path}`, import.meta.url), 'utf8');
        const rendered = renderFAQ(source);
        assert.equal(renderFAQ(rendered), rendered);
        for (const [question] of commonQuestions) assert.ok(rendered.includes(question));
        assert.match(rendered, /label for="faq-question"/);
        assert.match(rendered, /maxlength="500"/);
        assert.match(rendered, /aria-live="polite"/);
        assert.match(rendered, /<label for="faq-question" class="sr-only">/);
        assert.match(rendered, /placeholder="Pregunta cualquier cosa…"/);
        assert.match(rendered, /aria-label="Enviar pregunta">Enviar<\/button>/);
        assert.match(rendered, /<a href="\/foco\/terminos\/#asistente-ia">Respuestas con IA<\/a>, puede equivocarse/);
        assert.match(rendered, /id="faq-notice" hidden/);
        assert.doesNotMatch(rendered, /Todo claro|Las respuestas cortas, aquí/);
        assert.match(rendered, /<p>Si te queda una duda, pregúntanos abajo\.<\/p>/);
        assert.doesNotMatch(rendered, /Cómo se usa tu pregunta|faq-privacy|faq-human|faq-answer-label/);
        assert.equal((rendered.match(/id="faq-title"/g) || []).length, 1);
    }
});

test('AI disclosure lives in the terms and remains part of the sourced knowledge', async () => {
    const terms = readFileSync(new URL('../foco/terminos/index.html', import.meta.url), 'utf8');
    assert.match(terms, /href="#asistente-ia"/);
    const disclosure = (await buildKnowledge()).find(doc => doc.id === 'terminos-asistente-ia');
    assert.equal(disclosure.url, '/terminos/#asistente-ia');
    for (const text of ['Vercel AI Gateway e Inception', 'fuera de Colombia', 'No incluyas datos personales',
        'No guardamos una conversación', 'identificador seudónimo', 'team@getfoco.co']) {
        assert.ok(disclosure.text.includes(text));
    }
});

test('daily global quota stops at 100 and resets next UTC day without retaining old visitors', async () => {
    const store = memoryStore(), now = 100 * 86400000;
    for (let i=0; i<100; i++) await faqRateLimit(request(undefined,{ip:`192.0.2.${i}`}), store, 'secret', now);
    await assert.rejects(faqRateLimit(request(undefined,{ip:'192.0.2.200'}), store, 'secret', now), {status:429});
    assert.equal((await store.getWithMetadata('faq/budget')).data.total, 100);
    await faqRateLimit(request(), store, 'secret', now + 86400000);
    const data = (await store.getWithMetadata('faq/budget')).data;
    assert.equal(data.total, 1); assert.equal(Object.keys(data.visitors).length, 1);
    assert.doesNotMatch(JSON.stringify(data), /192\.0\.2/);
});

test('per-visitor caps are 3/minute and 10/day; concurrent calls cannot overshoot', async () => {
    const store = memoryStore(), now = 100 * 86400000;
    const first = await Promise.allSettled(Array.from({length:12}, () => faqRateLimit(request(), store, 'secret', now)));
    assert.equal(first.filter(r => r.status === 'fulfilled').length, 3);
    for (let i=3; i<10; i++) await faqRateLimit(request(), store, 'secret', now + i * 60000);
    await assert.rejects(faqRateLimit(request(), store, 'secret', now + 600000), {status:429});
});

test('global concurrency cannot overshoot the last remaining request', async () => {
    const store = memoryStore(), now = 100 * 86400000;
    for (let i=0; i<99; i++) await faqRateLimit(request(undefined,{ip:`192.0.2.${i}`}), store, 'secret', now);
    const result = await Promise.allSettled(Array.from({length:8}, (_, i) => faqRateLimit(request(undefined,{ip:`198.51.100.${i}`}), store, 'secret', now)));
    assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
});

test('API rejects bad origins, bodies, methods and disabled configuration before model calls', async () => {
    const {handler, calls} = fixture();
    for (const [req, expected] of [[request('hola',{origin:'https://evil.example'}),403], [request('hola',{method:'GET'}),405],
        [request('a'),400], [request('a'.repeat(501)),400], [request('hola',{body:'not-json'}),400],
        [request('hola',{body:' '.repeat(2049)}),413], [request('hola',{body:JSON.stringify({question:'hola', model:'other'})}),400]]) {
        assert.equal((await handler(req)).status, expected);
    }
    assert.equal(calls(),0);
    assert.equal((await fixture({env:{}}).handler(request())).status,503);
});

test('personal details and order actions are handled without sending text to a provider', async () => {
    const {handler, calls} = fixture();
    for (const question of ['Mi correo es sample@example.test', 'El código es 1234567890', 'https://example.test/secret', '¿Dónde está mi pedido?', 'Cancela mi pedido']) {
        assert.ok(questionGuard(question));
        const response = await handler(request(question));
        assert.equal(response.status, 200);
        assert.match((await response.json()).sources[0].url, /soporte/);
    }
    assert.equal(calls(), 0);
    assert.equal(questionGuard('¿Cómo elimino mi cuenta?'), null);
});

test('a successful request uses one capped, non-logging model call with only curated knowledge', async () => {
    let captured;
    const result = await answerQuestion('¿Funciona en Android?', docs, undefined, async options => {captured=options; return {output:goodOutput};});
    assert.equal(captured.model, FAQ_MODEL);
    assert.equal(captured.maxRetries,0); assert.equal(captured.maxOutputTokens,500);
    assert.equal(captured.timeout,20000); assert.equal(captured.telemetry.isEnabled,false);
    assert.deepEqual(captured.providerOptions.gateway.only, ['inception']);
    assert.equal(captured.tools,undefined);
    assert.ok(captured.system.includes(docs[0].text));
    assert.equal(result.sources[0].url, docs[0].url);
    assert.equal((await fixture().handler(request())).status,200);
});

test('unknowns are handed off; invented sources, invalid answers and provider failures fail closed', async () => {
    assert.match(validateAnswer({...goodOutput,supported:false}, docs).answer, /No tengo información suficiente/);
    assert.match(validateAnswer({...goodOutput,sourceIds:[]}, docs).answer, /No tengo información suficiente/);
    assert.throws(() => validateAnswer({...goodOutput,sourceIds:['evil']}, docs));
    assert.throws(() => validateAnswer({...goodOutput,answer:'x'.repeat(1401)}, docs));
    assert.throws(() => validateAnswer({...goodOutput,supported:'true'}, docs));
    const unavailable = fixture({generate:async () => {throw new Error('private provider content');}});
    const response = await unavailable.handler(request());
    assert.equal(response.status,503); assert.doesNotMatch(await response.text(), /private provider content/);
    const limited = fixture({generate:async () => {throw Object.assign(new Error('provider limit'), {statusCode:429});}});
    assert.equal((await limited.handler(request())).status,429);
    const outage = fixture({makeStore:() => {throw new Error('storage down');}});
    assert.equal((await outage.handler(request())).status,503); assert.equal(outage.calls(),0);
});

test('client renders text and allowlisted source URLs, with no history or model HTML', () => {
    const js = readFileSync(new URL('../foco/faq.js', import.meta.url), 'utf8');
    assert.match(js, /text\.textContent = data.answer/);
    assert.doesNotMatch(js, /innerHTML|localStorage|sessionStorage/);
    assert.match(js, /controller\.abort/);
});
