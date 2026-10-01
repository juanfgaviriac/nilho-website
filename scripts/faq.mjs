import { FAQ_KNOWLEDGE_LIMIT } from '../server/foco/faq-retrieval.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { renderCommercePage } from './policies.mjs';

const root = new URL('../', import.meta.url);
const escape = text => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const commonQuestions = [
    ['¿Qué es Foco y cómo funciona?', 'Una tarjeta física y una app para iPhone. Eliges las apps y sitios que quieres pausar, acercas la tarjeta y empiezas tu sesión. Deja la tarjeta lejos del teléfono: volver a tus distracciones deja de ser un gesto automático.'],
    ['¿Funciona con mi teléfono?', 'Foco funciona solo con iPhone con iOS 17.6 o posterior. Necesitas una cuenta Foco, una tarjeta válida y autorizar Tiempo en Pantalla. No es compatible con Android.'],
    ['¿Tengo que pagar una suscripción?', 'Foco tiene planes mensuales, trimestrales y anuales. Si tu cuenta ya tiene acceso de por vida, lo conservas sin suscripción. Las compras de pago único mantienen las condiciones que aceptaste.'],
    ['¿Puedo compartir la tarjeta?', 'Sí. Una misma tarjeta puede usarse en varios iPhone, cada uno con su propia cuenta de Foco. Compartir la tarjeta no transfiere la suscripción ni el acceso de por vida: cada cuenta necesita su propio acceso. El historial, las rachas y el saldo de emergencias se separan por cuenta.'],
    ['¿Cómo termino una sesión? ¿Y si pierdo la tarjeta?', 'Si elegiste una duración, la sesión termina al cumplirse el tiempo. En Hasta volver, o para terminar antes, escanea la tarjeta vinculada a esa sesión. También tienes tres desbloqueos de emergencia por cuenta: no se renuevan automáticamente. Si los agotaste, escríbenos para revisar tu caso.'],
    ['¿Cuánto tarda en llegar?', 'Enviamos en Colombia desde Bogotá. La entrega tarda de 3 a 10 días hábiles desde el pago aprobado; ese plazo ya incluye los 1–2 días hábiles de despacho. Te enviamos la guía por WhatsApp.'],
    ['¿Foco puede ver lo que hago en otras apps?', 'No. Foco no conoce los nombres de las apps y sitios que seleccionas ni tu actividad dentro de ellos. Compartir datos de uso de Foco es opcional y puedes desactivarlo en Ajustes → Datos de uso.'],
    ['¿Cuánto cuestan los planes?', 'Precios en Colombia: web, $14.900 COP al mes, $39.900 COP cada 3 meses o $119.900 COP al año; Apple, $17.500, $45.900 o $137.900 COP, respectivamente. Cada periodo se paga completo. La web incluye una tarjeta por cuenta elegible: sin prueba, envío de $10.000 COP en mensual e incluido en trimestral/anual; con prueba, $10.000 COP en cualquier plan. Usar tu tarjeta actual no tiene envío. Apple no incluye tarjeta ni envío.'],
    ['¿Cuándo empiezan los siete días gratis?', 'En la oferta web, al vincular por primera vez la tarjeta en la app, una vez aprobado el pago de $10.000 COP de envío. Comprar o recibir la tarjeta no inicia la prueba. Solo aplica al pedir una tarjeta nueva y no haber usado la prueba; no se reinicia al escanear otra vez. Si no cancelas, al terminar se cobra el plan elegido. La prueba gratuita no aplica a Apple.'],
    ['¿Qué pasa con la tarjeta si cancelo la prueba?', 'En la oferta web, si cancelas durante los siete días de prueba, puedes conservar la tarjeta sin devolverla ni pagar un cargo adicional. Cancelar no devuelve automáticamente el envío. Si solicitas la garantía de devolución de 30 días de la compra inicial, sí debes devolver la tarjeta para recibir el reembolso del primer periodo cobrado y el envío; el transporte de regreso corre por tu cuenta salvo defecto o error de entrega.'],
    ['¿Cómo cancelo una suscripción?', 'Para los planes web: Mi cuenta / Cancelar suscripción. Para compras Apple: Mi cuenta / Gestionar suscripción en Apple, o Configuración del iPhone / tu nombre / Suscripciones / Foco. Cancelar conserva el periodo pagado y evita renovaciones futuras. Restaurar no reactiva la renovación. Borrar Foco o su cuenta no cancela una suscripción Apple.'],
];
const faqIds = ['funcionamiento', 'compatibilidad', 'suscripcion', 'compartir', 'sesiones', 'envio', 'privacidad', 'precios-planes', 'prueba', 'devolucion-prueba', 'cancelacion'];
const aliases = [
    ['¿Qué es Foco?', '¿Cómo funciona Foco?', '¿Para qué sirve Foco?'],
    ['¿Funciona en Android?', '¿Funciona con Android?', '¿Funciona Foco en Android?', '¿Sirve para Android?', '¿Qué iOS necesito?', '¿Qué teléfonos son compatibles?'],
    ['¿Hay que pagar mensualidad?', '¿Tiene suscripción?', '¿Hay que pagar cada mes?', '¿Foco tiene suscripción?', '¿Es un pago único?'],
    ['¿Puedo compartir mi tarjeta?', '¿La tarjeta se puede compartir entre dos personas?', '¿Puedo usar la misma tarjeta en dos iPhone?'],
    ['¿Cómo termino una sesión?', '¿Cómo finalizo una sesión?', '¿Qué pasa si pierdo la tarjeta?'],
    ['¿Cuánto tarda el envío?', '¿Cuánto se demora el envío?', '¿En cuántos días llega?'],
    ['¿Foco ve mis apps?', '¿Foco sabe qué aplicaciones uso?'],
    ['¿Cuánto cuesta la suscripción?', '¿Cuánto cuesta Foco al mes?', '¿Cuáles son los precios de los planes?', '¿Cuánto cuesta el plan anual?', '¿Cuánto cuesta el plan trimestral?'],
    ['¿Cuándo empieza la prueba gratis?', '¿La prueba empieza al comprar?', '¿Puedo probar Foco gratis?', '¿Apple tiene prueba gratis?'],
    ['¿Tengo que devolver la tarjeta si cancelo?', '¿Me cobran la tarjeta si cancelo la prueba?', '¿Puedo quedarme con la tarjeta?'],
    ['¿Cómo cancelo Foco?', '¿Cómo cancelo la renovación?', '¿Eliminar la cuenta cancela Apple?', '¿Restaurar compras reactiva la renovación?'],
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
                <div class="faq-list">${commonQuestions.map(([question, answer]) => `
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
    commonQuestions.forEach(([question, answer], i) => documents.push({id:`faq-${faqIds[i]}`, title:`Preguntas frecuentes: ${question}`, url:'/#faq', text:answer}));
    if (JSON.stringify(documents).length > FAQ_KNOWLEDGE_LIMIT) throw new Error('FAQ knowledge exceeds the reviewed input budget.');
    return documents;
}
export async function writeKnowledge() {
    const documents = await buildKnowledge();
    const knowledge = {documents, instantAnswers:buildInstantAnswers(documents)};
    await writeFile(new URL('server/foco/faq-knowledge.json', root), JSON.stringify(knowledge));
    return knowledge;
}
