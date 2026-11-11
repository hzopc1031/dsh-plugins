// Ported from dsh-advisory-impact (hzopc1031, MIT); official source semantics retained.
import { parse, HTMLElement } from 'node-html-parser';
import { SaxesParser } from 'saxes';
import { assertSourceUrl, SourceError, SOURCES } from './http.js';
const CVE = /CVE-\d{4}-\d{4,}/i;
export const FLINK_NOTICE = 'ASF Flink 公告页为实验性，说明覆盖 2023 年以来的公告，可能滞后官方 CVE 发布。';
export const KAFKA_NOTICE = 'Kafka 官方 CVE 页不列出 Kafka 依赖库的安全公告；官方 suppressions 与 ASF 依赖问题说明单独列出。';
const clean = (text) => text.replace(/\s+/g, ' ').trim();
function metadata(doc, root) {
    assertSourceUrl(doc.url);
    if (!Number.isFinite(Date.parse(doc.fetchedAt)))
        throw new SourceError(doc.url, 'Invalid fetch time');
    const sourceTimestamp = root?.querySelector('meta[property="article:modified_time"]')?.getAttribute('content')
        ?? root?.querySelector('meta[itemprop="dateModified"]')?.getAttribute('content')
        ?? doc.sourceTimestamp;
    return { url: doc.url, fetchedAt: doc.fetchedAt, ...(sourceTimestamp ? { sourceTimestamp } : {}) };
}
function html(doc, expectedUrl) {
    if (doc.url !== expectedUrl)
        throw new SourceError(expectedUrl, 'Unexpected source URL');
    // shortcut: these official endpoints return complete HTML documents; revisit if they publish fragments.
    if (!/<html\b/i.test(doc.payload) || !/<\/body\s*>\s*<\/html\s*>\s*$/i.test(doc.payload)) {
        throw new SourceError(doc.url, 'Invalid or truncated HTML document');
    }
    const root = parse(doc.payload, { comment: false });
    for (const node of root.querySelectorAll('script, style, nav, header, footer'))
        node.remove();
    return root;
}
function sections(root) {
    return root.querySelectorAll('h2').filter(h => CVE.test(h.id) || CVE.test(h.textContent)).map(heading => {
        const content = [];
        const siblings = heading.parentNode.childNodes;
        for (const node of siblings.slice(siblings.indexOf(heading) + 1)) {
            if (node instanceof HTMLElement && node.tagName === 'H2')
                break;
            content.push(node.toString());
        }
        return { heading, body: parse(content.join('')) };
    });
}
function fields(body) {
    const result = new Map();
    for (const row of body.querySelectorAll('tr')) {
        const cells = row.querySelectorAll('td, th');
        if (cells.length === 2)
            result.set(clean(cells[0].textContent).toLowerCase().replace(/:$/, ''), clean(cells[1].structuredText));
    }
    for (const li of body.querySelectorAll('li')) {
        const label = li.querySelector('strong');
        if (!label)
            continue;
        const key = clean(label.textContent).replace(/:$/, '');
        result.set(key.toLowerCase(), clean(li.structuredText).slice(key.length).replace(/^\s*:\s*/, '').trim());
    }
    return result;
}
function products(project, title, affected) {
    if (project === 'flink') {
        return [...new Set((affected ?? '').split('\n').map(line => line.match(/^(.+?)\s+(?:from|at|before)\s/i)?.[1]).filter((v) => !!v))];
    }
    const explicit = `${affected ?? ''} ${title}`.match(/(?:Apache )?Kafka (?:Clients?|Connect(?: API)?|Streams)|Apache Hadoop (?:HDFS|YARN|KMS|MapReduce)(?: native client)?|native HDFS client|libhdfs native library/gi);
    return [...new Set(explicit ?? [project === 'kafka' ? 'Apache Kafka' : 'Apache Hadoop'])];
}
export function parseAdvisories(project, doc) {
    const root = html(doc, SOURCES[project]);
    const meta = metadata(doc, root);
    const pageTitle = clean(root.querySelector('title')?.textContent ?? '');
    if (!pageTitle.toLowerCase().includes(project))
        throw new SourceError(doc.url, 'Unexpected advisory page title');
    const blocks = sections(root);
    if (!blocks.length)
        throw new SourceError(doc.url, 'No official advisory sections found; source may have changed');
    const ids = new Set();
    const advisories = blocks.map(({ heading, body }) => {
        const id = (heading.id.match(CVE) ?? heading.textContent.match(CVE))[0].toUpperCase();
        if (ids.has(id))
            throw new SourceError(doc.url, `Duplicate advisory section ${id}`);
        ids.add(id);
        const title = clean(heading.textContent).replace(new RegExp(`^${id}\\s*:?\\s*`, 'i'), '');
        const values = fields(body);
        let affectedText = values.get('versions affected') ?? null;
        let fixedText = values.get('fixed versions') ?? null;
        let sourceTimestamp = meta.sourceTimestamp;
        let notes;
        if (project === 'flink') {
            const affected = body.querySelectorAll('h3').find(h => clean(h.textContent) === 'Affected');
            const list = affected?.nextElementSibling;
            if (list?.tagName === 'UL')
                affectedText = list.querySelectorAll('li').map(li => clean(li.structuredText)).join('\n');
            const text = body.structuredText;
            sourceTimestamp = text.match(/Last updated:\s*(\S+)/i)?.[1] ?? sourceTimestamp;
            // Keep the source's recommendation sentence intact; no inferred fixed version from a range bound.
            fixedText = text.split(/(?<=[.!?])\s+|\n+/).filter(s => /\b(?:upgrade|update)\b/i.test(s) && /\d+\.\d+/.test(s)).map(clean).join('\n') || null;
            notes = [text.trim()];
        }
        else {
            notes = body.querySelectorAll('p, pre').filter(p => !p.closest('table, li')).map(p => clean(p.structuredText)).filter(Boolean);
            for (const [key, value] of values)
                if (!['versions affected', 'fixed versions'].includes(key))
                    notes.push(`${key}: ${value}`);
        }
        if (!title || !affectedText || (project === 'kafka' && !fixedText)) {
            throw new SourceError(doc.url, `Incomplete advisory section ${id}`);
        }
        return {
            ...meta, url: heading.id ? `${doc.url}#${heading.id}` : doc.url,
            ...(sourceTimestamp ? { sourceTimestamp } : {}),
            id, project, title, products: products(project, title, affectedText), affectedText, fixedText,
            ...(values.has('issue announced') ? { announcedAt: values.get('issue announced') } : {}),
            notes,
        };
    });
    const notices = project === 'flink' ? [FLINK_NOTICE] : project === 'kafka' ? [KAFKA_NOTICE] : [];
    return { ...meta, project, advisories, notices };
}
export function fetchAdvisories(project, http) {
    return http(SOURCES[project]).then(doc => parseAdvisories(project, doc));
}
export function parseSuppressions(doc) {
    if (doc.url !== SOURCES.suppressions)
        throw new SourceError(SOURCES.suppressions, 'Unexpected suppressions URL');
    const meta = metadata(doc);
    const parser = new SaxesParser({ xmlns: true });
    const stack = [];
    const suppressions = [];
    let ids = [];
    let notes = '';
    let cve = '';
    let rootSeen = false;
    let namespace = '';
    parser.on('doctype', () => { throw new Error('XML DTD is not allowed'); });
    parser.on('opentag', tag => {
        if (!stack.length) {
            if (rootSeen || tag.local !== 'suppressions' || !/^https:\/\/jeremylong\.github\.io\/DependencyCheck\/dependency-suppression\.\d+(?:\.\d+)*\.xsd$/.test(tag.uri)) {
                throw new Error('Unexpected suppressions XML root or namespace');
            }
            rootSeen = true;
            namespace = tag.uri;
        }
        if (tag.uri !== namespace || stack.length && Object.keys(tag.attributes).length)
            throw new Error('Unsupported suppression namespace or attributes');
        if (tag.local === 'suppress') {
            if (stack.length !== 1)
                throw new Error('Unexpected nested suppression');
            ids = [];
            notes = '';
        }
        // shortcut: unconditional notes + CVE suppressions only; add explicit scope handling before accepting conditions.
        if (stack.length === 1 && tag.local !== 'suppress'
            || stack.length === 2 && !['notes', 'cve'].includes(tag.local)
            || stack.length > 2)
            throw new Error('Unsupported suppression structure');
        if (tag.local === 'cve')
            cve = '';
        stack.push(tag.local);
    });
    const text = (value) => {
        if (stack.at(-1) === 'notes')
            notes += value;
        if (stack.at(-1) === 'cve')
            cve += value;
    };
    parser.on('text', text);
    parser.on('cdata', text);
    parser.on('closetag', tag => {
        if (tag.local === 'cve') {
            const id = clean(cve);
            if (!/^CVE-\d{4}-\d{4,}$/.test(id))
                throw new Error('Invalid suppression CVE id');
            ids.push(id);
        }
        if (tag.local === 'suppress') {
            if (!ids.length || !clean(notes))
                throw new Error('Suppression missing CVE or official notes');
            for (const id of ids)
                suppressions.push({ ...meta, id, notes: clean(notes) });
        }
        stack.pop();
    });
    try {
        parser.write(doc.payload).close();
        if (!rootSeen || stack.length)
            throw new Error('Incomplete suppressions XML');
    }
    catch (error) {
        throw new SourceError(doc.url, 'Invalid or truncated suppressions XML', { cause: error });
    }
    return { ...meta, suppressions, guidanceUrl: SOURCES.guidance };
}
export function fetchSuppressions(http) {
    return http(SOURCES.suppressions).then(parseSuppressions);
}
function reference(doc, kind) {
    const root = html(doc, kind === 'pointer' ? SOURCES.flinkPointer : SOURCES.guidance);
    const meta = metadata(doc, root);
    const title = clean(root.querySelector('title')?.textContent ?? '');
    const content = root.querySelector('main') ?? root.querySelector('article');
    const text = content?.structuredText.trim() ?? '';
    const expected = kind === 'pointer' ? /does not maintain its own CVE list/i : /don[’']t accept the simple fact/i;
    if (!expected.test(text))
        throw new SourceError(doc.url, 'Missing official pointer or dependency guidance text');
    const links = [...new Set((content?.querySelectorAll('a[href]') ?? []).map(a => {
            try {
                return new URL(a.getAttribute('href'), doc.url).href;
            }
            catch {
                return '';
            }
        }).filter(link => link.startsWith('https://')))];
    if (kind === 'pointer' && !links.includes(SOURCES.flink))
        throw new SourceError(doc.url, 'Missing ASF Flink advisories pointer');
    return { ...meta, kind, title, text, links };
}
export function fetchFlinkPointer(http) {
    return http(SOURCES.flinkPointer).then(parseFlinkPointer);
}
export function fetchDependencyGuidance(http) {
    return http(SOURCES.guidance).then(parseDependencyGuidance);
}
export const parseFlinkPointer = (doc) => reference(doc, 'pointer');
export const parseDependencyGuidance = (doc) => reference(doc, 'guidance');
