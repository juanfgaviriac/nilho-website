// Apply to current pages only, never to accepted policy archives.
// Functional SVG controls are drawings, so iOS cannot substitute emoji glyphs.
export function renderArrowFreePage(html) {
    return html.replace(/\s*<span aria-hidden="true">[←↑→↓↖↗↘↙]\uFE0F?<\/span>\s*/g, '')
        .replaceAll(' → ', ' / ');
}
