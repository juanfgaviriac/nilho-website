import { runtime } from '../../server/foco/runtime.mjs';
import { json, readJSON, errorResponse, checkoutOriginAllowed } from '../../server/foco/http.mjs';
export default async request => {
    try {
        if (!checkoutOriginAllowed(request, process.env)) return json({ error: 'origin_not_allowed' }, 403);
        const input = await readJSON(request, 4096);
        const commerce = await runtime();
        return json(await commerce.createCheckout(input));
    } catch (error) { return errorResponse(error); }
};
export const config = { path: '/api/foco/checkout', rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip','domain'] } };
