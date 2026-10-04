import { authorizeSubscriptionReceipt, deliverSubscriptionReceipts } from '../../server/foco/subscription-receipt.mjs';
import { vercelStore } from '../../server/foco/vercel-store.mjs';
import { json, readJSON, errorResponse } from '../../server/foco/http.mjs';
export default {async fetch(request){
    try {
        authorizeSubscriptionReceipt(request,process.env);
        const payload=await readJSON(request,12000);
        const store=vercelStore({mode:'prod',token:process.env.BLOB_READ_WRITE_TOKEN,storeId:process.env.BLOB_STORE_ID});
        return json(await deliverSubscriptionReceipts(payload,{store,env:process.env}));
    }catch(error){return errorResponse(error);}
}};
