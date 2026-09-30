import { handleAccount } from '../../server/foco/account.mjs';
export default { fetch: request => handleAccount(request) };
