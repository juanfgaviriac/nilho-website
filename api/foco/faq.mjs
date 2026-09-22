import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { makeFAQHandler } from '../../server/foco/faq.mjs';
import { vercelStore } from '../../server/foco/vercel-store.mjs';

let knowledge;
const loadKnowledge = async () => {
    if (!knowledge) knowledge = JSON.parse(await readFile(resolve('server/foco/faq-knowledge.json'), 'utf8'));
    return knowledge;
};
export default {fetch:makeFAQHandler({
    loadDocuments:async () => (await loadKnowledge()).documents,
    loadInstantAnswers:async () => (await loadKnowledge()).instantAnswers,
    makeStore:() => {
        if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) throw new Error('Missing FAQ limiter store');
        return vercelStore({mode:process.env.VERCEL_ENV === 'production' ? 'prod' : 'test',
            token:process.env.BLOB_READ_WRITE_TOKEN, storeId:process.env.BLOB_STORE_ID});
    },
})};
