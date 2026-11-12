import { message } from './messages.js';
import { parse } from 'parse5';
import { clean, elements, fetchReleases, link, object, SOURCES, text } from './fetchers.js';
import { singaporeTime } from './counts.js';
import { resolveWatchList } from './watch.js';
import { readCachedSource } from './feed-cache.js';
export const PROPOSAL_SOURCES = {
    kafka: 'https://cwiki.apache.org/confluence/spaces/KAFKA/pages/50859233/Kafka+Improvement+Proposals',
    flink: 'https://cwiki.apache.org/confluence/spaces/FLINK/pages/65145551/Flink+Improvement+Proposals',
};
export const KAFKA_DOWNLOADS = 'https://kafka.apache.org/community/downloads/';
const jiraProjects = {
    kafka: ['KAFKA'], hadoop: ['HADOOP', 'HDFS', 'MAPREDUCE', 'YARN'], flink: ['FLINK'],
};
export function rollingWindow(now = new Date(), days = 7) {
    if (!Number.isFinite(now.getTime()) || !Number.isSafeInteger(days) || days <= 0)
        throw new Error('Invalid rolling window');
    const start = new Date(now.getTime() - days * 86_400_000).toISOString();
    const end = now.toISOString();
    return { start, end, days, timezone: 'Asia/Singapore', mode: 'rolling',
        label: message('feed.window', { days, start: singaporeTime(start), end: singaporeTime(end) }) };
}
export function isSecurityItem(item) {
    return /\bCVE-\d{4}-\d+\b|\bsecurity\b|安全公告|漏洞/i.test(`${item.title} ${item.issueType ?? ''}`);
}
function date(value) {
    const result = text(value);
    const day = result.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day)
        throw new Error('Invalid feed date');
    if (result === day)
        return result;
    if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(result) && Number.isFinite(Date.parse(result)))
        return result;
    throw new Error('Invalid feed date');
}
function sourceTime(root) {
    const value = root.generated ?? root.last_updated;
    return value === undefined ? undefined : text(value);
}
function list(value) {
    if (!Array.isArray(value))
        throw new Error('Expected source array');
    return value;
}
export function jiraSearchUrl(project, window) {
    if (!Object.hasOwn(jiraProjects, project))
        throw new Error('JIRA adapter unavailable for this watched project');
    // JIRA's anonymous server timezone is unspecified; overfetch boundary days and filter returned timestamps locally.
    const lower = new Date(Date.parse(window.start) - 86_400_000).toISOString().slice(0, 10);
    const upper = new Date(Date.parse(window.end) + 2 * 86_400_000).toISOString().slice(0, 10);
    const jql = `project in (${jiraProjects[project].join(',')}) AND updated >= "${lower}" AND updated < "${upper}" ORDER BY updated DESC, key ASC`;
    const url = new URL('https://issues.apache.org/jira/rest/api/2/search');
    url.search = new URLSearchParams({ jql, maxResults: '100', startAt: '0', fields: 'summary,issuetype,fixVersions,status,created,updated' }).toString();
    return url.href;
}
export function parseJira(payload, project, url) {
    if (!Object.hasOwn(jiraProjects, project))
        throw new Error('JIRA adapter unavailable for this watched project');
    const root = object(JSON.parse(payload));
    const issues = list(root.issues);
    for (const field of ['total', 'startAt', 'maxResults']) {
        if (!Number.isSafeInteger(root[field]) || root[field] < 0)
            throw new Error('Invalid JIRA pagination');
    }
    if (root.total < root.startAt + issues.length || issues.length > root.maxResults)
        throw new Error('Inconsistent JIRA pagination');
    const warnings = [message('feed.jiraWarning')];
    // shortcut: one capped JIRA page per watched project; add polite pagination if complete history is required.
    if (root.startAt !== 0 || root.total > issues.length)
        warnings.push(message('feed.partialJira'));
    const data = issues.map(value => {
        const issue = object(value);
        const key = text(issue.key);
        if (!jiraProjects[project].some(prefix => new RegExp(`^${prefix}-[1-9][0-9]*$`).test(key)))
            throw new Error('JIRA returned an unwatched project');
        const fields = object(issue.fields);
        const dateBasis = fields.updated !== undefined ? 'updated' : fields.created !== undefined ? 'created' : undefined;
        return { project, kind: 'jira', title: text(fields.summary), key,
            url: `https://issues.apache.org/jira/browse/${key}`, sourceUrl: url,
            status: text(object(fields.status).name), issueType: text(object(fields.issuetype).name),
            fixVersions: list(fields.fixVersions).map(v => text(object(v).name)),
            ...(dateBasis ? { date: date(fields[dateBasis]), dateBasis } : {}),
        };
    });
    if (data.some(item => !item.date))
        warnings.push(message('feed.undatedJira'));
    return { data, sourceTimestamp: sourceTime(root), warnings };
}
function html(payload) {
    if (!/<\/html>\s*$/i.test(payload))
        throw new Error('Truncated feed HTML');
    return parse(payload);
}
export function parseProposals(payload, project) {
    const document = html(payload);
    const prefix = project === 'kafka' ? /\bKIP[- ]\d+/i : /\bFLIP[- ]\d+/i;
    const data = [];
    const warnings = [];
    let section;
    let tables = 0;
    function walk(node) {
        if ('tagName' in node && node.tagName === 'h2') {
            const heading = clean(node);
            section = /under discussion/i.test(heading) ? 'discussion'
                : /^(adopted kips|accepted)$/i.test(heading) ? 'accepted'
                    : /^implemented$/i.test(heading) ? 'implemented'
                        : /^released$/i.test(heading) ? 'released'
                            : /^discarded$/i.test(heading) ? 'discarded' : undefined;
        }
        if ('tagName' in node && node.tagName === 'table' && section) {
            const headers = elements(node, 'th').map(clean);
            if (!/^(KIP|Title)/.test(headers[0] ?? ''))
                throw new Error('Missing proposal table header');
            tables++;
            for (const row of elements(node, 'tr')) {
                const cells = elements(row, 'td');
                if (!cells.length)
                    continue;
                if (cells.length < 2)
                    throw new Error('Invalid proposal row');
                const a = elements(cells[0], 'a').find(a => prefix.test(clean(a)));
                if (!a) {
                    warnings.push(message('feed.skippedProposal'));
                    continue;
                }
                const href = a.attrs.find(attr => attr.name === 'href')?.value;
                if (!href) {
                    warnings.push(message('feed.skippedProposal'));
                    continue;
                }
                const url = link(new URL(href, PROPOSAL_SOURCES[project]).href);
                if (new URL(url).hostname !== 'cwiki.apache.org')
                    throw new Error('Invalid proposal original URL');
                const statusText = clean(cells[1]);
                const status = /\bimplemented\b/i.test(statusText) && !/\b(not|unimplemented)\b/i.test(statusText) ? 'implemented' : section;
                const time = elements(row, 'time')[0]?.attrs.find(attr => attr.name === 'datetime')?.value;
                data.push({ project, kind: 'proposal', title: text(clean(cells[0])), url, sourceUrl: PROPOSAL_SOURCES[project],
                    status, statusText: `${section}; ${statusText}`,
                    ...(time ? { date: date(time), dateBasis: 'source-date' } : {}) });
            }
            return;
        }
        if ('childNodes' in node)
            node.childNodes.forEach(walk);
    }
    walk(document);
    if (!tables)
        throw new Error('Missing proposal index tables');
    if (data.some(item => !item.date))
        warnings.push(message('feed.undatedProposals'));
    return { data, warnings: [...new Set(warnings)] };
}
export function parseKafkaNotes(payload) {
    const document = html(payload);
    const data = new Map();
    let version;
    function walk(node) {
        if ('tagName' in node && /^h[1-6]$/.test(node.tagName)) {
            const title = clean(node);
            version = /^\d+\.\d+\.\d+(?:[-.\w]*)?$/.test(title) ? title : undefined;
        }
        if ('tagName' in node && node.tagName === 'a' && version && clean(node) === 'Release Notes') {
            const href = node.attrs.find(attr => attr.name === 'href')?.value;
            if (href)
                data.set(`Kafka-${version}`, link(new URL(href, KAFKA_DOWNLOADS).href));
        }
        if ('childNodes' in node)
            node.childNodes.forEach(walk);
    }
    walk(document);
    if (!elements(document, 'h3').length)
        throw new Error('Missing Kafka download version headings');
    return { data, warnings: [] };
}
export async function collectWatchFeeds(http, options = {}) {
    const watchList = resolveWatchList(options.watchList);
    const now = options.now ?? new Date();
    const window = rollingWindow(options.windowEnd ?? now, options.days);
    const ttlMs = options.ttlMs ?? 3_600_000;
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 0)
        throw new Error('Invalid feed cache TTL');
    const cache = options.cache ?? new Map();
    const report = { watchList, window, sources: [], items: [], undatedItems: [] };
    async function read(kind, url, parser, project) {
        const source = { project, kind, url, status: 'ok', warnings: [] };
        report.sources.push(source);
        try {
            const result = await readCachedSource(http, url, response => parser(response.payload), { cache, now, ttlMs });
            Object.assign(source, { status: result.cacheStatus, fetchedAt: result.fetchedAt,
                sourceTimestamp: result.sourceTimestamp, warnings: result.warnings, error: result.cacheError });
            return result.data;
        }
        catch (error) {
            source.status = 'failed';
            source.error = error instanceof Error ? error.message : String(error);
            return undefined;
        }
    }
    function add(items) {
        for (const item of items) {
            if (!item.date) {
                report.undatedItems.push(item);
                continue;
            }
            const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(item.date) ? `${item.date}T00:00:00+08:00` : item.date);
            if (time >= Date.parse(window.start) && time <= Date.parse(window.end))
                report.items.push(item);
        }
    }
    if (!watchList.length)
        return report;
    const releases = await read('release', SOURCES.releases, async (payload) => {
        const result = await fetchReleases(async (url) => ({ url, payload, fetchedAt: now.toISOString() }));
        return { data: result.data, sourceTimestamp: result.sourceTimestamp, warnings: [] };
    });
    for (const project of watchList) {
        const notes = project === 'kafka' ? await read('release-notes', KAFKA_DOWNLOADS, parseKafkaNotes, project) : undefined;
        const notesSource = report.sources.find(source => source.project === project && source.kind === 'release-notes');
        add((releases ?? []).filter(item => item.project === project).map(item => ({
            ...item, kind: 'release', title: item.version, sourceUrl: SOURCES.releases, dateBasis: 'catalogue-day', status: 'catalogued',
            notesUrl: notes?.get(item.version), notesStatus: notes?.has(item.version) ? 'found'
                : notesSource?.status === 'failed' || notesSource?.status === 'stale' ? 'failed' : 'missing',
            statusText: notes?.has(item.version) ? message('feed.notesFound') : message('feed.notesMissing'),
        })));
        if (Object.hasOwn(jiraProjects, project)) {
            const url = jiraSearchUrl(project, window);
            const items = await read('jira', url, payload => parseJira(payload, project, url), project);
            if (items)
                add(items);
        }
        else
            report.sources.push({ project, kind: 'jira', status: 'unavailable', warnings: [message('feed.noJira')] });
        if (project === 'kafka' || project === 'flink') {
            const items = await read('proposal', PROPOSAL_SOURCES[project], payload => parseProposals(payload, project), project);
            if (items)
                add(items);
        }
        else
            report.sources.push({ project, kind: 'proposal', status: 'unavailable', warnings: [project === 'hadoop'
                        ? message('feed.noHip')
                        : message('feed.noProposal')] });
    }
    return report;
}
