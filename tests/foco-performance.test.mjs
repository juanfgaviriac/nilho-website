import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';
import { pageOptimizer } from '../scripts/optimize-page.mjs';
import { renderAnalytics } from '../scripts/analytics.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('published media and CSS fonts are content-addressed; preload matches the font actually used', async t => {
    const dir = await mkdtemp(`${tmpdir()}/foco-performance-`);
    t.after(() => rm(dir, { recursive: true, force: true }));
    const out = pathToFileURL(`${dir}/`);
    const optimize = pageOptimizer(out);
    const html = await optimize(renderAnalytics(await read('foco/index.html')));
    // The manifest remains at its stable URL, with relative icon references intact.
    assert.match(html, /href="\/foco\/assets\/favicon\/site.webmanifest"/);
    assert.doesNotMatch(html, /\/foco\/assets\/[^"\s]+\.(?:woff2|webp|mp4|svg|png|ico)\b/);
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
    const assets = [...new Set(html.match(/\/foco\/_assets\/[-a-zA-Z0-9_.]+/g))];
    let scriptGzip = 0;
    for (const path of assets) {
        const bytes = await readFile(new URL('.' + path, out));
        const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
        assert.ok(path.includes(`.${hash}.`), `${path} is named for its actual bytes`);
        if (path.endsWith('.js')) scriptGzip += gzipSync(bytes).length;
        if (!path.endsWith('.css')) continue;
        assert.ok(gzipSync(bytes).length < 8_000, 'homepage CSS gzip budget');
        const css = bytes.toString();
        assert.doesNotMatch(css, /\/foco\/assets\/fonts\//);
        for (const font of new Set(css.match(/\/foco\/_assets\/[-a-zA-Z0-9_.]+\.woff2/g))) {
            assert.ok((await stat(new URL('.' + font, out))).size > 0);
        }
        const preload = html.match(/href="([^"]+\.woff2)" as="font"/)[1];
        assert.ok(css.includes(preload), 'font preload is reused, not double-downloaded');
    }
    assert.ok(scriptGzip < 6_000, 'all first-party homepage JS stays under 6 KB gzip');
    assert.equal(await optimize(renderAnalytics(await read('foco/index.html'))), html, 'deterministic build');
});

test('responsive image sizes follow the actual card gutters and widths', async () => {
    const html = await read('foco/index.html');
    const sizes = [...html.matchAll(/sizes="(\(max-width: 720px\)[^"]+)"/g)].map(m => m[1]);
    assert.equal(sizes.length, 3);
    for (const value of sizes) {
        assert.match(value, /calc\(90vw - 29px\)/);
        assert.match(value, /min\(calc\(90vw - 29px\), 322px\)/);
        assert.match(value, /\(max-width: 1048px\) calc\(\(100vw - 88px\) \/ 3 - 2px\), 318px$/);
    }
    assert.match(html, /<video id="comparison-video"[^>]+preload="none" loading="lazy"/);
    assert.doesNotMatch(html.match(/<video id="comparison-video"[^>]+>/)[0], /\ssrc="/);
    assert.match(html, /rel="preload" as="image"[^>]+foco-in-out-v3\.webp/);
});

test('comparison encodes stay within transfer budgets and have fast-start metadata', async () => {
    for (const [width, max] of [[1080, 500_000], [1920, 1_300_000]]) {
        const bytes = await readFile(new URL(`foco/assets/comparison/foco-vs-screen-time-${width}-v2.mp4`, root));
        assert.ok(bytes.length < max, `${width}px video exceeds its transfer budget`);
        const atoms = [];
        for (let position = 0; position + 8 <= bytes.length;) {
            const size = bytes.readUInt32BE(position);
            assert.ok(size >= 8, 'valid MP4 atom');
            atoms.push(bytes.toString('ascii', position + 4, position + 8));
            position += size;
        }
        assert.ok(atoms.indexOf('moov') >= 0 && atoms.indexOf('moov') < atoms.indexOf('mdat'));
    }
});

async function player({ mobile = true, reduced = false, saveData = false } = {}) {
    const events = {}, videoEvents = {}, controlEvents = {};
    let observer;
    const video = {
        dataset: { src: 'desktop.mp4', srcMobile: 'mobile.mp4' }, paused: true, ended: false,
        plays: 0, pauses: 0,
        hasAttribute: name => name === 'src' && Boolean(video.src),
        addEventListener: (name, fn) => { videoEvents[name] = fn; },
        async play() { this.paused = false; this.plays++; },
        pause() { this.paused = true; this.pauses++; }, load() {},
    };
    const control = { dataset: {}, setAttribute() {}, addEventListener: (name, fn) => { controlEvents[name] = fn; } };
    const motion = { matches: reduced, addEventListener(name, fn) { this.change = fn; } };
    const document = { hidden: false, querySelector: selector => ({ '#comparison-video': video, '.comparison-playback': control, '.comparison-error': {} })[selector], addEventListener: (name, fn) => { events[name] = fn; } };
    const context = { document, navigator: { connection: { saveData } },
        window: { IntersectionObserver: true, matchMedia: query => query.includes('reduced-motion') ? motion : { matches: mobile } },
        IntersectionObserver: class { constructor(fn) { observer = fn; } observe() {} },
    };
    vm.runInNewContext(await read('foco/comparison.js'), context);
    return { video, document, motion, controls: controlEvents, events,
        visibility: visible => observer([{ isIntersecting: visible, intersectionRatio: visible ? .8 : 0 }]),
        resize: value => { mobile = value; },
    };
}

test('comparison only downloads when watched, chooses one size, and pauses offscreen', async () => {
    for (const mobile of [true, false]) {
        const p = await player({ mobile });
        assert.equal(p.video.src, undefined);
        p.visibility(true);
        assert.equal(p.video.src, mobile ? 'mobile.mp4' : 'desktop.mp4');
        p.visibility(false);
        assert.equal(p.video.paused, true);
        p.resize(!mobile);
        p.visibility(true);
        assert.equal(p.video.src, mobile ? 'mobile.mp4' : 'desktop.mp4', 'resize does not restart or redownload');
        p.document.hidden = true;
        p.events.visibilitychange();
        assert.equal(p.video.paused, true);
    }
});

test('reduced-motion and data-saver keep the poster until explicit play', async () => {
    for (const options of [{ reduced: true }, { saveData: true }]) {
        const p = await player(options);
        p.visibility(true);
        assert.equal(p.video.src, undefined);
        p.controls.click();
        assert.equal(p.video.src, 'mobile.mp4');
        assert.equal(p.video.plays, 1);
        p.controls.click();
        p.visibility(false);
        p.visibility(true);
        assert.equal(p.video.paused, true, 'manual pause persists');
    }
});

test('immutable caching is limited to content-addressed assets; APIs remain no-store', async () => {
    const config = JSON.parse(await read('vercel.json'));
    const headers = path => config.headers.find(entry => entry.source === path).headers;
    assert.match(headers('/foco/_assets/:path*').find(h => h.key === 'Cache-Control').value, /max-age=31536000, immutable/);
    assert.equal(headers('/api/:path*').find(h => h.key === 'Cache-Control').value, 'no-store');
});

test('carousel measures after layout, caches targets during scroll and keeps keyboard navigation', async () => {
    const operations = [], events = {}, frames = [], buttons = [];
    let resize, left = 0;
    const write = () => operations.push('write');
    const readGeometry = value => { operations.push('read'); return value; };
    const button = dataset => {
        const listeners = {};
        const value = { dataset, listeners, setAttribute: write, removeAttribute: write,
            set disabled(value) { write(); }, addEventListener: (event, fn) => { listeners[event] = fn; } };
        buttons.push(value);
        return value;
    };
    const dots = [0, 1, 2].map(i => button({ feature: i }));
    const previous = button({ direction: -1 }), next = button({ direction: 1 });
    const toolbar = { set hidden(value) { write(); }, querySelectorAll: () => dots,
        querySelector: selector => selector.includes('-1') ? previous : next };
    const cards = [0, 320, 640].map(value => ({ get offsetLeft() { return readGeometry(value); } }));
    const track = { get scrollWidth() { return readGeometry(940); }, get clientWidth() { return readGeometry(300); },
        get scrollLeft() { return readGeometry(left); }, set tabIndex(value) { write(); },
        querySelectorAll: () => cards, addEventListener: (name, fn) => { events[name] = fn; },
        scrollTo(options) { left = options.left; this.lastScroll = options; } };
    const carousel = { querySelector: selector => ({ '.feature-track': track, '.feature-toolbar': toolbar, '.feature-announcement': {} })[selector] };
    vm.runInNewContext(await read('foco/landing.js'), {
        location: { hash: '' },
        document: { documentElement: { classList: { add() {} } }, querySelectorAll: () => [], querySelector: selector => selector === '.feature-carousel' ? carousel : null },
        window: { ResizeObserver: true, matchMedia: () => ({ matches: false }) },
        ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} },
        requestAnimationFrame: fn => frames.push(fn),
    });
    assert.deepEqual(operations, [], 'no synchronous startup layout measurement');
    resize();
    assert.ok(operations.includes('read'));
    assert.equal(operations.slice(operations.indexOf('write')).includes('read'), false, 'no layout read follows a write');
    operations.length = 0;
    left = 160;
    events.scroll(); events.scroll();
    assert.equal(frames.length, 1, 'scroll events coalesce into one frame');
    frames.shift()();
    assert.equal(operations.filter(op => op === 'read').length, 1, 'only scroll position read; card geometry is cached');
    events.keydown({ key: 'End', preventDefault() {} });
    assert.equal(track.lastScroll.left, 640);
    assert.equal(track.lastScroll.behavior, 'instant');
    events.keydown({ key: 'Home', preventDefault() {} });
    next.listeners.click({ detail: 1 });
    assert.equal(track.lastScroll.left, 320);
    assert.equal(track.lastScroll.behavior, 'smooth');
});
