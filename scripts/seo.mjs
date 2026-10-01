import { FOCO_CHECKOUT } from '../foco/checkout-config.mjs';

const origin = 'https://getfoco.co';
const image = `${origin}/foco/assets/lifestyle/foco-desk-scene-v1.webp`;
const escape = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

export function structuredData(path, config = FOCO_CHECKOUT) {
    const organization = { '@type': 'Organization', '@id': `${origin}/#organization`, name: 'Foco', url: `${origin}/`,
        logo: `${origin}/foco/assets/favicon/android-chrome-512x512.png`,
        sameAs: ['https://www.instagram.com/getfoco.co/'], email: 'team@getfoco.co' };
    const graph = [];
    if (path === '') graph.push(organization, { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'Foco',
        url: `${origin}/`, inLanguage: 'es-CO', publisher: { '@id': organization['@id'] } });
    const labels = { 'comprar/': 'Comprar Foco', 'soporte/': 'Soporte', 'privacidad/': 'Privacidad de la app',
        'terminos/': 'Términos de la app', 'suscripciones/': 'Condiciones de suscripción', 'compra/': 'Condiciones de compra', 'compra/privacidad/': 'Privacidad de compras' };
    if (labels[path]) graph.push({ '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Foco', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: labels[path], item: `${origin}/${path}` },
    ] });
    return { '@context': 'https://schema.org', '@graph': graph };
}

export function renderSEO(html, path) {
    // Blog pages own their publication gate, canonical metadata and article schema.
    if (path === 'pago/' || path.startsWith('blog/')) return html;
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    if (!title || !description) throw new Error(`Missing search metadata: ${path}`);
    html = html.replace(/\s*<meta property="og:[^"]+"[^>]*>/g, '');
    const metadata = `
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta property="og:site_name" content="Foco">
    <meta property="og:locale" content="es_CO">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escape(title)}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${origin}/${path}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:width" content="1536">
    <meta property="og:image:height" content="1024">
    <meta property="og:image:alt" content="Tarjeta Foco junto a un iPhone con una sesión activa">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escape(title)}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
    <script type="application/ld+json">${JSON.stringify(structuredData(path)).replace(/</g, '\\u003c')}</script>
`;
    return html.replace('</head>', metadata + '</head>');
}
