import { normalizeQuestion } from '../../foco/faq-matching.mjs';

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
    ['emergencia','emergencias','desbloqueo','desbloqueos','agotado','agotados','renuevan','renovar','recargan'],
    ['devolucion','devoluciones','devolver','devolverlo','devuelvo','retracto','arrepenti','arrepiento','reembolso','reembolsar','reintegro'],
    ['garantia','defecto','defectos','defectuosa','defectuoso','danada','dano','rota'],
    ['compartir','compartida','compartirse','comparto','compartimos','varios'],
    ['eliminar','elimino','eliminacion','borrar','borro','borrado'],
    ['cuenta','cuentas'], ['dato','datos','informacion'], ['privacidad','privado','privados','personal','personales'],
    ['seleccion','seleccionadas','seleccionados','elegidas','elegidos','elegir','seleccionar'],
    ['permiso','permisos','autorizar','autorizacion'], ['leer','lectura','lee','escaneo','escanear','nfc'],
    ['pago','pagos','pagar','pagas','pague','pagado'], ['suscripcion','suscripciones','mensual','mensuales','mensualidad'],
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
    'faq-compatibilidad':'compatibilidad android samsung xiaomi huawei',
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
        for (const word of query) {
            const frequency = entry.counts.get(word) || 0;
            if (!frequency) continue;
            const inverseFrequency = Math.log(1 + (entries.length - frequencies.get(word) + 0.5) / (frequencies.get(word) + 0.5));
            score += inverseFrequency * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * entry.length / (averageLength || 1)));
        }
        return {doc:entry.doc, score};
    }).filter(entry => entry.score > 0).sort((a,b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));
    const selected = [];
    for (const {doc} of ranked) {
        // Keep complete sections: never cut return-policy exceptions mid-sentence.
        const source = {id:doc.id, title:doc.title, url:doc.url, text:doc.text};
        if (JSON.stringify([...selected, source]).length <= FAQ_CONTEXT_LIMIT) selected.push(source);
        if (selected.length === FAQ_SOURCE_LIMIT) break;
    }
    return selected;
}
