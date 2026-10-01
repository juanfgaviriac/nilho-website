import { json } from '../../server/foco/http.mjs';
export default async () => { return json({ error: 'legacy_checkout_retired', checkoutURL: 'https://getfoco.co/comprar/' }, 410); };
export const config = { path: '/api/foco/checkout' };
