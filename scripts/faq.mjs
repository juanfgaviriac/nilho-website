import { FAQ_KNOWLEDGE_LIMIT } from '../server/foco/faq-retrieval.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { renderCommercePage } from './policies.mjs';

const root = new URL('../', import.meta.url);
const escape = text => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const commonQuestions = [
    ['¿Cómo me ayuda Foco a usar menos el celular?', 'Elige las apps que te distraen, acerca tu tarjeta y empieza un rato para ti. Deja la tarjeta lejos del teléfono para poner distancia entre tú y el scroll. Tú decides cuándo enfocarte y por cuánto tiempo.'],
    ['¿Funciona con mi iPhone?', 'Sí, si tiene iOS 17.6 o posterior. La app te guía para conectar tu tarjeta y activar Tiempo en Pantalla. Foco no está disponible para Android.'],
    ['¿Qué incluye mi plan?', 'Todos tus modos y rutinas, estadísticas para ver tu progreso y una tarjeta Foco al pedir la tuya en la web. Tú eliges una suscripción mensual, trimestral o anual: las funciones son las mismas en todos los planes.'],
    ['¿Puedo usar Foco con alguien más?', 'Sí. Puedes compartir la misma tarjeta con tu pareja o con otras personas que tengan iPhone. Cada persona usa su propia cuenta y su plan, con sus estadísticas, rachas y desbloqueos de emergencia.'],
    ['¿Y si necesito terminar una sesión antes?', 'Acerca la tarjeta con la que empezaste la sesión. Si no la tienes a mano, cuentas con tres desbloqueos de emergencia por cuenta; no se recargan automáticamente. Las sesiones con duración terminan solas al cumplirse el tiempo.'],
    ['¿En cuánto tiempo llega la tarjeta?', 'Enviamos en Colombia. Tu tarjeta llega en 3 a 10 días hábiles desde el pago aprobado, incluido el despacho. Te compartimos la guía para seguirla. Tu prueba o primer periodo empieza al vincular la tarjeta en la app, así que el tiempo de envío no consume tu acceso.'],
    ['¿Mi actividad es privada?', 'Sí. Foco no ve qué apps y sitios seleccionas ni lo que haces dentro de ellos. Tú eliges si compartes datos de uso de Foco y puedes cambiarlo en Ajustes.'],
    ['¿Cuánto cuesta empezar?', 'En la web: $14.900 COP al mes, $39.900 COP cada 3 meses o $119.900 COP al año. Cada periodo se paga completo. Al pedir tu tarjeta, el envío cuesta $10.000 COP en el mensual y está incluido en trimestral y anual sin prueba. Si ya tienes tarjeta, no pagas envío.'],
    ['¿Puedo probarlo antes de pagar el plan?', 'Sí. Al pedir una tarjeta nueva en la web puedes elegir siete días gratis si aún no has usado la prueba. Pagas solo $10.000 COP de envío. La prueba empieza cuando vinculas la tarjeta en la app. Al terminar se cobra el plan elegido, salvo que canceles antes.'],
    ['¿Tengo que devolver la tarjeta si cancelo la prueba?', 'No. Si cancelas durante tus siete días de prueba, te quedas con la tarjeta sin cargos extra. El envío no se reembolsa automáticamente al cancelar.'],
    ['¿Puedo cancelar cuando quiera?', 'Sí. Para planes web, entra a Mi cuenta y elige Cancelar suscripción antes del siguiente cobro. Conservas el acceso hasta que termine tu periodo o prueba. Si compraste en Apple, elige Gestionar suscripción en Apple desde la app Foco.'],
];
const faqIds = ['funcionamiento', 'compatibilidad', 'suscripcion', 'compartir', 'sesiones', 'envio', 'privacidad', 'precios-planes', 'prueba', 'devolucion-prueba', 'cancelacion'];
// Short buyer questions on the homepage; detailed answers remain available on request.
export const salesFAQIds = ['funcionamiento', 'suscripcion', 'precios-planes', 'prueba', 'compatibilidad', 'envio', 'privacidad', 'cancelacion'];
const detailSources = { compartir: '/soporte/#tarjeta', sesiones: '/soporte/#sesiones', 'devolucion-prueba': '/suscripciones/#prueba' };
const aliases = [
    ['¿Qué es Foco y cómo funciona?', '¿Qué es Foco?', '¿Cómo funciona Foco?', '¿Para qué sirve Foco?'],
    ['¿Funciona con mi teléfono?', '¿Funciona en Android?', '¿Funciona con Android?', '¿Funciona Foco en Android?', '¿Sirve para Android?', '¿Qué iOS necesito?', '¿Qué teléfonos son compatibles?'],
    ['¿Tengo que pagar una suscripción?', '¿Hay que pagar mensualidad?', '¿Tiene suscripción?', '¿Hay que pagar cada mes?', '¿Foco tiene suscripción?', '¿Es un pago único?'],
    ['¿Puedo compartir la tarjeta?', '¿Puedo compartir mi tarjeta?', '¿La tarjeta se puede compartir entre dos personas?', '¿Puedo usar la misma tarjeta en dos iPhone?'],
    ['¿Cómo termino una sesión? ¿Y si pierdo la tarjeta?', '¿Cómo termino una sesión?', '¿Cómo finalizo una sesión?', '¿Qué pasa si pierdo la tarjeta?'],
    ['¿Cuánto tarda en llegar?', '¿Cuánto tarda el envío?', '¿Cuánto se demora el envío?', '¿En cuántos días llega?'],
    ['¿Foco puede ver lo que hago en otras apps?', '¿Foco ve mis apps?', '¿Foco sabe qué aplicaciones uso?'],
    ['¿Cuánto cuestan los planes?', '¿Cuánto cuesta la suscripción?', '¿Cuánto cuesta Foco al mes?', '¿Cuáles son los precios de los planes?', '¿Cuánto cuesta el plan anual?', '¿Cuánto cuesta el plan trimestral?'],
    ['¿Cuándo empiezan los siete días gratis?', '¿Cuándo empieza la prueba gratis?', '¿La prueba empieza al comprar?', '¿Puedo probar Foco gratis?'],
    ['¿Qué pasa con la tarjeta si cancelo la prueba?', '¿Tengo que devolver la tarjeta si cancelo?', '¿Me cobran la tarjeta si cancelo la prueba?', '¿Puedo quedarme con la tarjeta?'],
    ['¿Cómo cancelo una suscripción?', '¿Cómo cancelo Foco?', '¿Cómo cancelo la renovación?'],
];

export function buildInstantAnswers(documents) {
    const fromDocument = (id, questions) => {
        const doc = documents.find(entry => entry.id === id);
        if (!doc || doc.text.length > 1400) throw new Error(`Invalid instant FAQ source: ${id}`);
        return {id, questions, answer:doc.text.replaceAll(' → ', ' / '), sources:[{title:doc.title, url:doc.url}]};
    };
    const entries = commonQuestions.map(([question], i) => fromDocument(`faq-${faqIds[i]}`, [question, ...aliases[i]]));
    entries.push(fromDocument('soporte-conexion', ['¿Funciona sin internet?', '¿Funciona Foco sin internet?', '¿Puedo usar Foco sin internet?', '¿Puedo usarlo sin internet?', '¿Necesita wifi?', '¿Funciona sin wifi?', '¿Funciona sin conexión?']));
    entries.push(fromDocument('terminos-emergencias', ['¿Cuántos desbloqueos de emergencia tengo?', '¿Se renuevan cada mes los desbloqueos de emergencia?', '¿Los desbloqueos de emergencia se renuevan?', '¿Se recargan los desbloqueos de emergencia?']));
    entries.push(fromDocument('suscripciones-precios', ['¿Cuánto cuesta Foco en Apple?', '¿Cuánto cuestan los planes de Apple?']));
    entries.push(fromDocument('suscripciones-prueba', ['¿Apple tiene prueba gratis?']));
    entries.push(fromDocument('suscripciones-cancelacion', ['¿Eliminar la cuenta cancela Apple?', '¿Restaurar compras reactiva la renovación?']));
    entries.push(fromDocument('suscripciones-tarjeta', ['¿Los planes incluyen tarjeta?', '¿Cuánto cuesta el envío con suscripción?', '¿Apple incluye tarjeta?']));
    entries.push(fromDocument('suscripciones-garantia-30-dias', ['¿Cómo funciona la garantía de 30 días del nuevo plan?', '¿Qué devuelven con la garantía de 30 días?', '¿Reembolsan las renovaciones con la garantía de 30 días?']));
    entries.push(fromDocument('suscripciones-vendedor', ['¿Quién vende Foco por Wompi?', '¿Quién vende Foco por Apple?', '¿Quién es el vendedor de la suscripción?']));
    entries.push(fromDocument('suscripciones-pagos', ['¿Qué pasa si falla una renovación?', '¿Vuelven a intentar un pago rechazado?', '¿Apple tiene tres días de gracia?']));
    entries.push(fromDocument('suscripciones-alcance', ['¿Conservo mi acceso de por vida?', '¿Los nuevos precios afectan mi acceso de por vida?']));
    entries.find(entry => entry.id === 'faq-precios-planes').questions.push('¿Cuánto cuesta una tarjeta?', 'Precio de una tarjeta', '¿Cuánto cuesta una tarjeta con envío?');
    return entries;
}

export function renderFAQ(html, instantAnswers = []) {
    return html.replace(/<!-- foco-faq:start -->[\s\S]*?<!-- foco-faq:end -->/g, `<!-- foco-faq:start -->
        <section class="faq-section faq-section--assistant" id="faq" aria-labelledby="faq-title">
            <div class="faq-heading">
                <h2 id="faq-title">Menos dudas.<br>Más foco.</h2>
                <p>Si te queda una duda, pregúntanos abajo.</p>
                <a href="/foco/soporte/#contact-title">¿Prefieres hablar con alguien?</a>
            </div>
            <div class="faq-body">
                <script type="application/json" data-faq-instant>${JSON.stringify(instantAnswers).replace(/</g, '\\u003c')}</script>
                <div class="faq-list">${salesFAQIds.map(id => commonQuestions[faqIds.indexOf(id)]).map(([question, answer]) => `
                    <details><summary>${escape(question)}</summary><p>${escape(answer)}</p></details>`).join('')}
                </div>
                <form class="faq-ask" data-faq-form hidden>
                    <label for="faq-question" class="sr-only">Pregunta lo que quieras sobre Foco</label>
                    <div class="faq-input-row">
                        <input id="faq-question" name="question" type="text" placeholder="Pregunta cualquier cosa…" maxlength="500" minlength="3" required autocomplete="off" enterkeyhint="send" aria-describedby="faq-notice">
                        <button class="faq-send" type="submit" aria-label="Enviar pregunta">Enviar</button>
                        <button class="faq-cancel" type="button" hidden>Cancelar</button>
                    </div>
                    <p class="faq-notice" id="faq-notice" hidden><a href="/foco/terminos/#asistente-ia">Respuestas con IA</a>, puede equivocarse</p>
                    <p class="faq-status" role="status" aria-live="polite" data-faq-status></p>
                    <div class="faq-answer" data-faq-answer hidden tabindex="-1" aria-label="Respuesta del asistente">
                        <p data-faq-text></p>
                        <nav class="faq-sources" aria-label="Fuentes de la respuesta" data-faq-sources></nav>
                    </div>
                </form>
                <noscript><p class="faq-notice">Para preguntar al asistente necesitas JavaScript. También puedes escribir a <a href="mailto:team@getfoco.co">team@getfoco.co</a>.</p></noscript>
            </div>
        </section>
        <!-- foco-faq:end -->`);
}

// Index only reviewed public sections, never repository documents, archives or user data.
const pages = [
    ['soporte', 'soporte/', 'Soporte'],
    ['compras-privacidad', 'compra/privacidad/', 'Privacidad de compras'],
    ['suscripciones', 'suscripciones/', 'Condiciones de suscripción'],
    ['privacidad', 'privacidad/', 'Privacidad de la app'], ['terminos', 'terminos/', 'Términos de la app'],
];
const plainText = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
export async function buildKnowledge() {
    const documents = [];
    for (const [prefix, path, label] of pages) {
        let html = await readFile(new URL(`foco/${path}index.html`, root), 'utf8');
        if (path.startsWith('compra/')) html = renderCommercePage(html);
        const sections = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)]
            .filter(([, id]) => id !== 'faq');
        if (!sections.length) throw new Error(`Missing public knowledge sections: ${path}`);
        for (const [, id, body] of sections) {
            const title = plainText(body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] || label);
            const content = body.replace(/<span\b[^>]*class="commerce-number"[^>]*>[\s\S]*?<\/span>/g, '').replace(/<h2[^>]*>[\s\S]*?<\/h2>/g, '');
            documents.push({id:`${prefix}-${id}`, title:`${label}: ${title}`, url:`/${path}#${id}`, text:plainText(content)});
        }
    }
    const prices = documents.find(doc => doc.id === 'suscripciones-precios');
    const shipping = documents.find(doc => doc.id === 'suscripciones-tarjeta');
    documents.push({id:'precios', title:'Planes Foco: precios y envío', url:'/suscripciones/#precios', text:prices.text + ' ' + shipping.text});
    documents.push({id:'contacto', title:'Habla con el equipo', url:'/soporte/#contact-title', text:'team@getfoco.co. WhatsApp +57 302 773 8407. Lunes a viernes, 9 a. m.–5 p. m., hora de Colombia, excepto festivos. Primera respuesta en un día hábil. El asistente no puede consultar pedidos, cuentas, pagos ni saldos personales, hacer reembolsos, reponer tarjetas o desbloquear sesiones.'});
    commonQuestions.forEach(([question, answer], i) => documents.push({id:`faq-${faqIds[i]}`, title:`Preguntas frecuentes: ${question}`, url:detailSources[faqIds[i]] || '/#faq', text:answer}));
    if (JSON.stringify(documents).length > FAQ_KNOWLEDGE_LIMIT) throw new Error('FAQ knowledge exceeds the reviewed input budget.');
    return documents;
}
export async function writeKnowledge() {
    const documents = await buildKnowledge();
    const knowledge = {documents, instantAnswers:buildInstantAnswers(documents)};
    await writeFile(new URL('server/foco/faq-knowledge.json', root), JSON.stringify(knowledge));
    return knowledge;
}
