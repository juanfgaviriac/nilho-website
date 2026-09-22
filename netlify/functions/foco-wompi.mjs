import { runtime } from '../../server/foco/runtime.mjs';
import { json, readJSON, errorResponse } from '../../server/foco/http.mjs';
export default async (request, context) => {
    try {
        const event = await readJSON(request, 65536);
        if (context?.deploy?.context === 'production') {
            // Preserve POST delivery for queued events sent to the former URL.
            // Vercel verifies the signature and owns the only production ledger.
            const response = await fetch('https://getfoco.co/api/foco/wompi', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event), redirect: 'error', signal: AbortSignal.timeout(25000),
            });
            return new Response(await response.text(), { status: response.status,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
        }
        const commerce = await runtime(context);
        return json(await commerce.handleEvent(event));
    } catch (error) { return errorResponse(error); }
};
export const config = { path: '/api/foco/wompi' };
