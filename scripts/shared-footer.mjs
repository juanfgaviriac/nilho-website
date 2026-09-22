// The homepage is the single source for every current Foco page's footer.
// Apply only at publication time; accepted policy archives stay untouched.
export function renderSharedFooter(html, homepage) {
    const footers = homepage.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/g);
    if (footers?.length !== 1) throw new Error('Expected one homepage footer.');
    if ((html.match(/<footer\b/g) || []).length !== 1) throw new Error('Expected one page footer.');
    return html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/, () => footers[0]);
}
