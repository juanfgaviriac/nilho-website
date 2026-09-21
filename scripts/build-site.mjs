import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { snapshotPolicies } from './policies.mjs';
const root = new URL('../', import.meta.url);
await snapshotPolicies();
await rm(new URL('dist/', root), { recursive: true, force: true });
await mkdir(new URL('dist/', root));
// Explicit public allowlist. Source, order functions, env files and docs never ship.
for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && (/\.(html|css|js|svg|png|ico|txt|xml|webmanifest)$/.test(entry.name) || ['_headers','_redirects'].includes(entry.name))) {
        await cp(new URL(entry.name, root), new URL(`dist/${entry.name}`, root));
    }
}
for (const dir of ['assets','foco']) await cp(new URL(dir, root), new URL(`dist/${dir}`, root), { recursive: true });
console.log('Static site built in dist/. Checkout remains gated by configuration.');
