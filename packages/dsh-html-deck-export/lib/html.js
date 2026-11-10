export function decodeEntities(value) {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, name) => {
        if (!name.startsWith('#'))
            return named[name] ?? entity;
        const code = name[1]?.toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd';
    });
}
export function hasClass(node, name) {
    return (node.attrs.class ?? '').split(/\s+/).includes(name);
}
export function ancestors(node) {
    return node.parent ? [node.parent, ...ancestors(node.parent)] : [];
}
// shortcut: explicit, balanced deck markup only; use an HTML5 parser if browser-repaired markup is needed.
export function parseElements(html) {
    const nodes = [];
    const stack = [];
    const counts = new Map();
    const tags = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][\w:-]*(?:\s+(?:[^'">]|"[^"]*"|'[^']*')*)?\s*\/?>/g;
    const voids = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
    for (let match; (match = tags.exec(html));) {
        const token = match[0];
        if (token.startsWith('<!'))
            continue;
        const opening = /^<\/?([\w:-]+)/.exec(token);
        const tag = opening[1].toLowerCase();
        if (token.startsWith('</')) {
            if (voids.has(tag))
                continue;
            if (stack.at(-1)?.tag !== tag)
                throw new Error(`Unsupported HTML: unbalanced </${tag}>; explicit deck markup is required`);
            stack.pop().end = match.index;
            continue;
        }
        const attrs = Object.create(null);
        const attrText = token.slice(opening[0].length, token.endsWith('/>') ? -2 : -1);
        for (const attr of attrText.matchAll(/([^\s=/'">]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
            const name = attr[1].toLowerCase();
            attrs[name] ??= decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? '');
        }
        const parent = stack.at(-1);
        const siblings = counts.get(parent) ?? new Map();
        counts.set(parent, siblings);
        const nth = (siblings.get(tag) ?? 0) + 1;
        siblings.set(tag, nth);
        const node = {
            tag, attrs, parent, selector: `${parent ? `${parent.selector} > ` : ''}${tag}:nth-of-type(${nth})`,
            start: tags.lastIndex, end: tags.lastIndex,
        };
        nodes.push(node);
        if (['script', 'style', 'textarea', 'title'].includes(tag)) {
            const close = new RegExp(`</${tag}\\s*>`, 'gi');
            close.lastIndex = tags.lastIndex;
            const end = close.exec(html);
            if (!end)
                throw new Error(`Unsupported HTML: unclosed <${tag}>`);
            node.end = end.index;
            tags.lastIndex = close.lastIndex;
        }
        else if (!voids.has(tag)) {
            if (token.endsWith('/>')) {
                if (!['svg', 'math'].includes(tag) && !ancestors(node).some(item => ['svg', 'math'].includes(item.tag))) {
                    throw new Error(`Unsupported HTML: self-closing <${tag}> requires an explicit closing tag`);
                }
            }
            else
                stack.push(node);
        }
    }
    if (stack.length)
        throw new Error(`Unsupported HTML: unclosed <${stack.at(-1).tag}>`);
    return nodes;
}
export function noteText(html) {
    return decodeEntities(html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])\s*>/gi, '\n').replace(/<(?:[^'">]|"[^"]*"|'[^']*')*>/g, ''))
        .split('\n').map(line => line.replace(/[\t\r ]+/g, ' ').trim()).filter(Boolean).join('\n');
}
