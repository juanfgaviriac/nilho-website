import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

// Each build gets a fresh cache. Content-addressed URLs make long browser caching
// safe, including when a pricing dependency changes but checkout.js itself does not.
export function pageOptimizer(out) {
    const cache = new Map();
    async function publish(name, extension, bytes) {
        const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
        const path = `/foco/_assets/${name}.${hash}.${extension}`;
        await mkdir(new URL('foco/_assets/', out), { recursive: true });
        await writeFile(new URL('.' + path, out), bytes);
        return path;
    }

    // Fonts, posters and videos deserve the same safe immutable caching as code.
    // Rewrite CSS before hashing it so a changed font also invalidates its stylesheet.
    // Original public URLs remain available for old pages and signed policy archives.
    async function fingerprintMedia(text) {
        const paths = new Set(text.match(/\/foco\/assets\/[-a-zA-Z0-9_/]+\.(?:woff2|webp|mp4|svg|png|ico)\b/g) || []);
        for (const path of paths) {
            const key = `media:${path}`;
            if (!cache.has(key)) {
                const file = path.split('/').at(-1);
                const dot = file.lastIndexOf('.');
                cache.set(key, await publish(file.slice(0, dot), file.slice(dot + 1), await readFile(new URL('.' + path, root))));
            }
            text = text.replaceAll(path, cache.get(key));
        }
        return text;
    }

    async function asset(paths, kind) {
        const key = `${kind}:${paths.join('|')}`;
        if (cache.has(key)) return cache.get(key);
        const files = paths.map(path => path.split('?')[0]);
        const input = files.map(file => kind === 'css'
            ? `@import ${JSON.stringify('.' + file)};` : `import ${JSON.stringify('.' + file)};`).join('\n');
        const result = await build({ stdin: { contents: input, loader: kind, resolveDir: fileURLToPath(root) },
            bundle: true, minify: true, write: false, format: 'esm', platform: 'browser',
            target: ['safari17', 'chrome109', 'firefox115'], external: ['/foco/assets/*'], legalComments: 'none' });
        const bytes = Buffer.from(await fingerprintMedia(result.outputFiles[0].text));
        const name = kind === 'css' ? 'styles' : files[0].split('/').at(-1).replace(/\.[^.]+$/, '');
        const path = await publish(name, kind, bytes);
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
        return fingerprintMedia(html);
    };
}
