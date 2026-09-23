import { MEASUREMENT_ID, CONSENT_VERSION, CONSENT_KEY, CONSENT_DAYS, readConsent, cleanPage, campaignParameters } from './analytics-model.mjs';

// Basic consent mode: no Google script, request or cookie before an affirmative choice.
// Never tag previews, local development, policy archives or the private Insights app.
const production = location.hostname === 'getfoco.co' && location.protocol === 'https:';
let consent;
try { consent = readConsent(localStorage.getItem(CONSENT_KEY)); } catch { consent = null; }
let started = false;
const denied = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
const page = cleanPage(location.href);
const allowed = () => production && consent?.allowed === true;
let ids = null;

function start() {
    if (!allowed() || started) return;
    started = true;
    window[`ga-disable-${MEASUREMENT_ID}`] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', denied);
    window.gtag('consent', 'update', { ...denied, analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, {
        send_page_view: false, page_location: page, page_referrer: cleanPage(document.referrer),
        page_title: document.title, ...campaignParameters(location.href),
        allow_google_signals: false, allow_ad_personalization_signals: false,
        cookie_expires: CONSENT_DAYS * 86400, cookie_update: false,
    });
    window.gtag('event', 'page_view', { page_location: page, page_referrer: cleanPage(document.referrer), send_to: MEASUREMENT_ID });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.append(script);
    // Resolve in the background. A blocker or slow Google request never delays checkout.
    const found = {};
    for (const key of ['client_id', 'session_id']) window.gtag('get', MEASUREMENT_ID, key, value => {
        if (!allowed()) return;
        found[key] = String(value);
        if (/^\d{1,20}\.\d{1,20}$/.test(found.client_id || '') && /^\d{1,20}$/.test(found.session_id || '')) ids = found;
    });
    document.dispatchEvent(new Event('foco:analytics-ready'));
}

const events = new Set(['view_item', 'begin_checkout', 'select_item', 'checkout_error', 'contact_support']);
window.focoAnalytics = {
    event(name, params = {}) {
        if (!allowed() || !events.has(name)) return false;
        window.gtag('event', name, { ...params, page_location: page, send_to: MEASUREMENT_ID });
        return true;
    },
    context() {
        return allowed() && ids ? { clientId: ids.client_id, sessionId: ids.session_id, consentVersion: CONSENT_VERSION } : undefined;
    },
};

const panel = document.getElementById('analytics-consent');
const controls = document.querySelectorAll('[data-analytics-choice]');
const settings = document.querySelector('[data-analytics-settings]');
function choose(value) {
    consent = { version: CONSENT_VERSION, allowed: value, at: Date.now() };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(consent)); } catch { /* Page-only choice when storage is blocked. */ }
    panel.hidden = true;
    if (value) start();
    else {
        ids = null;
        window[`ga-disable-${MEASUREMENT_ID}`] = true;
        // Withdrawal stops collection before clearing first-party GA cookies.
        for (const cookie of document.cookie.split(';')) {
            const name = cookie.split('=')[0].trim();
            if (!/^_ga(?:_|$)/.test(name)) continue;
            for (const domain of ['', '; domain=getfoco.co', '; domain=.getfoco.co']) document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax; Secure${domain}`;
        }
        if (started) location.reload();
    }
}
for (const button of controls) button.addEventListener('click', () => choose(button.dataset.analyticsChoice === 'accept'));
settings?.addEventListener('click', () => { panel.hidden = false; controls[0]?.focus({ preventScroll: true }); });
window.addEventListener('storage', event => { if (event.key === CONSENT_KEY) location.reload(); });
if (panel) panel.hidden = Boolean(consent) || !production;
document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const host = new URL(link.href).hostname;
    if (host === 'wa.me') window.focoAnalytics.event('contact_support', { method: 'whatsapp' });
});
start();
