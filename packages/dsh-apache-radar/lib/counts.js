import { message } from './messages.js';
import { SOURCES, fetchChooser, fetchCommittees, fetchPodlings, fetchPublicPodlings, fetchRetiredCommittees, fetchRetiredProjects, fetchAtticProjects, } from './fetchers.js';
import { readCachedSource } from './feed-cache.js';
const fetchers = {
    chooser: fetchChooser, committees: fetchCommittees, podlings: fetchPodlings,
    publicPodlings: fetchPublicPodlings, retired: fetchRetiredCommittees,
    retiredProjects: fetchRetiredProjects, attic: fetchAtticProjects,
};
export function singaporeTime(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime()))
        throw new Error(`Invalid fetch time: ${timestamp}`);
    return `${new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(date)} Asia/Singapore (UTC+8)`;
}
const errorText = (error) => error instanceof Error ? error.message : String(error);
const sorted = (members) => [...members].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const tlps = (data) => [...new Set(data.projects
        .filter(p => p.pmc !== 'incubator' && p.pmc !== 'attic').map(p => p.pmc))];
const chooserPodlings = (data) => data.projects
    .filter(p => p.pmc === 'incubator').map(p => ({ id: p.id.replace(/^incubator-/, ''), name: p.name }));
const currentPodlings = (data) => data.filter(p => p.status === 'current');
export function buildCountsReport(inputs) {
    function source(key) {
        const input = inputs[key];
        if (!input)
            throw new Error(message('counts.missingSource', { url: SOURCES[key] }));
        if ('error' in input)
            throw new Error(input.error);
        return input;
    }
    function citation(key) {
        const input = inputs[key];
        if (!input || 'error' in input)
            return { url: SOURCES[key], fetchedAt: null, fetchedAtDisplay: null };
        return { url: input.url, fetchedAt: input.fetchedAt, fetchedAtDisplay: singaporeTime(input.fetchedAt),
            ...(input.cacheStatus === undefined ? {} : { cacheStatus: input.cacheStatus }),
            ...(input.cacheError === undefined ? {} : { cacheError: input.cacheError }),
            ...(input.sourceTimestamp === undefined ? {} : { sourceTimestamp: input.sourceTimestamp }) };
    }
    function measure(id, label, key, value, note) {
        const evidence = { id, label, sources: [citation(key)], note };
        try {
            return { ...evidence, status: 'ok', value: value(source(key).data) };
        }
        catch (error) {
            return { ...evidence, status: 'error', error: errorText(error) };
        }
    }
    function compare(id, label, left, right, leftMembers, rightMembers, note) {
        const evidence = { id, label, sources: [citation(left), citation(right)], note };
        try {
            const l = leftMembers(source(left).data);
            const r = rightMembers(source(right).data);
            const leftIds = new Set(l.map(m => m.id));
            const rightIds = new Set(r.map(m => m.id));
            const onlyLeft = sorted(l.filter(m => !rightIds.has(m.id)));
            const onlyRight = sorted(r.filter(m => !leftIds.has(m.id)));
            return { ...evidence, status: onlyLeft.length || onlyRight.length ? 'mismatch' : 'match', onlyLeft, onlyRight };
        }
        catch (error) {
            return { ...evidence, status: 'error', error: errorText(error) };
        }
    }
    const counts = [
        measure('currently-listed', message('counts.current'), 'chooser', data => tlps(data).length + chooserPodlings(data).length, message('counts.currentNote')),
        measure('chooser-tlps', message('counts.tlps'), 'chooser', data => tlps(data).length, message('counts.tlpsNote')),
        measure('chooser-podlings', message('counts.chooserPodlings'), 'chooser', data => chooserPodlings(data).length, message('counts.chooserPodlingsNote')),
        measure('pmcs', message('counts.pmcs'), 'committees', data => data.pmcCount, message('counts.pmcsNote')),
        measure('all-committees', message('counts.committees'), 'committees', data => data.committeeCount, message('counts.committeesNote')),
        measure('podlings', message('counts.podlings'), 'podlings', data => currentPodlings(data).length, message('counts.podlingsNote')),
        measure('public-podlings', message('counts.publicPodlings'), 'publicPodlings', data => currentPodlings(data).length, message('counts.publicPodlingsNote')),
    ];
    const retired = [
        measure('retired-whimsy', message('counts.retiredWhimsy'), 'retired', data => data.length, message('counts.retiredWhimsyNote')),
        measure('retired-projects', message('counts.retiredProjects'), 'retiredProjects', data => data.length, message('counts.retiredProjectsNote')),
        measure('attic-pmcs', message('counts.atticPmcs'), 'attic', data => data.filter(p => p.type === 'PMC').length, message('counts.atticPmcsNote')),
        measure('attic-subprojects', message('counts.atticSubprojects'), 'attic', data => data.filter(p => p.type === 'Subproject').length, message('counts.atticSubprojectsNote')),
    ];
    const retiredNote = message('counts.retiredComparisonNote');
    const comparisons = [
        compare('tlp-cross-check', message('counts.tlpCheck'), 'chooser', 'committees', data => tlps(data).map(id => ({ id, name: data.projects.find(p => p.pmc === id).name })), data => {
            for (const id of ['incubator', 'attic']) {
                if (!data.committees.some(c => c.id === id && c.pmc))
                    throw new Error(message('counts.missingPmc', { id }));
            }
            return data.committees.filter(c => c.pmc && c.id !== 'incubator' && c.id !== 'attic');
        }, message('counts.tlpCheckNote')),
        compare('podlings-chooser-projects', message('counts.podlingCheck'), 'chooser', 'podlings', chooserPodlings, currentPodlings, message('counts.podlingCheckNote')),
        compare('podlings-projects-whimsy', message('counts.publicPodlingCheck'), 'podlings', 'publicPodlings', currentPodlings, currentPodlings, message('counts.publicPodlingCheckNote')),
        compare('retired-whimsy-projects', message('counts.retiredCheck'), 'retired', 'retiredProjects', data => data, data => data, retiredNote),
        compare('retired-whimsy-attic', message('counts.whimsyAttic'), 'retired', 'attic', data => data, data => data.filter(p => p.type === 'PMC'), retiredNote),
        compare('retired-projects-attic', message('counts.projectsAttic'), 'retiredProjects', 'attic', data => data, data => data.filter(p => p.type === 'PMC'), retiredNote),
    ];
    const categoryEvidence = { id: 'chooser-areas', label: message('counts.categories'), sources: [citation('chooser')] };
    let categories;
    try {
        const { data } = source('chooser');
        categories = { ...categoryEvidence, status: 'ok', official: true, multiLabel: true,
            rows: data.categories.map(label => {
                const members = sorted(data.projects.filter(p => p.areas.includes(label)));
                return { ...measure(label, label, 'chooser', () => members.length, message('counts.categoryNote')),
                    members: members.map(({ id, name }) => ({ id, name })) };
            }) };
    }
    catch (error) {
        categories = { ...categoryEvidence, status: 'error', error: errorText(error) };
    }
    return { timezone: 'Asia/Singapore',
        explanation: message('counts.explanation'),
        counts, retired, comparisons, categories };
}
export async function fetchCountsReport(http, options = {}) {
    const inputs = {};
    // The HTTP client owns concurrency and rate-limit handling; one failure must not erase other sources.
    for (const key of Object.keys(fetchers)) {
        try {
            Object.assign(inputs, { [key]: await readCachedSource(http, SOURCES[key], async (response) => fetchers[key](async () => response), options) });
        }
        catch (error) {
            inputs[key] = { error: errorText(error) };
        }
    }
    return buildCountsReport(inputs);
}
const markdown = (text) => text.replace(/[\\`*_[\]<>|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const membersText = (members) => members.length ? members.map(m => `${markdown(m.name)} (${markdown(m.id)})`).join('、') : message('counts.none');
const citationsText = (sources) => sources.map(s => message('counts.citation', {
    urlLabel: markdown(s.url), url: s.url, fetchedAt: s.fetchedAtDisplay ?? message('display.noFetch'),
    sourceTimestamp: s.sourceTimestamp === undefined ? '' : message('display.sourceTime', { time: markdown(s.sourceTimestamp) }),
    cache: s.fetchedAt ? message(`feed.status.${s.cacheStatus ?? 'ok'}`) : message('counts.noCache'),
    error: s.cacheError ? message('counts.stale', { error: markdown(message('errors.source', { error: s.cacheError })) }) : '',
})).join('； ');
export function renderCountsMarkdown(report) {
    const table = (rows) => [
        message('counts.table'), '| --- | --- | --- | --- |',
        ...rows.map(row => `| ${markdown(row.label)} | ${row.status === 'ok' ? row.value : message('counts.error', { error: markdown(message('errors.source', { error: row.error })) })} | ${citationsText(row.sources)} | ${markdown(row.note)} |`),
    ].join('\n');
    const comparisons = report.comparisons.map(c => message('counts.comparison', {
        label: markdown(c.label), result: c.status === 'error' ? message('counts.error', { error: markdown(message('errors.source', { error: c.error })) })
            : message('counts.difference', { status: message(c.status === 'match' ? 'counts.match' : 'counts.mismatch'), left: membersText(c.onlyLeft), right: membersText(c.onlyRight) }),
        note: markdown(c.note), sources: citationsText(c.sources),
    }));
    const categories = report.categories.status === 'error'
        ? `${message('counts.error', { error: markdown(message('errors.source', { error: report.categories.error })) })}。${citationsText(report.categories.sources)}`
        : `${table(report.categories.rows)}\n\n${report.categories.rows.flatMap(row => row.members ? [`- ${markdown(row.label)}：${membersText(row.members)}`] : []).join('\n')}`;
    return message('counts.markdown', { explanation: report.explanation, counts: table(report.counts), retired: table(report.retired), comparisons: comparisons.join('\n'), categories });
}
