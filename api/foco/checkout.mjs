import { vercelRuntime } from '../../server/foco/vercel-runtime.mjs';
import { checkoutRateLimit } from '../../server/foco/rate-limit.mjs';
import { json, readJSON, errorResponse, checkoutOriginAllowed } from '../../server/foco/http.mjs';
export default { async fetch(request) {
    try {
        if (!checkoutOriginAllowed(request,process.env)) return json({error:'origin_not_allowed'},403);
        const input=await readJSON(request,4096);
        const {commerce,store,env}=await vercelRuntime();
        await checkoutRateLimit(request,store,env.WOMPI_EVENTS_SECRET);
        return json(await commerce.createCheckout(input));
    } catch(error) { return errorResponse(error); }
} };
