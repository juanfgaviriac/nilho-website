import { authorizedReport, commerceReport, colombiaDay } from '../../server/foco/insights.mjs';
import { vercelStore } from '../../server/foco/vercel-store.mjs';
import { json } from '../../server/foco/http.mjs';
const cache = new Map();
export default { async fetch(request) {
    if (!authorizedReport(request, process.env.COMMERCE_INSIGHTS_TOKEN)) return json({ error: 'unauthorized' }, 401);
    const days = Number(new URL(request.url).searchParams.get('days') || 30);
    if (![7,30,90].includes(days)) return json({ error: 'invalid_window' }, 400);
    if (process.env.VERCEL_ENV !== 'production' || process.env.WOMPI_ENVIRONMENT !== 'prod') return json({ error: 'production_required' }, 503);
    try {
        const existing = cache.get(days);
        if (existing && Date.now() - existing.at < 60000 && existing.value.end === colombiaDay(Date.now())) return json(existing.value);
        const store = vercelStore({ mode: 'prod', token: process.env.BLOB_READ_WRITE_TOKEN, storeId: process.env.BLOB_STORE_ID });
        const value = await commerceReport(store, days);
        cache.set(days, { at: Date.now(), value });
        return json(value);
    } catch { return json({ error: 'commerce_report_unavailable' }, 503); }
} };
