import { mkdir, writeFile } from 'node:fs/promises';
import { renderSharedFooter } from './shared-footer.mjs';
import { renderPlanSelection } from '../foco/account-plans.mjs';

const mark = '<span class="foco-mark foco-mark--small" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
export function accountPage({ review = false, purchase = false } = {}) {
    return `<!doctype html><html lang="es-CO"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#f7f7f4"><meta name="robots" content="noindex, nofollow">
    <meta name="referrer" content="no-referrer"><title>${purchase ? 'Elige tu plan Foco' : 'Tu cuenta Foco'} — Vuelve a lo tuyo</title>
    <link rel="icon" href="/foco/assets/favicon/favicon.ico"><link rel="preload" href="/foco/assets/fonts/manrope-latin-v1.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/foco/fonts.css"><link rel="stylesheet" href="/foco/landing.css"><link rel="stylesheet" href="/foco/account.css">
    <script type="module" src="/foco/account.js"></script></head>
    <body class="account-page" data-review="${review}" data-entry="${purchase ? 'purchase' : 'account'}">
    <a class="skip-link" href="#account-panel">Ir al contenido</a>
    <header class="account-header"><a class="brand" href="/" aria-label="Foco, inicio">${mark}<span>FOCO</span></a><a href="/soporte/">¿Te ayudamos?</a></header>
    <main class="account-layout" id="account-main">
        <aside class="account-story" aria-label="Tu Foco">
            <p class="story-title">Un pequeño gesto.<br><span>Más tiempo para ti.</span></p>
            <div class="account-product"><img src="/foco/assets/orbit/foco-card-orbit-768-v3.webp" alt="Tarjeta Foco negra con su símbolo blanco" width="768" height="768" fetchpriority="high"></div>
            <dl class="account-specs" aria-label="Compatibilidad">
                <div><dt>Compatibilidad</dt><dd>iPhone con iOS 17.6 o posterior</dd></div>
            </dl>
        </aside>
        <section class="account-panel" id="account-panel" ${purchase ? 'data-view="plan"' : ''} aria-labelledby="step-title" tabindex="-1">
            ${purchase ? `<div class="step-content">${renderPlanSelection()}</div>` : '<h1 id="step-title">Un momento.</h1><p class="step-lede">Estamos preparando tu cuenta.</p>'}
            <noscript><p>Activa JavaScript para continuar. Si necesitas ayuda, escríbenos a <a href="mailto:team@getfoco.co">team@getfoco.co</a>.</p></noscript>
        </section>
    </main>
    <footer class="site-footer"></footer>
    </body></html>`;
}

export async function buildAccountPages({ out, optimize, homepage, review = false }) {
    for (const path of ['cuenta/', 'comprar/', 'foco/comprar/', 'empezar/', ...(review ? ['revision/suscripcion/'] : [])]) {
        const source = renderSharedFooter(accountPage({ review: path.startsWith('revision/'), purchase: path !== 'cuenta/' }), homepage);
        const html = await optimize(source.replace(/href="\/foco\/(?=[#"]|(?:blog|comprar|suscripciones|pago|privacidad|terminos|soporte|compra)\/)/g, 'href="/'));
        await mkdir(new URL(path, out), { recursive: true });
        await writeFile(new URL(`${path}index.html`, out), html);
    }
}
