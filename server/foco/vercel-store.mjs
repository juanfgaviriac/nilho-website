import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

// Preserve the commerce ledger's strong reads and atomic create/CAS contract.
// Never use CDN-cached reads for leases or payment/email deduplication.
export function vercelStore({ mode, token, storeId, sdk = { get, put } }) {
    if (!['prod','test'].includes(mode)) throw new Error('Invalid store environment.');
    const auth = token ? {token} : {storeId};
    const path = key => {
        if (!/^[a-z]+\/[A-Za-z0-9_-]+$/.test(key)) throw new Error('Invalid ledger key.');
        return `${mode}/${key}`;
    };
    async function getWithMetadata(key, options = {}) {
        // Brotli/gzip representations have a different HTTP ETag from the stored
        // object. Request identity so a body and its CAS token describe one version.
        const result = await sdk.get(path(key), {...auth,access:'private',useCache:false,
            headers:{'Accept-Encoding':'identity'}});
        if (!result) return null;
        if (result.statusCode !== 200) throw new Error('Unexpected ledger response.');
        const text = await new Response(result.stream).text();
        return {data: options.type === 'json' ? JSON.parse(text) : text, etag:result.blob.etag,metadata:{}};
    }
    async function set(key, value, options = {}) {
        try {
            const result = await sdk.put(path(key),value,{...auth,access:'private',addRandomSuffix:false,
                allowOverwrite:!options.onlyIfNew,...(options.onlyIfMatch ? {ifMatch:options.onlyIfMatch} : {}),
                contentType:'text/plain; charset=utf-8',cacheControlMaxAge:60});
            return {modified:true,etag:result.etag};
        } catch (error) {
            if (error instanceof BlobPreconditionFailedError || (options.onlyIfMatch && /conditional request cannot succeed due to a conflicting operation/i.test(error.message))) return {modified:false};
            // SDK versions surface an existing pathname as a generic BlobError.
            // Verify its existence with a strong read; never turn an outage into a claim.
            if (options.onlyIfNew && await getWithMetadata(key)) return {modified:false};
            throw error;
        }
    }
    return {getWithMetadata, get:async(key,options)=>(await getWithMetadata(key,options))?.data ?? null,
        set, setJSON:(key,value,options)=>set(key,JSON.stringify(value),options)};
}
