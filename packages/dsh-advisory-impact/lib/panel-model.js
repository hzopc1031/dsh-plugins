export function sourceExpired(source, ttl, now) {
    return !!source.fetchedAt && now - Date.parse(source.fetchedAt) >= ttl;
}
/** Counts describe available evidence, never the absence of a failed inventory. */
export function panelOverview(view, now) {
    const official = view.projects.flatMap(p => (p.source ? [p.source] : []));
    const queries = view.projects.flatMap(p => p.queries.flatMap(q => (q.source ? [q.source] : [])));
    const officialAvailable = view.projects.some(p => p.advisories !== null);
    const officialComplete = view.projects.every(p => p.advisories !== null);
    const osvComplete = view.projects.every(p => p.osvOnly.inventoryAvailable && p.queries.every(q => q.source?.fetchedAt));
    const cards = [
        ...['affected', 'not_affected', 'unknown'].map(key => ({
            key,
            label: { affected: '受影响', not_affected: '不受影响', unknown: '无法判断' }[key],
            value: officialAvailable ? view.counts[key] : null,
            partial: !officialComplete,
            sources: official
        })),
        {
            key: 'suppressions',
            label: '官方不适用说明',
            value: view.suppressions.items ? view.counts.suppressions : null,
            partial: view.suppressions.items === null,
            sources: view.suppressions.source ? [view.suppressions.source] : []
        },
        {
            key: 'osvOnly',
            label: '仅见 OSV',
            value: queries.some(s => s.fetchedAt) ? view.counts.osvOnly : null,
            partial: !osvComplete,
            sources: [...official, ...queries]
        }
    ];
    const sources = [
        ...official,
        ...queries,
        view.suppressions.source,
        view.guidance,
        view.flinkPointer,
        ...view.projects.flatMap(p => (p.advisories ?? []).map(a => a.osv.lookup))
    ].filter((s) => !!s);
    return {
        cards: cards.map(card => ({
            ...card,
            oldestFetchTime: card.sources
                .filter(s => s.fetchedAt)
                .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt))[0]?.fetchedTime
        })),
        stale: sources.some(s => s.state === 'stale' || sourceExpired(s, view.settings.cacheTtlMs, now)),
        failed: sources.some(s => s.error || s.cacheError) || view.projects.some(p => p.error)
    };
}
