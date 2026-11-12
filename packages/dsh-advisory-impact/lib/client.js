window.__ModuleLoader__.load({id:'dsh-advisory-impact',factory:(hostRequire)=>{
const PANEL_CSS=".ai-root {\n  --ai-ink: var(--dsw-alias-label-primary);\n  --ai-muted: var(--dsw-alias-label-secondary);\n  --ai-line: var(--dsw-alias-border-l2);\n  --ai-accent: var(--dsw-alias-state-business-primary);\n  height: 100%; min-height: 0; overflow: auto; color: var(--ai-ink);\n  background: var(--dsw-alias-bg-module-platform); font: inherit; font-size: 13px; line-height: 1.65;\n  container-type: inline-size;\n}\n.ai-root *, .ai-root *::before, .ai-root *::after { box-sizing: border-box; }\n.ai-content { max-width: 1240px; margin: auto; padding: 36px 32px 28px; }\n.ai-root h1, .ai-root h2, .ai-root h3, .ai-root p { margin: 0; }\n.ai-root h1 { font-size: 25px; font-weight: 650; letter-spacing: -.5px; line-height: 1.4; }\n.ai-root h2 { font-size: 16px; font-weight: 600; }\n.ai-root h3 { font-size: 15px; font-weight: 600; margin: 10px 0 6px; }\n.ai-root p + p { margin-top: 6px; }\n.ai-root a { color: var(--ai-accent); text-decoration: none; overflow-wrap: anywhere; }\n.ai-root a:hover { text-decoration: underline; }\n.ai-header, .ai-section-head, .ai-row, .ai-actions, .ai-brand { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }\n.ai-header, .ai-section-head { justify-content: space-between; }\n.ai-brand { gap: 12px; }\n.ai-logo { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; color: var(--ai-accent); background: color-mix(in srgb, var(--ai-accent) 10%, transparent); }\n.ai-eyebrow { display: block; color: var(--ai-muted); font-size: 10px; letter-spacing: 1.8px; font-weight: 600; }\n.ai-lead { margin: 14px 0 24px !important; color: var(--ai-muted); font-size: 14px; }\n.ai-card { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--ai-line); border-radius: 12px; padding: 18px 20px; min-width: 0; overflow-wrap: anywhere; box-shadow: var(--dsw-shadow-lv1); }\n.ai-card + .ai-card { margin-top: 12px; }\n.ai-muted, .ai-root small { color: var(--ai-muted); }\n.ai-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 6px 13px; border: 1px solid var(--ai-line); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--ai-ink); font: inherit; font-weight: 500; cursor: pointer; }\n.ai-button:hover { background: var(--dsw-alias-interactive-bg-hover); }\n.ai-button:disabled { opacity: .5; cursor: default; }\n.ai-primary, .ai-primary:hover { background: var(--ai-accent); color: var(--dsw-alias-label-primary-foreground); border-color: transparent; }\n.ai-root :is(button, input, textarea, summary, a):focus-visible { outline: 2px solid var(--ai-accent); outline-offset: 3px; }\n.ai-root summary { cursor: pointer; font-weight: 500; }\n.ai-setup { margin-bottom: 22px; }\n.ai-setup summary .ai-muted { margin-left: 8px; font-size: 12px; font-weight: 400; }\n.ai-form { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin: 14px 0; }\n.ai-form label { display: flex; flex: 1 1 150px; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ai-muted); }\n.ai-form label.ai-wide { flex-basis: 70%; }\n.ai-root input, .ai-root textarea { background: var(--dsw-alias-bg-layer-2); color: var(--ai-ink); border: 1px solid var(--ai-line); border-radius: 7px; padding: 8px 10px; font: inherit; min-width: 0; width: 100%; }\n.ai-pin { justify-content: space-between; padding: 8px 0; border-top: 1px solid var(--ai-line); }\n.ai-empty { text-align: center; padding: 44px 22px; color: var(--ai-muted); }\n.ai-empty svg { margin: 0 auto 14px; color: var(--ai-accent); }\n.ai-empty h2 { color: var(--ai-ink); margin-bottom: 8px; }\n.ai-empty .ai-button { margin-top: 18px; }\n.ai-banner { border: 1px solid color-mix(in srgb, currentColor 28%, transparent); background: color-mix(in srgb, currentColor 5%, transparent); border-radius: 9px; padding: 12px 16px; margin-bottom: 16px !important; }\n.ai-loading { color: var(--ai-accent); padding: 10px 0; }\n.ai-affected, .ai-error { color: var(--dsw-alias-state-error-primary); }\n.ai-not_affected { color: var(--dsw-alias-state-success-primary); }\n.ai-unknown, .ai-notice { color: var(--dsw-alias-state-warn-label); }\n.ai-error, .ai-notice { overflow-wrap: anywhere; }\n.ai-section { margin: 24px 0 16px; }\n.ai-section-head { margin-bottom: 12px; }\n.ai-section-head .ai-muted { font-size: 12px; }\n.ai-metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }\n.ai-metric { padding: 15px; display: flex; flex-direction: column; gap: 3px; box-shadow: none; }\n.ai-metric + .ai-metric { margin: 0; }\n.ai-metric strong { font-size: 30px; line-height: 1.25; font-weight: 600; font-variant-numeric: tabular-nums; }\n.ai-metric > span, .ai-metric small, .ai-metric details { color: var(--ai-muted); font-size: 12px; }\n.ai-metric details { margin-top: 8px; }\n.ai-metric .ai-evidence { flex-direction: column; align-items: start; }\n.ai-metric .ai-chip { white-space: normal; font-size: 10px; }\n.ai-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 5px; margin-top: 24px; border-bottom: 1px solid var(--ai-line); }\n.ai-tabs .ai-button { border-color: transparent; background: transparent; color: var(--ai-muted); padding: 7px 20px; }\n.ai-tabs .ai-button[aria-pressed=true] { color: var(--ai-accent); background: color-mix(in srgb, var(--ai-accent) 10%, transparent); }\n.ai-verdict { color: var(--ai-ink); border-left: 3px solid var(--ai-line); }\n.ai-verdict.ai-affected { border-left-color: var(--dsw-alias-state-error-primary); }\n.ai-verdict.ai-not_affected { border-left-color: var(--dsw-alias-state-success-primary); }\n.ai-verdict.ai-unknown { border-left-color: var(--dsw-alias-state-warn-label); }\n.ai-badge { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 5px; font-size: 12px; font-weight: 600; background: color-mix(in srgb, currentColor 8%, transparent); }\n.ai-chip { display: inline-flex; align-items: center; padding: 2px 8px; border: 1px solid var(--ai-line); border-radius: 6px; font-size: 11px; line-height: 1.6; max-width: 100%; overflow-wrap: anywhere; }\n.ai-evidence { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin: 10px 0; color: var(--ai-muted); }\n.ai-evidence .ai-error { width: 100%; }\n.ai-range { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; padding: 12px; background: var(--dsw-alias-bg-module-platform); border-radius: 8px; }\n.ai-range dt { color: var(--ai-muted); font-size: 11px; margin-bottom: 3px; }\n.ai-range dd { margin: 0; font-size: 12px; white-space: pre-wrap; }\n.ai-notes { margin: 12px 0; color: var(--ai-muted); }\n.ai-notes p { margin-top: 6px; font-size: 12px; }\n.ai-osv { border-top: 1px solid var(--ai-line); padding-top: 10px; margin-top: 12px; font-size: 12px; }\n.ai-more { width: 100%; margin: 14px 0; }\n.ai-suppression { padding-top: 20px; border-top: 1px solid var(--ai-line); }\n.ai-report { height: 320px; resize: vertical; margin-bottom: 12px; font-family: var(--ds-font-family-code, monospace) !important; font-size: 12px !important; }\n.ai-footer { padding: 24px 0 0; color: var(--ai-muted); font-size: 11px; }\n@container (max-width: 900px) { .ai-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); } }\n@container (max-width: 600px) { .ai-content { padding: 24px 16px; } .ai-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } .ai-range { grid-template-columns: 1fr; } .ai-actions { margin-top: 12px; } .ai-card { padding: 15px; } }\n";
const settings={exports:{}};
((module,exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkSettings = NetworkSettings;
// Vendored identically in apache-radar, advisory-impact and github-triage; keep these copies in sync.
const react_1 = require("react");
function NetworkSettings({ view, form }) {
    const [saving, setSaving] = (0, react_1.useState)(false), [error, setError] = (0, react_1.useState)('');
    if (view === 'summary')
        return '网络设置';
    return (0, react_1.createElement)('section', { 'aria-label': '网络设置' }, (0, react_1.createElement)('label', null, (0, react_1.createElement)('input', {
        type: 'checkbox', checked: form?.state.value?.insecureSkipTlsVerifyHosts === true,
        disabled: !form?.state.writable || saving,
        onChange: async (event) => {
            const value = event.target.checked;
            setSaving(true);
            setError('');
            try {
                if (!await form?.mutate([{ op: 'set', path: ['insecureSkipTlsVerifyHosts'], value }], form.state.revision))
                    throw new Error();
            }
            catch {
                setError('网络设置保存失败，请重试。');
            }
            finally {
                setSaving(false);
            }
        },
    }), '不安全：仅跳过 OSV / GitHub API 证书校验'), error && (0, react_1.createElement)('span', { role: 'alert' }, error));
}

})(settings,settings.exports,hostRequire);
const model={exports:{}};
((module,exports)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceExpired = sourceExpired;
exports.panelOverview = panelOverview;
function sourceExpired(source, ttl, now) {
    return !!source.fetchedAt && now - Date.parse(source.fetchedAt) >= ttl;
}
/** Counts describe available evidence, never the absence of a failed inventory. */
function panelOverview(view, now) {
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

})(model,model.exports);
const require=id=>id==='./panel-model.js'?model.exports:id==='./network-settings.js'?settings.exports:hostRequire(id);
const module={exports:{}};const exports=module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = exports.name = void 0;
exports.Panel = Panel;
exports.apply = apply;
const network_settings_js_1 = require("./network-settings.js");
const React = require("react");
const panel_model_js_1 = require("./panel-model.js");
exports.name = 'advisory-impact';
exports.inject = ['slots'];
const sourceError = (error) => error && !error.includes('TLS_KEY_TOO_SMALL') && /fetch failed|NETWORK_ERROR|ECONN|ETIMEDOUT|ENOTFOUND|UND_ERR_|CERT|SIGNATURE|ISSUER|HTTP[ _]\d{3}/i.test(error) ? '来源不可用 · 见网络诊断' : error;
const title = (id) => ({ kafka: 'Kafka', hadoop: 'Hadoop', flink: 'Flink' })[id] ?? id;
const safeUrl = (url) => (/^https?:\/\//.test(url) ? url : undefined);
const Link = ({ url, children }) => (React.createElement("a", { href: safeUrl(url), target: "_blank", rel: "noreferrer" }, children, " \u2197"));
function Shield({ size = 22 }) {
    return (React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", "aria-hidden": "true" }, React.createElement("path", { d: "M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6Z" }), React.createElement("path", { d: "m8 12 3 3 5-6" })));
}
function Evidence({ source, ttl, now, label }) {
    if (!source)
        return React.createElement("span", { className: "ai-muted" }, label ?? '来源', "\uFF1A\u672A\u83B7\u53D6");
    const expired = (0, panel_model_js_1.sourceExpired)(source, ttl, now);
    return (React.createElement("div", { className: "ai-evidence" }, React.createElement("span", { className: "ai-chip" }, React.createElement(Link, { url: source.url }, label ?? new URL(source.url).hostname)), React.createElement("span", { className: "ai-chip" }, source.fetchedTime ? `抓取 ${source.fetchedTime}` : '未取得成功数据'), React.createElement("span", { className: `ai-chip ${source.state === 'error' ? 'ai-affected' : source.state === 'stale' || expired ? 'ai-unknown' : ''}` }, expired && source.state !== 'stale' ? '缓存已过期，待刷新' : source.label), source.sourceTimestamp && React.createElement("span", { className: "ai-chip" }, "\u9875\u9762\u65F6\u95F4 ", source.sourceTimestamp), (source.error || source.cacheError) && (React.createElement("p", { className: "ai-error" }, sourceError(source.error), source.cacheError ? ` · 缓存：${sourceError(source.cacheError)}` : ''))));
}
function MoreList({ items, render }) {
    const [limit, setLimit] = React.useState(6);
    return (React.createElement(React.Fragment, null, items.slice(0, limit).map(render), limit < items.length && (React.createElement("button", { className: "ai-button ai-more", onClick: () => setLimit(n => n + 12) }, "\u663E\u793A\u66F4\u591A\uFF08\u8FD8\u6709 ", items.length - limit, " \u6761\uFF09"))));
}
function AdvisoryCard({ item, ttl, now }) {
    return (React.createElement("article", { className: `ai-card ai-verdict ai-${item.verdict}` }, React.createElement("div", { className: "ai-row" }, React.createElement("span", { className: `ai-badge ai-${item.verdict}` }, item.label), React.createElement(Link, { url: item.url }, item.id), item.announcedAt && React.createElement("span", { className: "ai-muted" }, item.announcedAt)), React.createElement("h3", null, item.title), React.createElement("p", null, item.reason), React.createElement("div", { className: "ai-evidence" }, React.createElement("span", { className: "ai-chip" }, React.createElement(Link, { url: item.url }, "\u5B98\u65B9\u539F\u6587")), React.createElement("span", { className: "ai-chip" }, "\u6293\u53D6 ", item.fetchedTime), item.sourceTimestamp && React.createElement("span", { className: "ai-chip" }, "\u9875\u9762\u65F6\u95F4 ", item.sourceTimestamp)), item.pins.map((p, i) => (React.createElement("p", { key: i, className: "ai-muted" }, "\u8FD0\u884C ", p.pin.version, p.pin.component ? ` · ${p.pin.component}` : '', " \u2192", ' ', React.createElement("span", { className: `ai-${p.verdict}` }, p.label), " \u00B7 ", p.reason))), React.createElement("dl", { className: "ai-range" }, React.createElement("div", null, React.createElement("dt", null, "\u5F71\u54CD\u8303\u56F4\u539F\u6587"), React.createElement("dd", null, item.affectedText || '官方未明确列出，无法据此推断')), React.createElement("div", null, React.createElement("dt", null, "\u5B98\u65B9\u4FEE\u590D\u7248\u672C"), React.createElement("dd", null, item.fixedText || item.fixedVersions?.join('、') || '官方未列出'))), !!item.notes.length && (React.createElement("details", { className: "ai-notes" }, React.createElement("summary", null, "\u9002\u7528\u6761\u4EF6\u4E0E\u5B98\u65B9\u8BF4\u660E"), item.notes.map((note, i) => (React.createElement("p", { key: i }, note))))), !!item.suppressions.length && (React.createElement("p", { className: "ai-notice" }, "\u6B64\u9879\u8FD8\u6709\u5B98\u65B9\u4E0D\u9002\u7528\u8BF4\u660E\uFF0C\u8BF7\u6838\u5BF9\u4E0B\u65B9\u72EC\u7ACB\u5206\u7EC4\u3002")), React.createElement("div", { className: "ai-osv" }, React.createElement("div", { className: "ai-row" }, React.createElement("strong", null, "OSV \u00B7 \u7B2C\u4E8C\u6765\u6E90"), React.createElement("span", { className: "ai-chip" }, item.osv.lookup.statusLabel)), React.createElement("p", { className: ['different_ranges', 'query_disagreement'].includes(item.osv.comparison)
            ? 'ai-notice'
            : 'ai-muted' }, item.osv.note), React.createElement(Evidence, { source: item.osv.lookup, ttl: ttl, now: now, label: "OSV \u8BB0\u5F55" }), item.osv.queryMatches.map((q, i) => (React.createElement("p", { key: i, className: "ai-muted" }, React.createElement(Link, { url: q.url }, "Maven \u67E5\u8BE2\u547D\u4E2D ", q.id), " \u00B7 ", q.query.maven, "@", q.query.version, " \u00B7 \u6293\u53D6", ' ', q.fetchedTime, " \u00B7 ", q.state))))));
}
function ProjectView({ project, ttl, now }) {
    return (React.createElement(React.Fragment, null, React.createElement("section", { className: "ai-section" }, React.createElement("div", { className: "ai-section-head" }, React.createElement("div", null, React.createElement("h2", null, title(project.project), " ", React.createElement("span", { className: "ai-muted" }, "\u5B98\u65B9\u516C\u544A")), React.createElement("p", { className: "ai-muted" }, project.pins.length
        ? project.pins.map(p => `${p.component ?? title(project.project)} ${p.version}`).join(' / ')
        : '未填写运行版本，无法判断'))), React.createElement(Evidence, { source: project.source, ttl: ttl, now: now }), project.project === 'kafka' && React.createElement("p", { className: "ai-muted" }, "Kafka \u5B98\u65B9\u9875\u9762\u4E0D\u5217\u51FA\u5176\u4F9D\u8D56\u9879\u7684\u5B89\u5168\u516C\u544A\u3002"), project.project === 'flink' && (React.createElement("p", { className: "ai-notice" }, "ASF Flink \u9875\u9762\u4E3A\u5B9E\u9A8C\u6027\u5217\u8868\uFF0C\u8986\u76D6 2023 \u5E74\u4EE5\u6765\u7684\u516C\u544A\uFF0C\u53EF\u80FD\u6EDE\u540E\u5B98\u65B9 CVE \u53D1\u5E03\u3002")), project.notices.map((note, i) => (React.createElement("p", { className: "ai-notice", key: i }, note))), project.error && (React.createElement("p", { role: "alert", className: "ai-error" }, sourceError(project.error)))), project.advisories === null ? (React.createElement("div", { className: "ai-card ai-empty" }, "\u5B98\u65B9\u6E05\u5355\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u5224\u65AD\u3002\u6765\u6E90\u5931\u8D25\u4E0D\u4EE3\u8868\u6CA1\u6709\u516C\u544A\uFF0C\u8BF7\u91CD\u8BD5\u5237\u65B0\u3002")) : project.advisories.length === 0 ? (React.createElement("div", { className: "ai-card ai-empty" }, "\u6B64\u6765\u6E90\u672C\u6B21\u6CA1\u6709\u53EF\u5217\u51FA\u7684\u516C\u544A\uFF1B\u8FD9\u4E0D\u662F\u5B89\u5168\u4FDD\u8BC1\u3002")) : (React.createElement("div", { className: "ai-list" }, React.createElement(MoreList, { items: project.advisories, render: item => React.createElement(AdvisoryCard, { key: item.id, item: item, ttl: ttl, now: now }) }))), React.createElement("section", { className: "ai-section" }, React.createElement("h2", null, "\u4EC5\u89C1 OSV\uFF0C\u672A\u89C1\u5B98\u65B9\u516C\u544A"), React.createElement("p", { className: "ai-muted" }, "\u6309\u6240\u586B Maven \u5750\u6807\u67E5\u8BE2\u3002\u6B64\u5904\u4E0D\u4F5C\u5B98\u65B9\u4E09\u6001\u5224\u5B9A\u3002"), project.queries.map((q, i) => (React.createElement("div", { className: "ai-card", key: i }, React.createElement("strong", null, q.query.maven, "@", q.query.version), React.createElement(Evidence, { source: q.source, ttl: ttl, now: now, label: "OSV Maven \u67E5\u8BE2" })))), !project.osvOnly.inventoryAvailable ? (React.createElement("p", { className: "ai-notice" }, "\u5B98\u65B9\u6E05\u5355\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u5B8C\u6210\u4E0E OSV \u7684\u5BF9\u7167\u3002")) : !project.queries.length ? (React.createElement("p", { className: "ai-muted" }, "\u672A\u586B\u5199 Maven \u5750\u6807\uFF0C\u672A\u8FDB\u884C OSV Maven \u67E5\u8BE2\u3002")) : (!project.osvOnly.items.length && (React.createElement("p", { className: "ai-muted" }, "\u5F53\u524D\u5DF2\u83B7\u53D6\u7684\u67E5\u8BE2\u7ED3\u679C\u4E2D\u6CA1\u6709\u53EF\u5217\u51FA\u7684 OSV-only \u6761\u76EE\uFF0C\u8BF7\u540C\u65F6\u68C0\u67E5\u67E5\u8BE2\u6765\u6E90\u72B6\u6001\u3002"))), React.createElement(MoreList, { items: project.osvOnly.items, render: (item, i) => (React.createElement("article", { className: "ai-card", key: i }, React.createElement("div", { className: "ai-row" }, React.createElement(Link, { url: item.url }, item.id), React.createElement("span", { className: "ai-chip" }, "\u4EC5\u7B2C\u4E8C\u6765\u6E90")), React.createElement("p", null, item.summary), React.createElement("p", { className: "ai-muted" }, item.aliases.join(' · '), " \u00B7 ", item.query.maven, "@", item.query.version), React.createElement("div", { className: "ai-evidence" }, React.createElement("span", { className: "ai-chip" }, "\u6293\u53D6 ", item.fetchedTime), React.createElement("span", { className: "ai-chip" }, item.state)))) }))));
}
async function request(directory, action, args = {}) {
    const response = await fetch('advisory-impact/api', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ directory, action, args })
    });
    const data = await response.json().catch(() => ({ error: 'DSH 面板服务不可用，请重新连接或检查插件加载' }));
    if (!response.ok)
        throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
    return data;
}
function Panel() {
    const [directory, setDirectory] = React.useState(''), [activeDirectory, setActiveDirectory] = React.useState('');
    const [settings, setSettings] = React.useState(null), [view, setView] = React.useState(null);
    const [busy, setBusy] = React.useState(''), [error, setError] = React.useState(''), [message, setMessage] = React.useState('');
    const [selected, setSelected] = React.useState(''), [report, setReport] = React.useState(''), [now, setNow] = React.useState(Date.now());
    const [watch, setWatch] = React.useState(''), [pinProject, setPinProject] = React.useState('kafka'), [version, setVersion] = React.useState('');
    const [component, setComponent] = React.useState(''), [maven, setMaven] = React.useState('');
    const locked = React.useRef(false), mounted = React.useRef(true);
    React.useEffect(() => {
        mounted.current = true;
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => {
            mounted.current = false;
            clearInterval(timer);
        };
    }, []);
    const run = async (label, task) => {
        if (locked.current)
            return;
        locked.current = true;
        setBusy(label);
        setError('');
        setMessage('');
        try {
            await task();
        }
        catch (e) {
            if (mounted.current)
                setError(e instanceof Error ? e.message : '操作失败');
        }
        finally {
            locked.current = false;
            if (mounted.current)
                setBusy('');
        }
    };
    const loadView = async (dir, action = 'view') => {
        const result = await request(dir, action);
        if (!mounted.current)
            return;
        if (!result.view)
            throw new Error('未收到可用的核对结果');
        setView(result.view);
        setSettings(result.view.settings);
        setWatch(result.view.settings.watch.join(','));
        setNow(Date.now());
        setSelected(current => result.view.projects.some(p => p.project === current)
            ? current
            : (result.view.projects[0]?.project ?? ''));
    };
    const connect = (event) => {
        event.preventDefault();
        void run('正在读取项目配置…', async () => {
            const dir = directory.trim(), result = await request(dir, 'pin');
            if (!mounted.current)
                return;
            setActiveDirectory(dir);
            setSettings(result.summary);
            setWatch(result.summary.watch.join(','));
            setView(null);
            setReport('');
            setSelected('');
        });
    };
    const edit = (action, args) => run('正在保存配置…', async () => {
        const result = await request(activeDirectory, action, args);
        if (!mounted.current)
            return;
        setSettings(result.summary);
        setWatch(result.summary.watch.join(','));
        setView(null);
        setReport('');
        setMessage('配置已保存，请点击「核对 / 刷新」重新判断。');
    });
    const overview = view ? (0, panel_model_js_1.panelOverview)(view, now) : null;
    const project = view?.projects.find(p => p.project === selected);
    const ttl = view?.settings.cacheTtlMs ?? 0;
    return (React.createElement("div", { className: "ai-root", "aria-busy": !!busy }, React.createElement("div", { className: "ai-content" }, React.createElement("header", { className: "ai-header" }, React.createElement("div", { className: "ai-brand" }, React.createElement("span", { className: "ai-logo" }, React.createElement(Shield, { size: 26 })), React.createElement("div", null, React.createElement("span", { className: "ai-eyebrow" }, "ADVISORY IMPACT"), React.createElement("h1", null, "\u516C\u544A\u5F71\u54CD"))), React.createElement("div", { className: "ai-actions" }, React.createElement("span", { className: "ai-chip" }, "\u672C\u5730\u6838\u5BF9 \u00B7 \u65E0\u9700\u6A21\u578B"), React.createElement("button", { className: "ai-button ai-primary", disabled: !!busy || !activeDirectory, onClick: () => void run('正在抓取官方来源与 OSV，保留上次结果…', () => loadView(activeDirectory, 'refresh')) }, busy ? '处理中…' : view ? '刷新来源' : '核对 / 刷新'))), !!view?.diagnostics?.length && React.createElement("div", { className: "ai-card", role: "status" }, React.createElement("strong", null, "\u7F51\u7EDC\u8BCA\u65AD \u00B7 \u6765\u6E90\u83B7\u53D6\u5931\u8D25"), view.diagnostics.map(d => React.createElement("p", { key: d.code }, React.createElement("b", null, d.code, " \u00B7 ", d.count, " \u4E2A\u6765\u6E90"), React.createElement("br", null), d.hintZh)), React.createElement("p", null, "\u8FD0\u884C /advisory-impact diagnose \u67E5\u770B DNS / TCP / TLS \u4E0E\u4EE3\u7406\u6765\u6E90\u3002")), React.createElement("p", { className: "ai-lead" }, "\u7528\u4F60\u5B9E\u9645\u8FD0\u884C\u7684\u7248\u672C\uFF0C\u6838\u5BF9\u5B98\u65B9\u5B89\u5168\u516C\u544A\u3002\u5B98\u65B9\u4F18\u5148\uFF0COSV \u4EC5\u4F5C\u7B2C\u4E8C\u6765\u6E90\u3002"), React.createElement("details", { className: "ai-card ai-setup", open: !settings || undefined }, React.createElement("summary", null, "\u9879\u76EE\u4E0E\u8FD0\u884C\u7248\u672C", ' ', React.createElement("span", { className: "ai-muted" }, activeDirectory || '先选择本地项目，没有默认版本')), React.createElement("form", { className: "ai-form", onSubmit: connect }, React.createElement("label", { className: "ai-wide" }, "\u672C\u5730\u9879\u76EE\u7EDD\u5BF9\u8DEF\u5F84", React.createElement("input", { value: directory, onChange: e => setDirectory(e.target.value), placeholder: "\u586B\u5199\u672C\u673A\u5DF2\u6709\u9879\u76EE\u76EE\u5F55", required: true, disabled: !!busy })), React.createElement("button", { className: "ai-button", disabled: !!busy }, "\u8BFB\u53D6\u9879\u76EE")), settings && (React.createElement(React.Fragment, null, React.createElement("p", { className: "ai-muted" }, "\u5F53\u524D\u9879\u76EE\uFF1A", activeDirectory, " \u00B7 \u914D\u7F6E\u4FDD\u5B58\u5728 .advisory-impact.json\u3002\u5207\u6362\u76EE\u5F55\u8BF7\u70B9\u51FB\u300C\u8BFB\u53D6\u9879\u76EE\u300D\u3002"), React.createElement("form", { className: "ai-form", onSubmit: e => {
            e.preventDefault();
            void edit('watch', { watch: watch.trim() ? watch.split(',').map(id => id.trim()) : [] });
        } }, React.createElement("label", { className: "ai-wide" }, "\u5173\u6CE8\u9879\u76EE\uFF08\u82F1\u6587 id\uFF0C\u9017\u53F7\u5206\u9694\uFF09", React.createElement("input", { value: watch, onChange: e => setWatch(e.target.value), disabled: !!busy })), React.createElement("button", { className: "ai-button", disabled: !!busy }, "\u4FDD\u5B58\u5173\u6CE8")), React.createElement("form", { className: "ai-form", onSubmit: e => {
            e.preventDefault();
            void edit('pin', {
                project: pinProject,
                version,
                ...(component ? { component } : {}),
                ...(maven ? { maven } : {})
            });
        } }, React.createElement("label", null, "\u9879\u76EE id", React.createElement("input", { value: pinProject, onChange: e => setPinProject(e.target.value), required: true, disabled: !!busy })), React.createElement("label", null, "\u5B9E\u9645\u8FD0\u884C\u7248\u672C", React.createElement("input", { value: version, onChange: e => setVersion(e.target.value), placeholder: "\u81EA\u884C\u586B\u5199", required: true, disabled: !!busy })), React.createElement("label", null, "\u7EC4\u4EF6\uFF08\u53EF\u9009\uFF09", React.createElement("input", { value: component, onChange: e => setComponent(e.target.value), disabled: !!busy })), React.createElement("label", null, "Maven \u5750\u6807\uFF08\u53EF\u9009\uFF09", React.createElement("input", { value: maven, onChange: e => setMaven(e.target.value), placeholder: "groupId:artifactId", disabled: !!busy })), React.createElement("button", { className: "ai-button", disabled: !!busy }, "\u4FDD\u5B58\u7248\u672C")), settings.pins.length ? (settings.pins.map((p, i) => (React.createElement("div", { className: "ai-row ai-pin", key: i }, React.createElement("code", null, p.project, " ", p.version, p.component ? ` · ${p.component}` : '', p.maven ? ` · ${p.maven}` : ''), React.createElement("button", { className: "ai-button", disabled: !!busy, onClick: () => void edit('pin', { project: p.project, remove: true }) }, "\u79FB\u9664 ", p.project, " \u7248\u672C"))))) : (React.createElement("p", { className: "ai-notice" }, "\u672A\u586B\u5199\u8FD0\u884C\u7248\u672C\uFF0C\u65E0\u6CD5\u5224\u65AD\u3002\u6CA1\u6709\u9ED8\u8BA4\u8FD0\u884C\u7248\u672C\u3002"))))), React.createElement("div", { role: "status", "aria-live": "polite" }, busy && React.createElement("p", { className: "ai-loading" }, busy), message && React.createElement("p", { className: "ai-notice" }, message)), error && (React.createElement("div", { role: "alert", className: "ai-banner ai-affected" }, error, ' ', view ? '下方保留上次结果及其原始时间，未刷新成功。' : '尚无可用核对结果，请检查项目目录或重试。')), !view && (React.createElement("div", { className: "ai-card ai-empty" }, React.createElement(Shield, { size: 32 }), React.createElement("h2", null, settings ? '运行版本准备好后，开始核对' : '从你的运行版本开始'), React.createElement("p", null, "\u9ED8\u8BA4\u5173\u6CE8 Kafka / Hadoop / Flink\u3002\u8BFB\u53D6\u9879\u76EE\u548C\u4FDD\u5B58\u914D\u7F6E\u4E0D\u4F1A\u8BBF\u95EE\u516C\u544A\u6765\u6E90\u3002"), React.createElement("p", null, "\u70B9\u51FB\u300C\u6838\u5BF9 / \u5237\u65B0\u300D\u540E\u83B7\u53D6\u516C\u5F00\u6765\u6E90\uFF1B\u6CA1\u6709 pin \u7684\u516C\u544A\u4F1A\u6807\u4E3A\u300C\u65E0\u6CD5\u5224\u65AD\u300D\u3002"), settings && (React.createElement("button", { className: "ai-button", disabled: !!busy, onClick: () => void run('正在读取来源（优先使用有效缓存）…', () => loadView(activeDirectory)) }, "\u4F7F\u7528\u7F13\u5B58\u6838\u5BF9")))), view && overview && (React.createElement(React.Fragment, null, overview.stale && (React.createElement("p", { className: "ai-banner ai-unknown" }, "\u542B\u9648\u65E7\u6216\u5DF2\u8FC7\u671F\u6570\u636E\u3002\u4E0B\u65B9\u4FDD\u7559\u5404\u6765\u6E90\u6700\u540E\u6210\u529F\u6293\u53D6\u65F6\u95F4\uFF1B\u8BF7\u5237\u65B0\u540E\u518D\u6838\u5BF9\u3002")), overview.failed && !view.diagnostics?.length && (React.createElement("p", { role: "alert", className: "ai-banner ai-affected" }, "\u90E8\u5206\u6765\u6E90\u6216\u7F13\u5B58\u5931\u8D25\u3002\u53EF\u7528\u7684\u6700\u540E\u6210\u529F\u6570\u636E\u7EE7\u7EED\u663E\u793A\uFF1B\u5931\u8D25\u4E0D\u4EE3\u8868\u6CA1\u6709\u516C\u544A\u6216\u4E0D\u53D7\u5F71\u54CD\u3002")), React.createElement("section", { "aria-label": "\u6838\u5BF9\u603B\u89C8" }, React.createElement("div", { className: "ai-section-head" }, React.createElement("h2", null, "\u6838\u5BF9\u603B\u89C8"), React.createElement("span", { className: "ai-muted" }, "\u6309\u516C\u544A \u00D7 \u9879\u76EE\u8BA1\u6570 \u00B7 \u5F53\u524D\u5173\u6CE8\u5217\u8868")), React.createElement("div", { className: "ai-metrics" }, overview.cards.map(card => (React.createElement("article", { className: `ai-card ai-metric ai-${card.key}`, key: card.key }, React.createElement("span", null, card.label), React.createElement("strong", null, card.value ?? '—'), React.createElement("small", null, card.value === null
        ? '尚无可用数据 / 未查询'
        : card.partial
            ? '仅已获取部分'
            : '已获取数据中的条目'), React.createElement("div", { className: "ai-evidence" }, [...new Set(card.sources.map(s => s.url))].map(url => (React.createElement("span", { className: "ai-chip", key: url }, React.createElement(Link, { url: url }, new URL(url).hostname)))), card.oldestFetchTime && (React.createElement("span", { className: "ai-chip" }, "\u6700\u65E9\u6293\u53D6 ", card.oldestFetchTime))), React.createElement("details", null, React.createElement("summary", null, "\u5404\u6765\u6E90\u72B6\u6001\u4E0E\u65F6\u95F4"), card.sources.length ? (card.sources.map((s, i) => React.createElement(Evidence, { key: i, source: s, ttl: ttl, now: now }))) : (React.createElement("p", null, "\u672A\u53D6\u5F97\u6765\u6E90")))))))), React.createElement("nav", { className: "ai-tabs", "aria-label": "\u9009\u62E9\u9879\u76EE" }, view.projects.map(p => (React.createElement("button", { className: "ai-button", "aria-pressed": selected === p.project, key: p.project, onClick: () => setSelected(p.project) }, title(p.project))))), project ? (React.createElement(ProjectView, { key: project.project, project: project, ttl: ttl, now: now })) : (React.createElement("p", { className: "ai-card ai-empty" }, "\u5173\u6CE8\u5217\u8868\u4E3A\u7A7A\u3002\u53EF\u5728\u300C\u9879\u76EE\u4E0E\u8FD0\u884C\u7248\u672C\u300D\u4E2D\u6DFB\u52A0\u9879\u76EE\u3002")), view.settings.watch.includes('kafka') && (React.createElement("section", { className: "ai-section ai-suppression" }, React.createElement("div", { className: "ai-section-head" }, React.createElement("h2", null, "\u626B\u63CF\u5668\u62A5\u4E86\uFF0C\u4F46\u5B98\u65B9\u8BF4\u660E\u4E0D\u9002\u7528"), React.createElement("span", { className: "ai-chip" }, "\u5B98\u65B9\u8BF4\u660E \u00B7 \u72EC\u7ACB\u5217\u51FA")), React.createElement("p", { className: "ai-muted" }, "Kafka \u5B98\u65B9 suppressions \u6587\u4EF6\uFF1B\u4E0D\u5C06\u8FD9\u4E9B\u6761\u76EE\u6807\u4E3A\u5B98\u65B9\u53D7\u5F71\u54CD\u3002Hadoop / Flink \u672A\u914D\u7F6E\u5B98\u65B9 suppressions \u6587\u4EF6\u3002"), React.createElement(Evidence, { source: view.suppressions.source, ttl: ttl, now: now, label: "Kafka suppressions" }), React.createElement(Evidence, { source: view.guidance, ttl: ttl, now: now, label: "ASF \u4F9D\u8D56\u6F0F\u6D1E\u8BF4\u660E" }), view.suppressions.items === null ? (React.createElement("p", { className: "ai-error" }, "\u5B98\u65B9\u4E0D\u9002\u7528\u8BF4\u660E\u4E0D\u53EF\u7528\uFF0C\u4E0D\u80FD\u636E\u6B64\u6392\u9664\u626B\u63CF\u5668\u7ED3\u679C\u3002")) : (React.createElement(MoreList, { items: view.suppressions.items, render: (item, i) => (React.createElement("article", { className: "ai-card", key: i }, React.createElement("div", { className: "ai-row" }, React.createElement(Link, { url: item.url }, item.id), React.createElement("span", { className: "ai-chip" }, "\u5B98\u65B9\u8BF4\u660E\u4E0D\u9002\u7528")), React.createElement("p", null, item.notes), React.createElement("span", { className: "ai-chip" }, "\u6293\u53D6 ", item.fetchedTime))) })))), view.settings.watch.includes('flink') && (React.createElement("section", { className: "ai-section" }, React.createElement("h2", null, "Flink \u5B98\u65B9\u5165\u53E3"), React.createElement("p", { className: "ai-muted" }, "\u9879\u76EE security \u9875\u4EC5\u4F5C\u6307\u9488\uFF0C\u4E0D\u8BA1\u4E3A\u7B2C\u4E8C\u4EFD\u516C\u544A\u6E05\u5355\u3002ASF \u5217\u8868\u4E3A\u5B9E\u9A8C\u6027\uFF0C\u8986\u76D6 2023 \u5E74\u4EE5\u6765\uFF0C\u53EF\u80FD\u6EDE\u540E\u5B98\u65B9 CVE \u53D1\u5E03\u3002"), React.createElement(Evidence, { source: view.flinkPointer, ttl: ttl, now: now, label: "Flink security \u6307\u9488" }))), React.createElement("section", { className: "ai-card" }, React.createElement("div", { className: "ai-section-head" }, React.createElement("div", null, React.createElement("h2", null, "\u4E2D\u6587 Markdown \u62A5\u544A"), React.createElement("p", { className: "ai-muted" }, "\u5B98\u65B9\u5224\u5B9A\u3001\u6765\u6E90\u3001\u65F6\u95F4\u53CA\u72EC\u7ACB\u5206\u7EC4\u5747\u4FDD\u7559\u3002")), React.createElement("button", { className: "ai-button", disabled: !!busy, onClick: () => void run('正在生成报告…', async () => {
            const result = await request(activeDirectory, 'report');
            if (mounted.current)
                setReport(result.text);
        }) }, "\u67E5\u770B\u62A5\u544A")), report && (React.createElement(React.Fragment, null, React.createElement("textarea", { className: "ai-report", "aria-label": "\u4E2D\u6587 Markdown \u62A5\u544A", readOnly: true, value: report, onFocus: e => e.target.select() }), React.createElement("button", { className: "ai-button", onClick: () => void run('正在复制…', async () => {
            await navigator.clipboard.writeText(report);
            setMessage('已复制 Markdown 报告。');
        }) }, "\u590D\u5236\u62A5\u544A"), React.createElement("p", { className: "ai-muted" }, "\u526A\u8D34\u677F\u4E0D\u53EF\u7528\u65F6\u53EF\u9009\u4E2D\u4E0A\u65B9\u5168\u6587\u590D\u5236\u3002\u62A5\u544A\u4E2D\u7684\u6293\u53D6\u65F6\u95F4\u72EC\u7ACB\u4FDD\u7559\u3002")))))), React.createElement("footer", { className: "ai-footer" }, "\u5224\u5B9A\u6765\u81EA\u5B98\u65B9\u516C\u544A\u4E0E\u586B\u5199\u7684\u7248\u672C\u3002\u672A\u89E3\u6790\u8303\u56F4\u3001\u7F3A\u5C11\u7248\u672C\u6216\u7EC4\u4EF6\u4E0D\u5339\u914D\u65F6\u4FDD\u7559\u300C\u65E0\u6CD5\u5224\u65AD\u300D\u3002"))));
}
function apply(ctx) {
    ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.plugin = 'advisory-impact';
        style.textContent = PANEL_CSS;
        document.head.appendChild(style);
        return () => style.remove();
    });
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'advisory-impact' }, () => React.createElement(Panel, null)));
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'advisory-impact', order: 35, label: '公告影响' }, props => React.createElement(Shield, { size: props.size })));
    ctx.slots.inject('plugins.row.config', () => ctx.slots.register({ name: 'plugins.row.config', key: 'dsh-advisory-impact#advisory-impact' }, props => React.createElement(network_settings_js_1.NetworkSettings, { ...props })));
}

return module.exports;
}});
