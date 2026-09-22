import { vercelRuntime } from '../../server/foco/vercel-runtime.mjs';
import { json, readJSON, errorResponse } from '../../server/foco/http.mjs';
export default { async fetch(request) {
    try {
        const event=await readJSON(request,65536);
        const {commerce}=await vercelRuntime();
        return json(await commerce.handleEvent(event));
    } catch(error) { return errorResponse(error); }
} };
