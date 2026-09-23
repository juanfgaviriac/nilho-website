import { authorizedReport } from '../../server/foco/insights.mjs';
import { submitPurchase } from '../../server/foco/analytics.mjs';
import { vercelStore } from '../../server/foco/vercel-store.mjs';
import { json } from '../../server/foco/http.mjs';
export default { async fetch(request) {
    if (!authorizedReport(request, process.env.CRON_SECRET)) return json({ error: 'unauthorized' }, 401);
    const env = { ...process.env, CONTEXT: process.env.VERCEL_ENV };
    if (env.CONTEXT !== 'production' || env.WOMPI_ENVIRONMENT !== 'prod' || env.GA4_PURCHASES_ENABLED !== 'true') return json({ enabled: false });
    try {
        const store = vercelStore({ mode: 'prod', token: env.BLOB_READ_WRITE_TOKEN, storeId: env.BLOB_STORE_ID });
        let pending = 0;
        for (const key of await store.listKeys('paid')) {
            const paid = await store.get(key, { type: 'json' });
            if (Date.now() - Date.parse(paid.approvedAt) > 71 * 3600000) continue;
            const order = await store.get(`orders/${key.split('/')[1]}`, { type: 'json' });
            if (!order) continue;
            const result = await submitPurchase({ order, paid, store, env });
            if (result === 'pending') pending++;
        }
        return json({ enabled: true, pending });
    } catch { return json({ error: 'retry_unavailable' }, 503); }
} };
