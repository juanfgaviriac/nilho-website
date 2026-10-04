import { vercelRuntime, vercelEnvironment } from '../../server/foco/vercel-runtime.mjs';
import { routeSubscriptionEvent } from '../../server/foco/subscription-webhook.mjs';
import { json, readJSON, errorResponse } from '../../server/foco/http.mjs';
export default { async fetch(request) {
    try {
        const event=await readJSON(request,65536);
        const recurring = await routeSubscriptionEvent(event, vercelEnvironment());
        if (recurring) return json(recurring);
        const {commerce}=await vercelRuntime();
        return json(await commerce.handleEvent(event));
    } catch(error) { return errorResponse(error); }
} };
