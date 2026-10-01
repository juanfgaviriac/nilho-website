import { normalizeQuestion } from '../../foco/faq-matching.mjs';

// The full reviewed index grew with subscription terms; per-answer context stays capped at 8 KB.
export const FAQ_KNOWLEDGE_LIMIT = 65000;
export const FAQ_CONTEXT_LIMIT = 8000;
export const FAQ_SOURCE_LIMIT = 4;
const stopwords = new Set('a al algo ante como con cual cuales cuando cuanto cuanta cuantos cuantas de del desde donde el ella ellos en es esta este esto estos esa eso esas fue funciona funcionar ha hay hago la las le les lo los mas me mi mis muy no nos o para pero por porque puedo puede pueden que quien quiero se si sin sirve sobre su sus te tengo tiene tu tus un una unas unos uso usar y ya foco app'.split(' '));
// Small, explicit Spanish vocabulary; search expansion never approves an answer.
const groups = [
    ['envio','envios','entrega','entregas','despacho','llegar','llega','llegue','tarda','tardan','tardar','demora','demoran','demorarse','transportadora','guia','domicilio'],
    ['conexion','conectado','desconectado','desconectarme','conectarse','conectarme','conectar','conexiones','internet','wifi','red','offline','cobertura','senal','avion'],
    ['precio','precios','cuesta','cuestan','costar','costo','costos','vale','valen','valor','valores'],
    ['tarjeta','tarjetas'], ['iphone','iphones','telefono','telefonos','celular','celulares'],
    ['sesion','sesiones','enfocarme','enfoque'], ['rutina','rutinas','horario','horarios','programar','programada','programadas'],
    ['emergencia','emergencias','desbloqueo','desbloqueos','agotado','agotados','recargan'],
    ['devolucion','devoluciones','devolver','devolverlo','devuelvo','retracto','arrepenti','arrepiento','reembolso','reembolsar','reintegro'],
    ['garantia','defecto','defectos','defectuosa','defectuoso','danada','dano','rota'],
    ['compartir','compartida','compartirse','comparto','compartimos','varios'],
    ['eliminar','elimino','eliminacion','borrar','borro','borrado'],
    ['cuenta','cuentas'], ['dato','datos','informacion'], ['privacidad','privado','privados','personal','personales'],
    ['seleccion','seleccionadas','seleccionados','elegidas','elegidos','elegir','seleccionar'],
    ['permiso','permisos','autorizar','autorizacion'], ['leer','lectura','lee','escaneo','escanear','nfc'],
    ['pago','pagos','pagar','pagas','pague','pagado'], ['suscripcion','suscripciones','mensual','mensuales','mensualidad'],
    ['renovacion','renovaciones','renovar','renueva','renuevan'],
    ['prueba','probar','trial'], ['cancelar','cancelo','cancelacion','cancelada'],
    ['bloquear','bloquea','bloqueadas','bloqueados','bloqueo','bloqueos'],
    ['conservacion','conservan','conservamos','conservar','retencion','retienen','guardan'],
    ['recopilacion','recopilan','recopila','recopilar','recopilamos','recogen','recoger'],
    ['contacto','contactar','contactarlos','hablar','persona','humano','humana','equipo'],
];
// Search-only labels help find sections whose editorial headings are not literal.
// They do not enter the model context or create new facts.
const searchLabels = {
    'precios':'precio paquete combo una dos tres tarjetas',
    'privacidad-datos-de-uso':'recopilacion analitica estadisticas metricas datos de uso',
    'privacidad-en-el-servidor':'recopilacion datos cuenta servidor',
    'contacto':'contacto soporte',
    'faq-envio':'plazo envio entrega despacho tarda llegar',
    'faq-suscripcion':'mensualidad suscripcion pago unico solo una vez planes',
    'suscripciones-derechos':'retracto arrepenti arrepiento devolucion garantia defecto defectuosa quien paga transporte',
    'suscripciones-garantia-30-dias':'devolucion transporte regreso reembolso treinta dias',
    'faq-compatibilidad':'compatibilidad android samsung xiaomi huawei',
    'suscripciones-prueba':'prueba gratis siete dias activacion empieza inicio envio',
    'suscripciones-cancelacion':'cancelar renovacion borrar cuenta restaurar apple',
    'suscripciones-precios':'plan mensual trimestral anual precio apple wompi',
    'suscripciones-pagos':'rechazado falla cobro pago gracia reintento',
    'faq-privacidad':'actividad aplicaciones sitios contenido leer ver',
};
const vocabulary = new Map(groups.flatMap(group => group.map(word => [word, group[0]])));
const tokens = value => normalizeQuestion(value).split(/[^a-z0-9]+/).filter(word => word.length > 1 && !stopwords.has(word)).map(word => vocabulary.get(word) || word);
const indexes = new WeakMap();

function indexDocuments(documents) {
    if (indexes.has(documents)) return indexes.get(documents);
    const frequencies = new Map();
    const entries = documents.map(doc => {
        const heading = tokens(`${doc.title} ${doc.id} ${searchLabels[doc.id] || ''}`);
        const words = [...tokens(doc.text), ...heading, ...heading];
        const counts = new Map();
        for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
        for (const word of counts.keys()) frequencies.set(word, (frequencies.get(word) || 0) + 1);
        return {doc, counts, length:words.length};
    });
    const index = {entries, frequencies, averageLength:entries.reduce((sum, entry) => sum + entry.length, 0) / (entries.length || 1)};
    indexes.set(documents, index);
    return index;
}

// BM25-style lexical search, in memory. No embedding call, database, or query log.
export function retrieveKnowledge(question, documents) {
    const query = [...new Set(tokens(question))];
    if (!query.length) return [];
    const {entries, frequencies, averageLength} = indexDocuments(documents);
    const ranked = entries.map(entry => {
        let score = 0;
        const matches = new Map();
        for (const word of query) {
            const frequency = entry.counts.get(word) || 0;
            if (!frequency) continue;
            const inverseFrequency = Math.log(1 + (entries.length - frequencies.get(word) + 0.5) / (frequencies.get(word) + 0.5));
            const contribution = inverseFrequency * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * entry.length / (averageLength || 1)));
            score += contribution;
            matches.set(word, contribution);
        }
        return {doc:entry.doc, score, matches};
    }).filter(entry => entry.score > 0).sort((a,b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));
    const selected = [], covered = new Set();
    // Repeated legal sections must not crowd out the other half of a compound
    // question (for example, Android compatibility AND delivery time).
    const remainingScore = entry => [...entry.matches].reduce((sum, [word, score]) =>
        sum + score * (covered.has(word) ? 0.1 : 1), 0);
    while (ranked.length && selected.length < FAQ_SOURCE_LIMIT) {
        ranked.sort((a, b) => remainingScore(b) - remainingScore(a) || a.doc.id.localeCompare(b.doc.id));
        const {doc, matches} = ranked.shift();
        // Keep complete sections: never cut return-policy exceptions mid-sentence.
        const source = {id:doc.id, title:doc.title, url:doc.url, text:doc.text};
        if (JSON.stringify([...selected, source]).length <= FAQ_CONTEXT_LIMIT) {
            selected.push(source);
            for (const word of matches.keys()) covered.add(word);
        }
    }
    return selected;
}
