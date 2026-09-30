import { handleHostedSubscription } from '../../server/foco/subscription.mjs';
export default { fetch: request => handleHostedSubscription(request) };
