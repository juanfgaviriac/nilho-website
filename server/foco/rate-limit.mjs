import { createHmac } from 'node:crypto';
import { CommerceError } from './commerce.mjs';
// Store no raw IP. Each daily key expires logically; bounded per-minute counter.
export async function checkoutRateLimit(request,store,secret,now=Date.now()) {
    const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (!ip || !secret) throw new CommerceError(503,'request_context_unavailable');
    const day=Math.floor(now/86400000), minute=Math.floor(now/60000);
    const key=`limits/${createHmac('sha256',secret).update(`${day}:${ip}`).digest('hex')}`;
    for(let retry=0;retry<5;retry++) {
        const current=await store.getWithMetadata(key,{type:'json'});
        const count=current?.data.minute===minute ? current.data.count : 0;
        if(count>=10) throw new CommerceError(429,'too_many_requests');
        const saved=await store.setJSON(key,{minute,count:count+1},current ? {onlyIfMatch:current.etag} : {onlyIfNew:true});
        if(saved.modified) return;
    }
    throw new CommerceError(429,'too_many_requests');
}
