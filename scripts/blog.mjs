import { blogArticles, blogSources } from './blog-content.mjs';
import { FOCO_CHECKOUT, getOffer, formatCOP } from '../foco/checkout-config.mjs';

const origin = 'https://getfoco.co';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const date = value => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const articlePath = article => `/blog/${article.slug}/`;
const author = { '@type': 'Organization', name: 'Equipo Foco', url: `${origin}/blog/criterio-editorial/` };
const mark = '<span class="foco-mark foco-mark--small" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const imagePath = cover => cover === 'desk' ? '/foco/assets/lifestyle/foco-desk-scene-v1.webp' : `/foco/assets/features/${cover}-1200-v2.webp`;

function picture(cover, { hero = false, caption = false } = {}) {
    const desk = cover === 'desk';
    const small = desk ? '/foco/assets/lifestyle/foco-desk-scene-960-v1.webp' : `/foco/assets/features/${cover}-600-v2.webp`;
    const alt = desk ? 'Tarjeta Foco y un iPhone con una sesión activa sobre un escritorio' : ({ modos: 'Pantalla de Foco con modos para distintos momentos del día', rutinas: 'Pantalla de Foco con rutinas de enfoque programadas', analytics: 'Pantalla Mi tiempo con un ejemplo del registro de sesiones de Foco' }[cover]);
    return `<figure class="editorial-image editorial-image--${desk ? 'desk' : 'app'}"><img src="${imagePath(cover)}" srcset="${small} ${desk ? 960 : 600}w, ${imagePath(cover)} ${desk ? 1536 : 1200}w" sizes="${desk ? '(max-width: 760px) 100vw, 650px' : '(max-width: 760px) 85vw, 355px'}" width="${desk ? 1536 : 1200}" height="${desk ? 1024 : 1600}" alt="${alt}" loading="${hero ? 'eager' : 'lazy'}" decoding="async"${hero ? ' fetchpriority="high"' : ''}>${caption ? `<figcaption>${desk ? 'Visual de producto de Foco.' : 'Interfaz real de Foco presentada en un render de producto. Datos de ejemplo; la versión puede variar.'}</figcaption>` : ''}</figure>`;
}

function table(caption, headings, rows) {
    return `<div class="editorial-table" role="region" aria-label="${escape(caption)}" tabindex="0"><table><caption>${escape(caption)}</caption><thead><tr>${headings.map(text => `<th scope="col">${escape(text)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((text, i) => i === 0 ? `<th scope="row">${escape(text)}</th>` : `<td>${escape(text)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function priceRows(config = FOCO_CHECKOUT) {
    return [1, 2, 3].map(quantity => {
        const offer = getOffer(quantity, config);
        return { quantity, product: offer.subtotal - offer.discount, shipping: offer.shipping, total: offer.total, perCard: offer.total / quantity };
    });
}

function chart({ id, title, subtitle, rows, max, format, unit, note, source }) {
    return `<figure class="editorial-chart" aria-labelledby="${id}-title"><figcaption><span class="editorial-eyebrow">Los datos, en contexto</span><h3 id="${id}-title">${title}</h3><p>${subtitle}</p></figcaption><div class="chart-bars" aria-hidden="true">${rows.map(({ label, value }) => `<div class="chart-row"><div class="chart-label"><span>${escape(label)}</span><strong>${escape(format(value))}</strong></div><div class="chart-track"><span class="chart-bar" style="width:${(value / max * 100).toFixed(3)}%"></span></div></div>`).join('')}<div class="chart-scale"><span>0</span><span>${escape(format(max))}</span></div></div><details class="chart-data"><summary>Ver datos y contexto</summary>${table(title, ['Grupo', unit], rows.map(row => [row.label, format(row.value)]))}</details><p class="chart-note">${note}</p><p class="chart-source">${source}</p></figure>`;
}

function visual(name, config) {
    const prices = priceRows(config);
    const offer = getOffer(1, config);
    if (['modos', 'rutinas', 'analytics'].includes(name)) return picture(name, { caption: true });
    if (name === 'who') return chart({
        id: 'uso-problematico', title: 'Señales de uso problemático de redes', subtitle: 'Adolescentes en la encuesta HBSC. Porcentaje de participantes.',
        rows: [{ label: '2018', value: 7 }, { label: '2022', value: 11 }], max: 15, format: value => `${value}%`, unit: 'Porcentaje',
        note: 'Encuesta de 2022: cerca de 280.000 jóvenes de 11, 13 y 15 años, en 44 países y regiones de Europa, Asia central y Canadá. No son datos de Colombia ni diagnósticos individuales. Escala desde cero.',
        source: 'Fuente: <a href="#fuente-who">OMS Europa / HBSC</a>. Publicado en 2024; observaciones de 2018 y 2022.',
    });
    if (name === 'price-table') return table('Precio de Foco por cantidad · COP, antes de cupones', ['Cantidad', 'Tarjetas', 'Envío', 'Total'], prices.map(row => [`${row.quantity} ${row.quantity === 1 ? 'tarjeta' : 'tarjetas'}`, formatCOP(row.product), formatCOP(row.shipping), formatCOP(row.total)]));
    if (name === 'price-chart') return chart({
        id: 'costo-unitario', title: 'Costo por tarjeta, con envío', subtitle: 'Total del paquete dividido entre su cantidad. Pesos colombianos, antes de cupones.',
        rows: prices.map(row => ({ label: `${row.quantity} ${row.quantity === 1 ? 'tarjeta' : 'tarjetas'}`, value: row.perCard })),
        max: Math.ceil(Math.max(...prices.map(row => row.perCard)) / 20000) * 20000,
        format: value => `${Number.isInteger(value) ? '' : '≈ '}${formatCOP(Math.round(value))}`, unit: 'COP por tarjeta',
        note: 'Cálculo: (tarjetas + envío − descuento del paquete) ÷ cantidad. Valores unitarios redondeados al peso. No es el precio de venta de una tarjeta suelta. Escala desde cero.',
        source: 'Fuente: <a href="#fuente-focoPrice">configuración de compra de Foco</a>. El checkout confirma disponibilidad, cupones y total final.',
    });
    if (name === 'screen-time-table') return table('Dos herramientas, distintas decisiones', ['Qué comparas', 'Tiempo en pantalla', 'Foco'], [
        ['Costo adicional', 'Incluido en el iPhone', `${formatCOP(offer.subtotal - offer.discount)} COP por tarjeta; envío según cantidad`],
        ['Organización', 'Límites y horarios; opciones según la versión de iOS', 'Modos, sesiones con duración o Hasta volver y rutinas'],
        ['Qué mide', 'Uso del dispositivo y las apps', 'Tiempo de sesiones de Foco, no uso total del teléfono'],
        ['Objeto físico', 'No lo requiere', 'Tarjeta para cerrar Hasta volver o terminar antes'],
        ['Buen punto de partida', 'Ver tu uso y probar límites sin comprar', 'Añadir un paso físico a una decisión de enfoque'],
    ]);
    if (name === 'brick-table') return table('Foco y Brick · información consultada el 23 de septiembre de 2026', ['Qué comparas', 'Foco', 'Brick'], [
        ['Precio anunciado', `${formatCOP(offer.subtotal - offer.discount)} COP por tarjeta`, 'US$59 por dispositivo'],
        ['Envío a Colombia', `${formatCOP(offer.shipping)} COP para una tarjeta`, 'Confirmar disponibilidad y total en su checkout'],
        ['Compatibilidad anunciada', 'iPhone con iOS 17.6 o posterior', 'iOS 17 o posterior; Android 12 o posterior'],
        ['Formato', 'Tarjeta física reutilizable', 'Dispositivo con imán y base antideslizante'],
        ['Modelo actual de pago', 'Pago único, sin suscripción', 'Pago único; app incluida sin cargos recurrentes'],
    ]);
    throw new Error(`Unknown blog visual: ${name}`);
}

function bodyHTML(html, config, available) {
    const offer = getOffer(1, config);
    const values = { focoUnit: formatCOP(offer.subtotal - offer.discount), focoShipping: formatCOP(offer.shipping), focoTotal: formatCOP(offer.total) };
    return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        if (!(key in values)) throw new Error(`Unknown blog value: ${key}`);
        return escape(values[key]);
    }).replace(/<!-- visual:([\w-]+) -->/g, (_, name) => visual(name, config))
        // Publishing one article must never expose links to unpublished drafts.
        .replace(/<a href="\/blog\/([\w-]+)\/">([^<]+)<\/a>/g, (link, slug, label) => available.some(article => article.slug === slug) ? link : label);
}

function breadcrumbs(path, title) {
    return { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Foco', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}/blog/` },
        ...(path === 'blog/' ? [] : [{ '@type': 'ListItem', position: 3, name: title, item: `${origin}/${path}` }]),
    ] };
}

function shell({ title, description, path, content, preview, graph, publishedAt, type = 'website' }) {
    const image = `${origin}${imagePath('desk')}`;
    return `<!DOCTYPE html><html lang="es-CO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f7f7f4"><title>${escape(title)} — Foco</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${preview ? 'noindex, follow' : 'index, follow, max-image-preview:large'}"><link rel="canonical" href="${origin}/${path}"><link rel="preload" href="/foco/assets/fonts/manrope-latin-v1.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/foco/fonts.css"><link rel="stylesheet" href="/foco/landing.css"><link rel="stylesheet" href="/foco/blog.css"><meta property="og:site_name" content="Foco"><meta property="og:locale" content="es_CO"><meta property="og:type" content="${type}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${origin}/${path}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1536"><meta property="og:image:height" content="1024"><meta property="og:image:alt" content="Tarjeta Foco y un iPhone con una sesión activa"><meta name="twitter:card" content="summary_large_image">${publishedAt ? `<meta property="article:published_time" content="${publishedAt}">` : ''}<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': graph })}</script></head><body class="editorial-site">${preview ? '<aside class="editorial-preview" aria-label="Estado editorial">Vista previa editorial · Borradores no publicados</aside>' : ''}<a class="editorial-skip" href="#contenido">Saltar al contenido</a><header class="site-header"><a href="/" class="brand" aria-label="Foco, inicio">${mark}</a><nav class="editorial-nav" aria-label="Navegación principal"><a href="/blog/"${path === 'blog/' ? ' aria-current="page"' : ''}>El blog</a><a href="/comprar/">Conoce Foco</a></nav></header>${content}<footer class="site-footer"></footer></body></html>`;
}

function readMinutes(article) {
    const words = [article.answer, ...article.sections.map(section => section.html)].join(' ').replace(/<[^>]+>/g, ' ').split(/\s+/).length;
    return Math.max(3, Math.round(words / 200));
}

export function renderArticle(article, { preview = false, articles = blogArticles, config = FOCO_CHECKOUT } = {}) {
    const path = `blog/${article.slug}/`;
    const available = articles.filter(item => preview || item.status === 'published');
    const render = html => bodyHTML(html, config, available);
    const related = article.related.map(slug => available.find(item => item.slug === slug)).filter(Boolean);
    const publicationDate = article.status === 'published' ? article.publishedAt : undefined;
    const schema = { '@type': 'BlogPosting', '@id': `${origin}/${path}#article`, headline: article.title, description: article.description, mainEntityOfPage: `${origin}/${path}`, url: `${origin}/${path}`, image: `${origin}${imagePath(article.cover)}`, author, publisher: { '@type': 'Organization', name: 'Foco', url: `${origin}/` }, inLanguage: 'es-CO', citation: article.sources.map(id => blogSources[id].url), ...(publicationDate ? { datePublished: publicationDate, dateModified: article.modifiedAt || publicationDate } : { dateCreated: article.preparedAt }) };
    return shell({ title: article.title, description: article.description, path, preview, type: 'article', publishedAt: publicationDate, graph: [schema, breadcrumbs(path, article.title)], content: `
<main class="article-page" id="contenido"><header class="article-header"><a class="article-back" href="/blog/">El blog de Foco</a><div class="editorial-eyebrow">${article.category}<span aria-hidden="true"> / </span>${readMinutes(article)} min de lectura</div><h1>${article.title}</h1><p class="article-dek">${article.dek}</p><p class="article-meta"><a href="/blog/criterio-editorial/">Por el Equipo Foco</a><span>${publicationDate ? 'Publicado' : 'Borrador preparado'} el <time datetime="${publicationDate || article.preparedAt}">${date(publicationDate || article.preparedAt)}</time>${article.modifiedAt && article.modifiedAt !== publicationDate ? ` · Actualizado el <time datetime="${article.modifiedAt}">${date(article.modifiedAt)}</time>` : ''}</span></p></header>
<div class="article-layout"><aside class="article-sidebar"><nav aria-label="En este artículo"><p class="editorial-eyebrow">En esta lectura</p><ol>${article.sections.map(section => `<li><a href="#${section.id}">${section.title}</a></li>`).join('')}<li><a href="#fuentes">Fuentes y contexto</a></li></ol></nav></aside><article class="article-content" aria-label="${escape(article.title)}"><div class="article-answer"><span class="editorial-eyebrow">La respuesta corta</span><p>${render(article.answer)}</p></div>${article.medical ? '<p class="article-health-note">Información general, no un diagnóstico ni un tratamiento. Foco es una herramienta de enfoque.</p>' : ''}${article.sections.map(section => `<section id="${section.id}"><h2>${section.title}</h2>${render(section.html)}</section>`).join('')}<section class="article-questions" aria-labelledby="preguntas"><h2 id="preguntas">Un par de dudas más</h2>${article.questions.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${render(a)}</p></details>`).join('')}</section><section class="article-sources" id="fuentes"><h2>Fuentes y contexto</h2><p>Lo escribe el equipo que crea Foco. Distinguimos las funciones de nuestro producto de la evidencia externa. <a href="/blog/criterio-editorial/">Nuestro criterio editorial</a>.</p><ol>${article.sources.map(id => `<li id="fuente-${id}"><a href="${blogSources[id].url}">${escape(blogSources[id].title)}</a><span>Consultado el ${date(blogSources[id].accessed)}.</span></li>`).join('')}</ol></section><aside class="article-cta"><p class="editorial-eyebrow">Conoce Foco</p><h2>Tu teléfono sigue siendo útil.<br>El scroll puede esperar.</h2><p>Una tarjeta y una app para pausar lo que te distrae. Para iPhone. Pago único, sin suscripción.</p><a href="/comprar/">Ver la tarjeta Foco</a></aside></article></div>${related.length ? `<section class="article-related" aria-labelledby="seguir-leyendo"><p class="editorial-eyebrow" id="seguir-leyendo">Sigue por aquí</p><div>${related.map(item => `<a href="${articlePath(item)}"><span>${item.category}</span><h2>${item.title}</h2></a>`).join('')}</div></section>` : ''}</main>` });
}

function renderIndex(articles, preview) {
    const [lead, ...rest] = articles;
    const title = 'Menos scroll. Más vida. El blog de Foco';
    return shell({ title, description: 'Ideas prácticas para usar menos el celular, entender tus hábitos y elegir herramientas de enfoque. Guías en español, datos con contexto y comparaciones claras.', path: 'blog/', preview, graph: [{ '@type': 'CollectionPage', name: title, url: `${origin}/blog/`, inLanguage: 'es-CO', hasPart: articles.map(article => ({ '@type': 'BlogPosting', headline: article.title, url: `${origin}${articlePath(article)}` })) }, breadcrumbs('blog/', title)], content: `
<main class="blog-page" id="contenido"><header class="blog-masthead"><p class="editorial-eyebrow">El blog de Foco / Para volver a lo tuyo</p><h1>Menos scroll.<br><span>Más vida.</span></h1><p>Ideas que merecen tu atención.<br>Para que el celular ocupe su lugar, no todo tu día.</p></header><section class="blog-featured" aria-labelledby="lectura-destacada"><div><p class="editorial-eyebrow">Empieza por aquí · ${lead.category}</p><h2 id="lectura-destacada"><a href="${articlePath(lead)}">${lead.title}</a></h2><p>${lead.dek}</p><a class="editorial-read" href="${articlePath(lead)}">Leer la guía <span> / ${readMinutes(lead)} min</span></a></div><a class="blog-featured-image" href="${articlePath(lead)}" aria-label="${escape(lead.title)}">${picture(lead.cover, { hero: true })}</a></section><section class="story-index" aria-labelledby="todas-las-lecturas"><div class="story-index-heading"><h2 id="todas-las-lecturas">Para seguir pensando.</h2><span class="editorial-eyebrow">${String(articles.length).padStart(2, '0')} lecturas</span></div>${rest.map(article => `<article class="story-row"><span class="story-number" aria-hidden="true">${article.number}</span><div><p class="editorial-eyebrow">${article.category}</p><h3><a href="${articlePath(article)}">${article.title}</a></h3><p>${article.dek}</p><span class="story-reading-time">${readMinutes(article)} min de lectura</span></div><a class="story-thumbnail" href="${articlePath(article)}" aria-label="${escape(article.title)}">${picture(article.cover)}</a></article>`).join('')}</section><aside class="editorial-principle"><h2>Menos promesas.<br>Más contexto.</h2><div><p>Somos el equipo de Foco. Escribimos sobre lo que construimos, pero también sobre cuándo no necesitas comprar nada. Con fuentes a la vista y sin convertir un dato en una promesa.</p><a href="/blog/criterio-editorial/">Así hacemos este blog</a></div></aside></main>` });
}

function renderMethodology(preview) {
    const title = 'Nuestro criterio editorial';
    return shell({ title, description: 'Quién escribe el blog de Foco, cómo contrastamos fuentes y precios, y qué límites tienen nuestras guías de bienestar digital y comparaciones.', path: 'blog/criterio-editorial/', preview, graph: [breadcrumbs('blog/criterio-editorial/', title)], content: `<main class="editorial-policy" id="contenido"><a class="article-back" href="/blog/">El blog de Foco</a><p class="editorial-eyebrow">Transparencia editorial</p><h1>Menos promesas.<br>Más contexto.</h1><h2>Quién escribe</h2><p>El Equipo Foco crea estas guías y vende la tarjeta Foco. Esa relación comercial está a la vista. Las comparaciones no son reseñas independientes ni pruebas de productos que no hayamos realizado.</p><h2>Fuentes y límites</h2><p>Preferimos documentación del fabricante, publicaciones de investigación y organismos reconocidos. Indicamos población, fecha y alcance cuando mostramos datos. Un estudio sobre adolescentes de otros países no describe automáticamente a adultos colombianos. Una asociación no demuestra una causa.</p><p>Las guías de hábitos son información general. No diagnosticamos ni presentamos Foco como tratamiento. Una revisión editorial de una fuente no equivale a una revisión clínica del artículo.</p><h2>Precios que se puedan comprobar</h2><p>Los precios de Foco se generan desde la configuración del checkout al construir el sitio. Los precios externos llevan una fecha de consulta y pueden cambiar. No inventamos tipos de cambio, costos de importación ni descuentos. El total final de una compra se confirma en su checkout.</p><h2>Cómo usamos la IA</h2><p>Usamos asistencia de IA para investigar, estructurar borradores y desarrollar visualizaciones. La IA puede equivocarse: los borradores requieren revisión editorial antes de publicarse. No atribuimos textos a expertos inexistentes ni convertimos una respuesta generada en evidencia.</p><h2>Capturas, datos y actualizaciones</h2><p>Las imágenes de la app utilizan capturas reales dentro de renders de producto; pueden mostrar versiones anteriores y datos de ejemplo. No son resultados de clientes. Los gráficos incluyen sus fuentes, unidades y contexto.</p><p>La fecha de publicación corresponde a la publicación real. Solo añadimos una fecha de actualización cuando cambia el contenido, no para aparentar frescura.</p><h2>Correcciones</h2><p>Si encuentras un error, una función que cambió o un precio desactualizado, escríbenos a <a href="mailto:team@getfoco.co">team@getfoco.co</a> con el enlace y el detalle. Revisaremos la fuente antes de corregirlo.</p></main>` });
}

function visibleArticles(articles, preview) {
    for (const article of articles) {
        if (article.status === 'published' && !/^\d{4}-\d{2}-\d{2}$/.test(article.publishedAt || '')) throw new Error(`Missing publication date: ${article.slug}`);
    }
    return articles.filter(article => preview || article.status === 'published');
}

export function blogPages({ articles = blogArticles, preview = false, config = FOCO_CHECKOUT } = {}) {
    const visible = visibleArticles(articles, preview);
    if (!visible.length) return new Map();
    return new Map([
        ['blog/', renderIndex(visible, preview)],
        ['blog/criterio-editorial/', renderMethodology(preview)],
        ...visible.map(article => [`blog/${article.slug}/`, renderArticle(article, { preview, articles: visible, config })]),
    ]);
}

export function blogSitemapPaths(articles = blogArticles) {
    const published = visibleArticles(articles, false);
    return published.length ? ['blog/', 'blog/criterio-editorial/', ...published.map(article => `blog/${article.slug}/`)] : [];
}
