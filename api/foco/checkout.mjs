import { json } from '../../server/foco/http.mjs';
export default { async fetch() { return json({ error: 'legacy_checkout_retired', checkoutURL: 'https://getfoco.co/comprar/' }, 410); } };
