import { runtime } from '../../server/foco/runtime.mjs';
import { json, readJSON, errorResponse } from '../../server/foco/http.mjs';
export default async request => {
    try {
        const event = await readJSON(request, 65536);
        const commerce = await runtime();
        return json(await commerce.handleEvent(event));
    } catch (error) { return errorResponse(error); }
};
export const config = { path: '/api/foco/wompi' };
