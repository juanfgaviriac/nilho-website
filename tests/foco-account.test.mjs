import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { PREVIEW_PLANS, REVIEW_STEPS, isLocalReview, accountDestination, validCode, validEmail, validDelivery, previewPlan, previewPlanSavings, previewTotals, escapeHTML } from '../foco/account-flow.mjs';
import { handleAccount, publicAccountConfig } from '../server/foco/account.mjs';
import { renderPlanSelection } from '../foco/account-plans.mjs';
import { accountPage, buildAccountPages } from '../scripts/account-pages.mjs';

const env = { FOCO_WEB_ACCOUNT_ENABLED: 'true', FOCO_WEB_APPLE_ENABLED: 'true', FOCO_AUTH_URL: 'https://test.supabase.co', FOCO_AUTH_PUBLISHABLE_KEY: 'sb_publishable_fixture' };
const authorization = 'Bearer fixture-valid-session-token';
const request = (action = 'status', init = {}) => new Request(`https://getfoco.co/api/foco/account?action=${action}&userId=victim`, { headers: { authorization }, ...init });
const lifetime = { entitlement: 'lifetime', source: 'existing_user', grantedAt: '2026-09-29T00:00:00Z', expiresAt: null, source_reference: 'private' };

test('review state cannot be activated by a query parameter on public account or checkout routes', () => {
    for (const hostname of ['getfoco.co', 'getfoco.co.evil.test', 'preview.vercel.app']) {
        assert.equal(isLocalReview({ hostname, pathname: '/revision/suscripcion/' }, 'true'), false);
    }
    for (const pathname of ['/cuenta/', '/empezar/', '/comprar/']) assert.equal(isLocalReview({ hostname: 'localhost', pathname }, 'true'), false);
    assert.equal(isLocalReview({ hostname: '127.0.0.1', pathname: '/revision/suscripcion/' }, 'false'), false);
    assert.equal(isLocalReview({ hostname: '127.0.0.1', pathname: '/revision/suscripcion/' }, 'true'), true);
});
test('review includes the complete journey and non-happy paths', () => {
    for (const view of ['cuenta', 'codigo', 'plan', 'envio', 'pago', 'proveedor', 'procesando', 'confirmacion', 'vitalicio', 'activo', 'error', 'codigo-error', 'sinconexion']) assert.ok(REVIEW_STEPS.some(([name]) => name === view));
});
test('account status fails closed and lifetime access never goes to checkout', () => {
    assert.equal(accountDestination({ access: lifetime }), 'vitalicio');
    assert.equal(accountDestination({ access: { entitlement: 'subscription' }, billingReady: true, subscriptions: [], needsBillingReview: false }), 'activo');
    assert.equal(accountDestination({ access: { entitlement: 'unassigned' }, billingReady: true, subscriptions: [], needsBillingReview: false }), 'plan');
    assert.equal(accountDestination({ access: { entitlement: 'unassigned' }, billingReady: false }), 'pendiente');
    assert.equal(accountDestination({ access: { entitlement: 'unassigned' }, billingReady: true, subscriptions: [{ status: 'billing_retry', autoRenews: false }], needsBillingReview: false }), 'activo');
    for (const result of [null, {}, { access: { entitlement: 'lifetime', expiresAt: 'tomorrow' } }, { access: { entitlement: 'error' } }]) assert.throws(() => accountDestination(result));
});
test('email, OTP and delivery validation catches incomplete forms', () => {
    assert.ok(validEmail('hello@example.test'));
    assert.equal(validEmail('<script>'), false);
    assert.ok(validCode('123456'));
    assert.ok(validCode('12345678'));
    assert.equal(validCode('123'), false);
    assert.equal(validCode('12345a'), false);
    const delivery = { name: 'Cliente de prueba', phone: '300 123 4567', department: 'Bogotá D.C.', city: 'Bogotá', address: 'Calle de ejemplo 123' };
    assert.ok(validDelivery(delivery));
    for (const field of Object.keys(delivery)) assert.ok(!validDelivery({ ...delivery, [field]: '' }));
    assert.ok(!validDelivery({ ...delivery, phone: '1111111111' }));
});
test('preview totals separate shipping from monthly renewal and existing-card path', () => {
    assert.deepEqual(previewTotals(false), { today: 24900, subscription: 14900, shipping: 10000, renewal: 14900, trialDays: 0 });
    assert.deepEqual(previewTotals(true), { today: 14900, subscription: 14900, shipping: 0, renewal: 14900, trialDays: 0 });
});
test('user-provided names, emails and addresses are escaped before HTML rendering', () => {
    assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('public configuration is disabled by default and never includes secret keys', () => {
    assert.deepEqual(publicAccountConfig({}), { enabled: false, appleEnabled: false, checkoutEnabled: false });
    const config = publicAccountConfig({ ...env, SUPABASE_SECRET_KEY: 'private', WOMPI_PRIVATE_KEY: 'private' });
    assert.equal(config.enabled, true);
    assert.equal(config.checkoutEnabled, false);
    assert.ok(!JSON.stringify(config).includes('private'));
    assert.equal(publicAccountConfig({ ...env, FOCO_AUTH_PUBLISHABLE_KEY: 'sb_secret_not_public' }).enabled, false);
    assert.equal(publicAccountConfig({ ...env, FOCO_AUTH_URL: 'http://metadata.internal' }).enabled, false);
});
test('status uses authenticated backend identity, strips private audit fields and never caches', async () => {
    const calls = [];
    const response = await handleAccount(request(), env, async (...args) => { calls.push(args); return Response.json(lifetime); });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('vary'), 'Authorization');
    assert.equal(calls[0][0], 'https://foco-backend.vercel.app/api/v1/access');
    assert.equal(calls[0][1].headers.authorization, authorization);
    assert.equal(calls[0][1].redirect, 'error');
    const result = await response.json();
    assert.equal(result.access.entitlement, 'lifetime');
    assert.equal(result.checkoutEnabled, false);
    assert.equal(result.billingReady, false);
    assert.ok(!JSON.stringify(result).includes('private'));
});
test('missing sessions, disabled rollout and mutations cannot reach the backend', async () => {
    const noCall = () => { throw Error('unexpected call'); };
    assert.equal((await handleAccount(request('status', { headers: {} }), env, noCall)).status, 401);
    assert.equal((await handleAccount(request(), {}, noCall)).status, 503);
    for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await handleAccount(request('status', { method }), env, noCall)).status, 405);
});
test('provider failures and malformed access never become unassigned/success', async () => {
    for (const fetcher of [async () => { throw Error('private credential detail'); }, async () => new Response('private', { status: 500 }), async () => Response.json({ entitlement: 'lifetime', expiresAt: null, source: 'forged' })]) {
        const response = await handleAccount(request(), env, fetcher);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'access_unavailable' });
    }
    assert.equal((await handleAccount(request(), env, async () => new Response('', { status: 401 }))).status, 401);
});
test('account HTML is private, untracked and not a payment form collecting PAN/CVC', async () => {
    const html = accountPage();
    assert.match(html, /noindex, nofollow/);
    assert.match(html, /no-referrer/);
    assert.match(html, /data-review="false"/);
    assert.doesNotMatch(html, /googletagmanager|analytics\.js|card-number|cvc/i);
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /localStorage|WOMPI_PRIVATE|sb_secret_|6751908323/);
    assert.match(source, /id6808677908/);
    assert.match(source, /if \(!review && !checkoutEnabled\(\)\) return/);
    assert.match(source, /const checkoutEnabled = \(\) => sandbox\(\) \|\| recurring\(\)/);
});
test('normal builds exclude the review route and reuse the homepage footer', async () => {
    const dir = await mkdtemp(`${tmpdir()}/foco-account-build-`);
    const out = pathToFileURL(`${dir}/`);
    await buildAccountPages({ out, optimize: async html => html, homepage: '<footer class="site-footer">shared-footer-fixture</footer>' });
    assert.deepEqual((await readdir(dir)).sort(), ['comprar', 'cuenta', 'empezar', 'foco']);
    const html = await readFile(new URL('cuenta/index.html', out), 'utf8');
    assert.match(html, /shared-footer-fixture/);
    assert.match(html, /data-review="false"/);
});
test('simplified sign-in keeps the requested title without review controls or a step indicator', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../foco/account.css', import.meta.url), 'utf8');
    assert.match(source, /heading\('Entra a tu Foco por aquí'/);
    assert.doesNotMatch(source, /EMPECEMOS POR TI|Tu tiempo\.<br>Tu cuenta Foco\.|flow-progress|review-bar|data-review=previous/);
    assert.doesNotMatch(accountPage({ review: true }), /review-bar|Herramientas de revisión/);
    assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.account-story \{ display: none; \}/);
});
test('Apple sign-in uses proportionate vector artwork without shrinking or font-dependent glyphs', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../foco/account.css', import.meta.url), 'utf8');
    const icon = source.match(/const apple = '([^']+)';/)?.[1];
    assert.ok(icon);
    assert.match(icon, /class="account-apple-logo"/);
    assert.match(icon, /viewBox="20\.5 16 15 19" width="16" height="20"/);
    assert.match(icon, /fill="currentColor" aria-hidden="true" focusable="false"/);
    assert.doesNotMatch(icon, /transform=||<text/);
    assert.match(css, /\.account-button \.account-apple-logo \{[^}]*width: 16px;[^}]*height: 20px;[^}]*flex: none;/);
});
test('card details show only compatibility without technology, charging or marketing labels', async () => {
    const html = accountPage({ review: true });
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    assert.doesNotMatch(html + source, /MENOS PANTALLA\. MÁS VIDA\.|UN PLAN, TODO FOCO|Tu tarjeta\. Tu momento\.|HECHO PARA TI|Sin batería\. Sin distracciones\.|class="account-summary"/);
    assert.match(html, /class="account-specs"/);
    assert.doesNotMatch(html, /<dt>Tecnología<\/dt>|<dd>NFC<\/dd>|<dt>Carga<\/dt>|<dd>No requiere<\/dd>/);
    assert.match(html, /<dt>Compatibilidad<\/dt><dd>iPhone con iOS 17\.6 o posterior<\/dd>/);
    assert.match(accountPage({ purchase: true }), /Más vida\.<br class="account-title-break"> Menos scroll\./);
});
test('checkout omits decorative labels, uses light conditions, and shows the escaped delivery phone', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../foco/account.css', import.meta.url), 'utf8');
    assert.doesNotMatch(source + accountPage(), /account-eyebrow|TODO CLARO|Sin sorpresas|SOLO UN PASO MÁS|ERES PARTE DEL COMIENZO/);
    assert.match(source, /heading\('Un último vistazo\.'\)/);
    assert.match(source, /<summary>Condiciones<\/summary>/);
    assert.match(source, /class="account-delivery-phone">Celular: \+57 \$\{esc\(state\.delivery\.phone\)\}/);
    assert.match(css, /\.account-terms summary \{[^}]*min-height: 44px;[^}]*font-weight: 400;/);
    assert.doesNotMatch(css, /\.account-terms \{[^}]*(?:padding:|border:|background:)/);
});
test('desktop checkout uses available width without motion, nested scrolling or clipped forms', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../foco/account.css', import.meta.url), 'utf8');
    assert.match(source, /panel\.dataset\.view = v/);
    assert.match(source, /class="account-field-row account-field-row--desktop"/);
    assert.match(source, /class="account-actions"><div class="account-action-row"/);
    assert.match(source, /<button type="submit" class="account-button">Revisar mi pedido<\/button><\/div><\/div><\/form>/);
    assert.match(css, /@media \(min-width: 1000px\)/);
    assert.match(css, /\.plan-choice \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.account-field-row--desktop \{ grid-template-columns: 1fr; gap: 18px; \}/);
    assert.doesNotMatch(css, /step-in|scroll-behavior: smooth|overflow-y: (auto|scroll)|max-height:/);
    assert.match(source, /panel\.getBoundingClientRect\(\)\.top < 0/);
});
test('short account screens hug their content and only controls show a focus ring', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../foco/account.css', import.meta.url), 'utf8');
    assert.match(css, /\.account-panel:not\(\[data-view="plan"\], \[data-view="envio"\], \[data-view="pago"\]\) \{ width: 100%; max-width: 480px;/);
    assert.doesNotMatch(css, /(?:^|\n)\s*\.step-content \{[^}]*min-height:/);
    assert.match(css, /\.account-panel:is\(\[data-view="plan"\], \[data-view="envio"\], \[data-view="pago"\]\) \.step-content \{ min-height:/);
    assert.match(css, /\.account-error:empty \{ display: none; \}/);
    assert.match(css, /\.account-page #step-title:focus \{ outline: none; \}/);
    assert.match(css, /\.account-page :focus-visible \{ outline: 2px solid var\(--forest\)/);
    assert.match(source, /id="step-title" tabindex="-1"/);
    assert.match(source, /querySelector\('#step-title'\)\?\.focus\(\{ preventScroll: true \}\)/);
    assert.match(source, /autocomplete: 'one-time-code'/);
    assert.match(source, /id="form-error" role="alert"/);
});
test('payment results share compact decline markup and separate primary and secondary actions', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../foco/account.css', import.meta.url), 'utf8');
    const declined = source.match(/function declinedPayment\(\) \{([\s\S]*?)\n\}/)[1];
    assert.match(declined, /heading\('No se completó el pago\.'/);
    assert.match(declined, /button\('Revisar mi plan', 'plan'\)/);
    assert.doesNotMatch(declined, /verify-payment|account-button--light|account-status-symbol/);
    assert.match(source, /html = failed \? declinedPayment\(\)/);
    assert.match(source, /v === 'error'\) \{\s+html = declinedPayment\(\);/);
    assert.match(source, /Modo de prueba · Sin cargos reales\./);
    assert.match(source, /Vista previa · Sin cargos reales\./);
    assert.match(css, /\.account-result-actions \{ display: grid; gap: 16px;/);
    assert.match(css, /\.account-result-actions \.account-inline-actions \{ flex-wrap: wrap;/);
});
test('all three preview plans retain their agreed amounts and billing periods', () => {
    assert.deepEqual(PREVIEW_PLANS.map(({ id, amount, months }) => ({ id, amount, months })), [
        { id: 'monthly', amount: 14900, months: 1 },
        { id: 'quarterly', amount: 39900, months: 3 },
        { id: 'annual', amount: 119900, months: 12 },
    ]);
    for (const plan of PREVIEW_PLANS) {
        assert.equal(previewPlan(plan.id), plan);
        const shipping = plan.months === 1 ? 10000 : 0;
        assert.deepEqual(previewTotals(false, plan.id), { today: plan.amount + shipping, subscription: plan.amount, shipping, renewal: plan.amount, trialDays: 0 });
        assert.deepEqual(previewTotals(true, plan.id), { today: plan.amount, subscription: plan.amount, shipping: 0, renewal: plan.amount, trialDays: 0 });
        assert.deepEqual(previewTotals(false, plan.id, true), { today: 10000, subscription: 0, shipping: 10000, renewal: plan.amount, trialDays: 7 });
        assert.throws(() => previewTotals(true, plan.id, true), /trial_requires_requested_card/);
    }
    assert.throws(() => previewTotals(false, 'unknown'), /unknown_preview_plan/);
});
test('tier savings compare subscription prices with monthly billing, excluding shipping and trials', () => {
    assert.deepEqual(previewPlanSavings('monthly'), { monthlyEquivalent: 14900, percent: 0 });
    assert.deepEqual(previewPlanSavings('quarterly'), { monthlyEquivalent: 13300, percent: 11 });
    const annual = previewPlanSavings('annual');
    assert.equal(annual.percent, 33);
    assert.equal(annual.monthlyEquivalent, 119900 / 12);
    assert.equal(Math.round(annual.monthlyEquivalent), 9992);
    assert.throws(() => previewPlanSavings('unknown'), /unknown_preview_plan/);
});
test('switching to an existing card removes the trial and returning to plans does not offer it', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    assert.match(source, /if \(state\.hasCard\) state\.useTrial = false;/);
    assert.doesNotMatch(renderPlanSelection({ planId: 'monthly', hasCard: true, useTrial: false }), /id="trial-choice"/);
    assert.match(source, /sin envío ni prueba gratuita/);
    assert.doesNotMatch(source, /tarjeta existente aún está pendiente/);
});
test('plan actions omit the redundant compatibility and trial footnote', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /plan-start|Solo para iPhone con iOS 17\.6 o posterior\./);
    assert.match(renderPlanSelection(), /data-action="choose-plan"[^>]*>Continuar con este plan/);
    assert.match(renderPlanSelection(), /Desde que vinculas tu tarjeta en la app\./);
});
test('trial copy starts on card linking in the app, not purchase, delivery or generic access activation', async () => {
    const source = await readFile(new URL('../foco/account.js', import.meta.url), 'utf8');
    assert.match(source, /Tus 7 días gratis empiezan al vincular tu tarjeta en la app Foco\./);
    assert.match(renderPlanSelection(), /Desde que vinculas tu tarjeta en la app\./);
    assert.match(source, /Ni la compra ni la entrega inician la prueba\./);
    assert.match(source, /Volver a escanear o vincular la tarjeta no reinicia los 7 días\./);
    assert.doesNotMatch(source, /Tu prueba empieza al activar el acceso|Tu prueba empieza cuando recibes la tarjeta|La prueba comienza al recibir la tarjeta/);
});
