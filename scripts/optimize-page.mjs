import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

// Each build gets a fresh cache. Content-addressed URLs make long browser caching
// safe, including when a pricing dependency changes but checkout.js itself does not.
export function pageOptimizer(out) {
    const cache = new Map();
    async function asset(paths, kind) {
        const key = `${kind}:${paths.join('|')}`;
        if (cache.has(key)) return cache.get(key);
        const files = paths.map(path => path.split('?')[0]);
        const input = files.map(file => kind === 'css'
            ? `@import ${JSON.stringify('.' + file)};` : `import ${JSON.stringify('.' + file)};`).join('\n');
        const result = await build({ stdin: { contents: input, loader: kind, resolveDir: fileURLToPath(root) },
            bundle: true, minify: true, write: false, format: 'esm', platform: 'browser',
            target: ['safari17', 'chrome109', 'firefox115'], external: ['/foco/assets/*'], legalComments: 'none' });
        const bytes = result.outputFiles[0].contents;
        const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
        const name = kind === 'css' ? 'styles' : files[0].split('/').at(-1).replace(/\.[^.]+$/, '');
        const path = `/foco/_assets/${name}.${hash}.${kind}`;
        await mkdir(new URL('foco/_assets/', out), { recursive: true });
        await writeFile(new URL('.' + path, out), bytes);
        cache.set(key, path);
        return path;
    }

    return async html => {
        // Current rendered pages only. Accepted policy archives keep their exact bytes.
        html = html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>/g, '')
            .replace(/<link href="https:\/\/fonts\.googleapis\.com\/[^\"]+" rel="stylesheet">/g,
                '<link rel="preload" href="/foco/assets/fonts/manrope-latin-v1.woff2" as="font" type="font/woff2" crossorigin>\n    <link rel="stylesheet" href="/foco/fonts.css">');
        const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="(\/foco\/[^"?]+\.css(?:\?[^\"]*)?)"[^>]*>/g)];
        if (styles.length) {
            const path = await asset(styles.map(match => match[1]), 'css');
            html = html.replace(styles[0][0], `<link rel="stylesheet" href="${path}">`);
            for (const match of styles.slice(1)) html = html.replace(match[0], '');
        }
        for (const match of [...html.matchAll(/<script\b[^>]*src="(\/foco\/[^"?]+\.js(?:\?[^\"]*)?)"[^>]*><\/script>/g)]) {
            const path = await asset([match[1]], 'js');
            html = html.replace(match[0], `<script type="module" src="${path}"></script>`);
        }
        return html;
    };
}
