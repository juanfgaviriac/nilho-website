import { CommerceError } from './commerce.mjs';
export const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
export async function readJSON(request, limit) {
    if (request.method !== 'POST') throw new CommerceError(405, 'method_not_allowed');
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) throw new CommerceError(415, 'json_required');
    const reader = request.body?.getReader();
    if (!reader) throw new CommerceError(400, 'invalid_json');
    const chunks = [];
    let size = 0;
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw new CommerceError(413, 'request_too_large'); }
        chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new CommerceError(400, 'invalid_json'); }
}
export function errorResponse(error) {
    // Do not log provider payloads, addresses, tokens or raw errors.
    const known = error instanceof CommerceError;
    if (!known) console.error('foco_commerce:internal_error');
    return json({ error: known ? error.code : 'temporarily_unavailable' }, known ? error.status : 503);
}
export function checkoutOriginAllowed(request, env) {
    const origin = request.headers.get('origin');
    if (env.WOMPI_ENVIRONMENT === 'prod') return origin === 'https://getfoco.co';
    // Sandbox only: same-origin local/preview requests. No wildcard CORS.
    return Boolean(origin && origin === new URL(request.url).origin);
}
