export function renderAnalytics(html) {
    if (html.includes('id="analytics-consent"')) throw new Error('Analytics already installed.');
    html = html.replace('<head>', '<head>\n    <script type="module" src="/foco/analytics.js"></script>\n    <link rel="stylesheet" href="/foco/analytics.css">');
    html = html.replace(/(<nav class="footer-links"[^>]*>)/, '$1<button type="button" data-analytics-settings>Preferencias de analítica</button>');
    return html.replace('</body>', `<section id="analytics-consent" class="analytics-consent" aria-labelledby="analytics-title" hidden>
    <h2 id="analytics-title">¿Nos ayudas a mejorar Foco?</h2>
    <p>Con tu permiso, usamos Google Analytics para entender las visitas y las compras. Puedes comprar sin aceptarlo. <a href="/compra/privacidad/#analitica">Cómo usamos estos datos</a>.</p>
    <div><button type="button" data-analytics-choice="reject">No, gracias</button><button type="button" data-analytics-choice="accept">Aceptar analítica</button></div>
    </section></body>`);
}
