import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SUBSCRIPTION_POLICY_VERSION, SUBSCRIPTION_POLICY_PATH} from '../foco/subscription-policy.mjs';
import {snapshotPolicies} from '../scripts/policies.mjs';

test('published subscription consent resolves to immutable terms and both privacy notices', async () => {
    await snapshotPolicies();
    const base = new URL(`..${SUBSCRIPTION_POLICY_PATH}/`, import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
    assert.equal(manifest.version,SUBSCRIPTION_POLICY_VERSION);
    assert.deepEqual(Object.keys(manifest.documents),['terms','privacy','app-privacy']);
    for (const [kind,document] of Object.entries(manifest.documents)) {
        const html = await readFile(new URL(`${kind}.html`,base),'utf8');
        assert.equal(createHash('sha256').update(html).digest('hex'),document.sha256);
        assert.equal(document.url,`${SUBSCRIPTION_POLICY_PATH}/${kind}.html`);
        assert.doesNotMatch(html,/Pendiente de completar|commerce.js|data-offer-list/);
        assert.match(html,/noindex, follow/);
        assert.doesNotMatch(html,/href="\/(?:foco\/)?(?:compra|suscripciones|privacidad)\/(?:#[^"]*)?"/);
    }
    await snapshotPolicies(); // An unchanged build preserves exact bytes.
});
