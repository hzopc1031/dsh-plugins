window.__ModuleLoader__.load({ id: 'dsh-apache-radar', factory: hostRequire => {
const settings = { exports: {} };
((module, exports, require) => {"use strict";
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

})(settings, settings.exports, hostRequire);
const require = hostRequire;
const module = { exports: {} }; const exports = module.exports;
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = void 0;
exports.securityOverview = securityOverview;
exports.jiraCves = jiraCves;
exports.groupIssues = groupIssues;
exports.briefSections = briefSections;
exports.CountCard = CountCard;
exports.Overview = Overview;
exports.Watch = Watch;
exports.SecurityCard = SecurityCard;
exports.SecurityStrip = SecurityStrip;
exports.Brief = Brief;
exports.Dashboard = Dashboard;
exports.apply = apply;
const network_settings_js_1 = settings.exports;
const react_1 = __importStar(require("react"));
const dsh_client_ui_primitives_1 = require("@deepseek-ai/dsh-client-ui-primitives");
const endpoint = '/api/apache-radar/dashboard';
const projectName = (id) => ({ kafka: 'Kafka', hadoop: 'Hadoop', flink: 'Flink' })[id] ?? id;
const time = (value) => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Singapore',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '尚未成功抓取';
const statusName = (value) => ({ ok: '已更新', cached: '缓存', stale: '上次成功缓存', failed: '抓取失败', unavailable: '暂无来源' })[value] ?? value;
const sourceError = (error) => error && !error.includes('TLS_KEY_TOO_SMALL') && /fetch failed|NETWORK_ERROR|ECONN|ETIMEDOUT|ENOTFOUND|UND_ERR_|CERT|SIGNATURE|ISSUER|HTTP[ _]\d{3}/i.test(error) ? '来源不可用 · 见网络诊断' : error;
const labels = { code: { copyLabel: '复制', copiedLabel: '已复制' }, footnotes: '注释' };
function securityOverview(report) {
    const affected = report.projects.filter(p => p.advisories.some(a => a.verdict === 'affected'));
    return { watched: report.projects.length, affected: affected.map(p => p.project), unpinned: report.projects.filter(p => !p.pin).length,
        incomplete: report.projects.filter(p => !p.source?.data || p.source.status === 'stale').length };
}
function jiraCves(title, security, project) {
    if (!security)
        return [];
    return [...new Set(title.match(/CVE-\d{4}-\d{4,}/gi)?.map(id => id.toUpperCase()) ?? [])].map(id => {
        const advisory = project?.advisories.find(a => a.id === id);
        return { id, status: advisory ? 'published' : project?.source?.data ? 'not_published' : 'unknown',
            label: advisory ? '官方已公布' : project?.source?.data ? '官方尚未公布' : '官方列表不可用，无法核对',
            url: advisory?.url, fetchedAt: project?.source?.fetchedAt, stale: project?.source?.status === 'stale' };
    });
}
function groupIssues(items) {
    const groups = new Map();
    for (const item of items.filter(i => i.kind === 'jira')) {
        const label = item.security ? '安全' : `${item.issueType ?? '其他类型'} · ${item.statusText ?? item.status ?? '状态未知'}`;
        groups.set(label, [...(groups.get(label) ?? []), item]);
    }
    return [...groups].sort(([a], [b]) => a === '安全' ? -1 : b === '安全' ? 1 : a.localeCompare(b)).map(([label, items]) => ({ label, items }));
}
function briefSections(markdown) {
    return markdown.split(/\n(?=## )/).filter(part => part.trim());
}
function Icon({ size = 22 }) {
    return react_1.default.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", "aria-hidden": "true" },
        react_1.default.createElement("circle", { cx: "12", cy: "12", r: "8.5" }),
        react_1.default.createElement("circle", { cx: "12", cy: "12", r: "4.5" }),
        react_1.default.createElement("path", { d: "M12 3.5V12l6-6M3.5 12H7M12 17v3.5" }),
        react_1.default.createElement("circle", { cx: "12", cy: "12", r: "1", fill: "currentColor" }));
}
function Badge({ children, tone = '' }) {
    return react_1.default.createElement("span", { className: `ar-badge ${tone}` }, children);
}
function SourceChip({ source }) {
    return react_1.default.createElement("div", { className: "ar-citation" },
        react_1.default.createElement("a", { href: source.url, target: "_blank", rel: "noreferrer", title: source.url },
            new URL(source.url).hostname,
            " \u2197"),
        react_1.default.createElement("span", { title: "\u6293\u53D6\u65F6\u95F4 \u00B7 Asia/Singapore (UTC+8)" }, time(source.fetchedAt)),
        source.sourceTimestamp && react_1.default.createElement("span", null,
            "\u6E90\u65F6\u95F4 ",
            source.sourceTimestamp),
        source.cacheStatus === 'stale' && react_1.default.createElement(Badge, { tone: "warn" }, "\u65E7\u7F13\u5B58"),
        source.cacheError && react_1.default.createElement("details", { className: "ar-source-error" },
            react_1.default.createElement("summary", null, "\u6293\u53D6\u5931\u8D25 \u00B7 \u67E5\u770B\u539F\u56E0"),
            react_1.default.createElement("span", { className: "ar-error-text" }, sourceError(source.cacheError))));
}
function CountCard({ row, title, featured = false }) {
    return react_1.default.createElement("article", { className: `ar-card ar-metric ${featured ? 'ar-featured' : ''}` },
        react_1.default.createElement("div", { className: "ar-eyebrow" }, title ?? row.label),
        react_1.default.createElement("strong", { className: "ar-number" }, row.status === 'ok' ? row.value : '—'),
        react_1.default.createElement("p", { className: "ar-note" }, row.status === 'error' ? sourceError(row.error) : row.note),
        row.sources.map((source, i) => react_1.default.createElement(SourceChip, { key: i, source: source })));
}
function Overview({ data, jump }) {
    const counts = data.counts;
    const titles = ['当前列示', '顶级项目 · TLP', '孵化项目 · Podlings', '项目委员会 · PMC', '全部委员会'];
    const mismatches = counts.comparisons.filter(c => c.status !== 'match');
    return react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ar-section-heading" },
            react_1.default.createElement("div", null,
                react_1.default.createElement("h2", null, "\u4ECE\u4E0D\u540C\u53E3\u5F84\uFF0C\u770B Apache"),
                react_1.default.createElement("p", null, "\u9879\u76EE\u3001\u59D4\u5458\u4F1A\u4E0E\u5B75\u5316\u9879\u76EE\u5404\u6709\u5B9A\u4E49\uFF0C\u6570\u5B57\u4FDD\u7559\u5404\u81EA\u7684\u51FA\u5904\u3002")),
            react_1.default.createElement(Badge, null, "\u5B98\u65B9\u516C\u5F00\u6765\u6E90")),
        react_1.default.createElement("div", { className: "ar-metrics" },
            counts.counts.slice(0, 5).map((row, i) => react_1.default.createElement(CountCard, { key: row.id, row: row, title: titles[i], featured: i === 0 })),
            data.security && react_1.default.createElement(SecurityCard, { report: data.security, jump: jump })),
        react_1.default.createElement("div", { className: "ar-two-col" },
            react_1.default.createElement("section", { className: "ar-card ar-section" },
                react_1.default.createElement("div", { className: "ar-card-heading" },
                    react_1.default.createElement("h3", null, "\u9000\u4F11\u53E3\u5F84\uFF0C\u653E\u5728\u4E00\u8D77\u770B"),
                    react_1.default.createElement(Badge, { tone: "warn" }, "\u4E0D\u5408\u5E76\u4E3A\u603B\u6570")),
                react_1.default.createElement("p", { className: "ar-muted" }, "\u9000\u4F11\u59D4\u5458\u4F1A\u3001Attic \u9879\u76EE\u4E0E\u5B50\u9879\u76EE\uFF0C\u8303\u56F4\u5E76\u4E0D\u76F8\u540C\u3002"),
                react_1.default.createElement("div", { className: "ar-retired" }, counts.retired.map(row => react_1.default.createElement("div", { key: row.id, className: "ar-retired-cell" },
                    react_1.default.createElement("span", null, ({ 'retired-whimsy': 'Whimsy 委员会', 'retired-projects': 'Projects 委员会', 'attic-pmcs': 'Attic PMC', 'attic-subprojects': 'Attic 子项目' })[row.id] ?? row.label),
                    react_1.default.createElement("strong", null, row.status === 'ok' ? row.value : '—'),
                    row.status === 'error' && react_1.default.createElement("p", { className: "ar-error-text" }, sourceError(row.error)),
                    row.sources.map((s, i) => react_1.default.createElement(SourceChip, { key: i, source: s }))))),
                mismatches.map(c => react_1.default.createElement("details", { className: "ar-difference", key: c.id, open: c.id === 'retired-whimsy-attic' },
                    react_1.default.createElement("summary", null,
                        react_1.default.createElement("span", { className: "ar-dot warn" }),
                        c.label,
                        " \u00B7 ",
                        c.status === 'error' ? '无法核对' : '存在差异'),
                    react_1.default.createElement("p", null, c.note),
                    c.status === 'error' ? react_1.default.createElement("p", null, sourceError(c.error)) : react_1.default.createElement(react_1.default.Fragment, null,
                        react_1.default.createElement("p", null,
                            "\u4EC5\u5DE6\u4FA7\uFF1A",
                            c.onlyLeft.map(m => `${m.name} (${m.id})`).join('、') || '无'),
                        react_1.default.createElement("p", null,
                            "\u4EC5\u53F3\u4FA7\uFF1A",
                            c.onlyRight.map(m => `${m.name} (${m.id})`).join('、') || '无')),
                    c.sources.map((s, i) => react_1.default.createElement(SourceChip, { key: i, source: s }))))),
            react_1.default.createElement("section", { className: "ar-card ar-section" },
                react_1.default.createElement("div", { className: "ar-card-heading" },
                    react_1.default.createElement("h3", null, "\u5B98\u65B9\u9886\u57DF\u6807\u7B7E"),
                    react_1.default.createElement(Badge, null, "\u53EF\u591A\u9009\u5F52\u7C7B")),
                react_1.default.createElement("p", { className: "ar-muted" }, "\u6CBF\u7528 chooser \u7684\u6807\u7B7E\uFF0C\u4E00\u4E2A\u9879\u76EE\u53EF\u4EE5\u5C5E\u4E8E\u591A\u4E2A\u9886\u57DF\u3002"),
                counts.categories.status === 'error' ? react_1.default.createElement("p", { className: "ar-error-text" }, sourceError(counts.categories.error)) : react_1.default.createElement("div", { className: "ar-categories" }, counts.categories.rows.map(row => react_1.default.createElement("details", { key: row.id, className: "ar-category" },
                    react_1.default.createElement("summary", null,
                        row.label,
                        react_1.default.createElement("b", null, row.status === 'ok' ? row.value : '—')),
                    react_1.default.createElement("p", null, row.members?.map(m => m.name).join('、')),
                    row.sources.map((s, i) => react_1.default.createElement(SourceChip, { key: i, source: s }))))),
                counts.categories.sources.map((s, i) => react_1.default.createElement(SourceChip, { key: i, source: s })),
                react_1.default.createElement("p", { className: "ar-footnote" }, "\u591A\u6807\u7B7E\u6570\u91CF\u4E0D\u80FD\u76F8\u52A0\u4E3A\u9879\u76EE\u603B\u6570\u3002\u70B9\u6807\u7B7E\u67E5\u770B\u6210\u5458\u53CA\u6765\u6E90\u3002"))),
        react_1.default.createElement("details", { className: "ar-card ar-section" },
            react_1.default.createElement("summary", null, "\u5B75\u5316\u9879\u76EE\u4EA4\u53C9\u6838\u5BF9\u4E0E\u7EDF\u8BA1\u8BF4\u660E"),
            react_1.default.createElement("p", null, counts.explanation),
            react_1.default.createElement("div", { className: "ar-two-col" }, counts.counts.slice(5).map(row => react_1.default.createElement(CountCard, { key: row.id, row: row }))),
            counts.comparisons.filter(c => c.status === 'match').map(c => react_1.default.createElement("p", { key: c.id },
                c.label,
                "\uFF1A\u540D\u5355\u4E00\u81F4\u3002",
                c.sources.map((s, i) => react_1.default.createElement(SourceChip, { key: i, source: s }))))));
}
function ItemRow({ item, security }) {
    const kind = ({ release: '发布', jira: 'JIRA', proposal: '提案' })[item.kind];
    return react_1.default.createElement("article", { className: `ar-item ${item.security ? 'ar-security' : ''}` },
        react_1.default.createElement("div", { className: "ar-item-meta" },
            react_1.default.createElement(Badge, { tone: item.security ? 'danger' : '' }, item.security ? `安全 · ${kind}` : kind),
            item.status && react_1.default.createElement(Badge, { tone: ['accepted', 'implemented', 'released'].includes(item.status) ? 'good' : '' }, item.statusText ?? item.status),
            react_1.default.createElement("span", null, item.kind === 'jira' ? item.id : item.version),
            react_1.default.createElement("time", null, item.date ? time(item.date).slice(0, 10) : '日期未知 · 参考条目')),
        react_1.default.createElement("a", { className: "ar-item-title", href: item.url, target: "_blank", rel: "noreferrer" },
            item.title,
            react_1.default.createElement("span", { "aria-label": "\u6253\u5F00\u539F\u6587" }, " \u2197")),
        !!item.security && jiraCves(item.title, true, security).map(cve => react_1.default.createElement("div", { className: "ar-cve-chip", key: cve.id },
            cve.status === 'published' ? react_1.default.createElement("button", { onClick: () => revealAdvisory(`${item.project}-${cve.id}`) },
                cve.id,
                " \u00B7 ",
                cve.label,
                " \u2197") : react_1.default.createElement(Badge, null,
                cve.id,
                " \u00B7 ",
                cve.label),
            react_1.default.createElement("span", { className: "ar-footnote" },
                "\u6309\u5DF2\u6293\u53D6\u5B98\u65B9\u5217\u8868\u6838\u5BF9 \u00B7 ",
                time(cve.fetchedAt),
                cve.stale ? ' · 旧缓存' : ''))),
        !!item.fixVersions?.length && react_1.default.createElement("p", { className: "ar-footnote" },
            "\u76EE\u6807\u7248\u672C ",
            item.fixVersions.join('、'),
            " \u00B7 \u4E0D\u4EE3\u8868\u5DF2\u7ECF\u53D1\u5E03"),
        react_1.default.createElement("div", { className: "ar-item-links" },
            react_1.default.createElement("a", { href: item.sourceUrl, target: "_blank", rel: "noreferrer" }, "\u91C7\u96C6\u6765\u6E90 \u2197"),
            item.notesUrl && react_1.default.createElement("a", { href: item.notesUrl, target: "_blank", rel: "noreferrer" }, "\u7248\u672C\u8BF4\u660E \u2197")));
}
function ItemList({ items, empty, security }) {
    const [expanded, setExpanded] = (0, react_1.useState)(false);
    return react_1.default.createElement(react_1.default.Fragment, null,
        items.length ? (expanded ? items : items.slice(0, 4)).map(item => react_1.default.createElement(ItemRow, { key: item.url, item: item, security: security })) : react_1.default.createElement("p", { className: "ar-empty-inline" }, empty),
        items.length > 4 && react_1.default.createElement("button", { className: "ar-more", onClick: () => setExpanded(!expanded), "aria-expanded": expanded }, expanded ? '收起' : '展开其余条目'));
}
function Sources({ sources }) {
    return react_1.default.createElement("div", { className: "ar-source-list" }, sources.map((s, i) => react_1.default.createElement("div", { key: i, className: "ar-source-row" },
        react_1.default.createElement(Badge, { tone: s.status === 'failed' ? 'danger' : s.status === 'stale' ? 'warn' : '' }, statusName(s.status)),
        react_1.default.createElement("div", null,
            s.url ? react_1.default.createElement("a", { href: s.url, target: "_blank", rel: "noreferrer" },
                s.project ?? '关注项目',
                " \u00B7 ",
                s.kind,
                " \u2197") : react_1.default.createElement("span", null,
                s.project,
                " \u00B7 ",
                s.kind),
            react_1.default.createElement("p", { className: "ar-footnote" },
                time(s.fetchedAt),
                s.sourceTimestamp ? ` · 源时间 ${s.sourceTimestamp}` : ''),
            s.error && react_1.default.createElement("p", { className: "ar-error-text" }, sourceError(s.error)),
            s.warnings.map((w, n) => react_1.default.createElement("p", { className: "ar-footnote", key: n }, w))))));
}
function Watch({ data, mutate, busy, focusProject }) {
    const [selected, setSelected] = (0, react_1.useState)(focusProject ?? data.watchList?.[0] ?? '');
    const [newId, setNewId] = (0, react_1.useState)('');
    const project = data.watchList?.includes(selected) ? selected : data.watchList?.[0] ?? '';
    const security = data.security?.projects.find(p => p.project === project);
    const items = data.items?.filter(i => i.project === project) ?? [];
    const undated = data.undatedItems?.filter(i => i.project === project) ?? [];
    const sources = data.sources?.filter(s => !s.project || s.project === project) ?? [];
    return react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ar-section-heading" },
            react_1.default.createElement("div", null,
                react_1.default.createElement("h2", null, "\u53EA\u5173\u6CE8\u4F60\u5728\u7528\u7684\u9879\u76EE"),
                react_1.default.createElement("p", null, "\u6EDA\u52A8\u6700\u8FD1 7 \u5929 \u00B7 Asia/Singapore\uFF08UTC+8\uFF09"))),
        react_1.default.createElement("div", { className: "ar-watch-toolbar" },
            react_1.default.createElement("div", { className: "ar-segment", role: "group", "aria-label": "\u5173\u6CE8\u9879\u76EE" }, data.watchList?.map(id => react_1.default.createElement("button", { "aria-pressed": project === id, key: id, onClick: () => setSelected(id) }, projectName(id)))),
            react_1.default.createElement("form", { onSubmit: e => { e.preventDefault(); mutate('add', newId); setNewId(''); } },
                react_1.default.createElement("input", { "aria-label": "\u6DFB\u52A0\u9879\u76EE id", placeholder: "\u9879\u76EE id\uFF0C\u5982 spark", pattern: "[a-zA-Z][a-zA-Z0-9-]*", required: true, value: newId, onChange: e => setNewId(e.target.value) }),
                react_1.default.createElement("button", { disabled: busy }, "\uFF0B \u5173\u6CE8")),
            project && react_1.default.createElement("button", { disabled: busy, onClick: () => mutate('remove', project), "aria-label": `取消关注 ${projectName(project)}` }, "\u53D6\u6D88\u5173\u6CE8")),
        project ? react_1.default.createElement(react_1.default.Fragment, null,
            react_1.default.createElement(SecurityStrip, { key: project + (security?.pin ?? ""), project: project, security: security, report: data.security, mutate: mutate, busy: busy, expanded: focusProject === project }),
            react_1.default.createElement("div", { className: "ar-two-col" },
                react_1.default.createElement("section", { className: "ar-card ar-section" },
                    react_1.default.createElement("div", { className: "ar-card-heading" },
                        react_1.default.createElement("h3", null,
                            projectName(project),
                            " \u00B7 \u6B63\u5F0F\u53D1\u5E03"),
                        react_1.default.createElement(Badge, null, "\u5B98\u65B9\u53D1\u5E03\u76EE\u5F55")),
                    react_1.default.createElement(ItemList, { key: project + 'release', items: items.filter(i => i.kind === 'release'), empty: "\u7A97\u53E3\u5185\u65E0\u5DF2\u6536\u5F55\u53D1\u5E03\uFF1B\u8BF7\u540C\u65F6\u6838\u5BF9\u4E0B\u65B9\u6765\u6E90\u72B6\u6001\u3002" })),
                react_1.default.createElement("section", { className: "ar-card ar-section" },
                    react_1.default.createElement("div", { className: "ar-card-heading" },
                        react_1.default.createElement("h3", null, project === 'kafka' ? 'Kafka · KIP' : project === 'flink' ? 'Flink · FLIP' : projectName(project) + ' · 提案'),
                        react_1.default.createElement(Badge, null, "\u4FDD\u7559\u6765\u6E90\u72B6\u6001")),
                    react_1.default.createElement(ItemList, { key: project + 'proposal', items: items.filter(i => i.kind === 'proposal'), empty: project === 'hadoop' ? 'Hadoop 没有已验证的通用 HIP 索引。' : '窗口内暂无已收录提案；日期未知条目在下方单列。' }))),
            react_1.default.createElement("section", { className: "ar-card ar-section" },
                react_1.default.createElement("div", { className: "ar-card-heading" },
                    react_1.default.createElement("h3", null, "JIRA \u00B7 \u6309\u7C7B\u578B\u4E0E\u72B6\u6001\u6574\u7406"),
                    react_1.default.createElement(Badge, null, "\u5DE5\u5355 \u2260 \u5DF2\u53D1\u5E03\u529F\u80FD")),
                react_1.default.createElement("p", { className: "ar-muted" }, "\u4EC5\u6293\u53D6\u5173\u6CE8\u9879\u76EE\u7684\u9996\u4E2A\u54CD\u5E94\u9875\uFF1BNew Feature \u548C\u76EE\u6807\u7248\u672C\u4E0D\u8BC1\u660E\u5DF2\u7ECF\u53D1\u5E03\u3002"),
                groupIssues(items).length ? groupIssues(items).map(group => react_1.default.createElement("details", { className: "ar-issue-group", key: project + group.label, open: group.label === '安全' },
                    react_1.default.createElement("summary", null, group.label),
                    react_1.default.createElement(ItemList, { items: group.items, empty: "", security: security }))) : react_1.default.createElement("p", { className: "ar-empty-inline" }, "\u7A97\u53E3\u5185\u6682\u65E0\u5DF2\u6536\u5F55 JIRA\uFF1B\u6765\u6E90\u5931\u8D25\u65F6\u4E0D\u80FD\u89E3\u91CA\u4E3A\u96F6\u66F4\u65B0\u3002")),
            react_1.default.createElement("details", { className: "ar-card ar-section" },
                react_1.default.createElement("summary", null, "\u65E5\u671F\u672A\u77E5\u7684\u63D0\u6848\u4E0E\u53C2\u8003\u6761\u76EE \u00B7 \u4E0D\u8BA1\u4E3A\u672C\u5468\u65B0\u589E"),
                react_1.default.createElement(ItemList, { key: project + 'undated', items: undated, empty: "\u6682\u65E0\u65E5\u671F\u672A\u77E5\u7684\u53C2\u8003\u6761\u76EE\u3002" })),
            react_1.default.createElement("details", { className: "ar-card ar-section" },
                react_1.default.createElement("summary", null, "\u91C7\u96C6\u7A97\u53E3\u4E0E\u6765\u6E90\u72B6\u6001"),
                react_1.default.createElement("p", { className: "ar-muted" }, data.window?.label),
                react_1.default.createElement(Sources, { sources: sources }))) : react_1.default.createElement("div", { className: "ar-card ar-empty" },
            react_1.default.createElement("h3", null, "\u5173\u6CE8\u5217\u8868\u662F\u7A7A\u7684"),
            react_1.default.createElement("p", null, "\u6DFB\u52A0\u4E00\u4E2A\u9879\u76EE id\uFF0C\u5F00\u59CB\u6574\u7406\u5B83\u7684\u52A8\u6001\u3002")));
}
const verdictName = { affected: '受影响', not_affected: '不受影响', unknown: '无法判断' };
const verdictTone = { affected: 'danger', not_affected: 'good', unknown: '' };
function revealAdvisory(id) {
    const row = document.getElementById(id);
    for (let node = row; node; node = node.parentElement)
        if (node instanceof HTMLDetailsElement)
            node.open = true;
    row?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    row?.focus({ preventScroll: true });
}
function SecurityCitation({ source }) {
    if (!source)
        return null;
    return react_1.default.createElement("div", { className: "ar-citation" },
        react_1.default.createElement("a", { href: source.url, target: "_blank", rel: "noreferrer" },
            new URL(source.url).hostname,
            " \u2197"),
        react_1.default.createElement("span", null,
            "\u6293\u53D6 ",
            time(source.fetchedAt),
            " \u00B7 UTC+8",
            source.status === 'stale' ? ' · 上次成功缓存' : ''),
        source.sourceTimestamp && react_1.default.createElement("span", null,
            "\u6E90\u65F6\u95F4 ",
            source.sourceTimestamp),
        source.error && react_1.default.createElement("details", { className: "ar-source-error" },
            react_1.default.createElement("summary", null, "\u6765\u6E90\u5931\u8D25 \u00B7 \u67E5\u770B\u539F\u56E0"),
            react_1.default.createElement("span", { className: "ar-error-text" }, sourceError(source.error))));
}
function SecurityCard({ report, jump }) {
    const summary = securityOverview(report);
    return react_1.default.createElement("article", { className: "ar-card ar-metric ar-security-card" },
        react_1.default.createElement("div", { className: "ar-eyebrow" }, "\u5173\u6CE8\u7EC4\u4EF6 \u00B7 \u7248\u672C\u4E0E\u5B89\u5168"),
        react_1.default.createElement("strong", { className: "ar-number" },
            summary.incomplete ? summary.affected.length ? `≥${summary.affected.length}` : '—' : summary.affected.length,
            react_1.default.createElement("small", null,
                " / ",
                summary.watched)),
        react_1.default.createElement("p", { className: "ar-note" },
            "\u5F53\u524D\u7248\u672C\u6709\u5B98\u65B9\u516C\u544A\u5F71\u54CD\u7684\u7EC4\u4EF6",
            react_1.default.createElement("br", null),
            summary.unpinned,
            " \u4E2A\u672A\u586B\u8FD0\u884C\u7248\u672C",
            summary.incomplete ? ` · ${summary.incomplete} 个来源待核对` : ''),
        report.projects.map(p => react_1.default.createElement("div", { className: "ar-security-scope", key: p.project },
            react_1.default.createElement("button", { className: "ar-project-jump", onClick: () => jump?.(p.project) },
                projectName(p.project),
                summary.affected.includes(p.project) ? ' · 受影响' : !p.pin ? ' · 未填版本' : '',
                " \u2197"),
            p.source && react_1.default.createElement(react_1.default.Fragment, null,
                react_1.default.createElement("a", { className: "ar-footnote", href: p.source.url, title: p.source.url, target: "_blank", rel: "noreferrer" }, "\u5B98\u65B9\u6765\u6E90 \u2197"),
                react_1.default.createElement("span", { className: "ar-footnote" },
                    time(p.source.fetchedAt),
                    " \u00B7 UTC+8",
                    p.source.status === 'stale' ? ' · 旧缓存' : ''),
                p.source.sourceTimestamp && react_1.default.createElement("span", { className: "ar-footnote" },
                    "\u6E90\u65F6\u95F4 ",
                    p.source.sourceTimestamp),
                p.source.error && react_1.default.createElement("details", { className: "ar-source-error" },
                    react_1.default.createElement("summary", null, "\u6765\u6E90\u5931\u8D25"),
                    react_1.default.createElement("span", null, sourceError(p.source.error)))),
            p.error && react_1.default.createElement("p", { className: "ar-error-text" }, sourceError(p.error)))));
}
function SecurityStrip({ project, security, report, mutate, busy, expanded = false }) {
    const [version, setVersion] = (0, react_1.useState)(security?.pin ?? '');
    const affected = security?.advisories.filter(a => a.verdict === 'affected').length ?? 0;
    const unknown = security?.advisories.filter(a => a.verdict === 'unknown').length ?? 0;
    const supported = ['kafka', 'hadoop', 'flink'].includes(project);
    return react_1.default.createElement("section", { className: "ar-card ar-section ar-security-strip" },
        react_1.default.createElement("div", { className: "ar-card-heading" },
            react_1.default.createElement("div", null,
                react_1.default.createElement("h3", null,
                    projectName(project),
                    " \u00B7 \u7248\u672C\u4E0E\u5B89\u5168"),
                react_1.default.createElement("p", { className: "ar-muted" },
                    security?.pin ? `你在用 ${security.pin} · ${security.source?.data ? `${affected} 个已收录官方公告影响此版本 · ${unknown} 个无法判断 · 官方修复逐项见下方` : '官方列表不可用，无法判断'}` : '填写你实际运行的版本，按官方范围立即核对。',
                    security?.source?.status === 'stale' ? ' · 上次成功缓存' : '')),
            react_1.default.createElement(Badge, { tone: affected ? 'danger' : '' }, security?.pin ? '官方范围匹配' : '未填版本 · 无法判断')),
        supported && react_1.default.createElement("form", { className: "ar-pin-form", onSubmit: e => { e.preventDefault(); mutate('pin', project, { version }); } },
            react_1.default.createElement("label", { htmlFor: `ar-pin-${project}` }, "\u8FD0\u884C\u7248\u672C"),
            react_1.default.createElement("input", { id: `ar-pin-${project}`, "aria-label": `${projectName(project)} 运行版本`, placeholder: "\u8F93\u5165\u5B9E\u9645\u7248\u672C\uFF0C\u5982 3.9.0", value: version, maxLength: 200, onChange: e => setVersion(e.target.value) }),
            react_1.default.createElement("button", { disabled: busy, className: "ar-primary" }, "\u4FDD\u5B58\u7248\u672C\u5E76\u5224\u65AD"),
            security?.pin && react_1.default.createElement("button", { type: "button", disabled: busy, onClick: () => mutate('pin', project, { version: '' }) }, "\u6E05\u9664")),
        react_1.default.createElement(SecurityCitation, { source: security?.source }),
        security?.error && react_1.default.createElement("p", { className: "ar-error-text" }, sourceError(security.error)),
        security?.notices.map(n => react_1.default.createElement("p", { className: "ar-footnote", key: n }, n)),
        project === 'flink' && react_1.default.createElement(SecurityCitation, { source: report?.flinkPointer }),
        react_1.default.createElement("details", { className: "ar-advisories", open: expanded || undefined },
            react_1.default.createElement("summary", null, "\u5B98\u65B9\u5B89\u5168\u516C\u544A \u00B7 \u5C55\u5F00\u9010\u9879\u5224\u5B9A\u4E0E\u4FEE\u590D\u7248\u672C"),
            react_1.default.createElement("p", { className: "ar-footnote" }, "\u4E0D\u540C\u516C\u544A\u7684\u4FEE\u590D\u7248\u672C\u5206\u522B\u5217\u51FA\uFF1B\u7EC4\u4EF6\u3001\u914D\u7F6E\u4E0E\u9650\u5236\u6761\u4EF6\u987B\u9010\u9879\u6838\u5BF9\u3002\u5224\u5B9A\u4E0D\u6784\u6210\u751F\u4EA7\u5B89\u5168\u6216\u5347\u7EA7\u7ED3\u8BBA\u3002"),
            security?.advisories.map(a => react_1.default.createElement("details", { className: "ar-advisory", id: `${project}-${a.id}`, key: a.id, tabIndex: -1, onToggle: e => {
                    if (e.currentTarget.open && a.osv.status === 'unqueried')
                        mutate('osv', project, { cve: a.id });
                } },
                react_1.default.createElement("summary", null,
                    react_1.default.createElement(Badge, { tone: verdictTone[a.verdict] }, verdictName[a.verdict]),
                    react_1.default.createElement("b", null, a.id),
                    react_1.default.createElement("span", null, a.title),
                    react_1.default.createElement("span", { className: "ar-advisory-source" },
                        react_1.default.createElement("a", { href: a.url, target: "_blank", rel: "noreferrer", onClick: e => e.stopPropagation() }, "\u5B98\u65B9\u539F\u6587 \u2197"),
                        " \u00B7 \u6293\u53D6 ",
                        time(a.fetchedAt),
                        " \u00B7 UTC+8",
                        a.sourceTimestamp ? ` · 源时间 ${a.sourceTimestamp}` : "")),
                react_1.default.createElement("div", { className: "ar-advisory-body" },
                    react_1.default.createElement("p", null, a.reason),
                    react_1.default.createElement("dl", null,
                        react_1.default.createElement("dt", null, "\u5B98\u65B9\u53D7\u5F71\u54CD\u8303\u56F4"),
                        react_1.default.createElement("dd", null, a.affectedText),
                        react_1.default.createElement("dt", null, "\u5B98\u65B9\u4FEE\u590D\u7248\u672C"),
                        react_1.default.createElement("dd", null, a.fixedText ?? '官方未明确列出')),
                    react_1.default.createElement(SecurityCitation, { source: { url: a.url, fetchedAt: a.fetchedAt, sourceTimestamp: a.sourceTimestamp, status: security.source.status, data: null } }),
                    react_1.default.createElement("details", { className: "ar-limits" },
                        react_1.default.createElement("summary", null, "\u5B98\u65B9\u539F\u6587\u4E0E\u9650\u5236\u6761\u4EF6"),
                        a.notes.map((note, i) => react_1.default.createElement("p", { key: i }, note))),
                    react_1.default.createElement("div", { className: "ar-osv" },
                        react_1.default.createElement("h4", null, "OSV \u00B7 \u7B2C\u4E8C\u6765\u6E90"),
                        react_1.default.createElement("p", null, a.osv.data?.label ?? (a.osv.status === 'unqueried' ? '展开后按需查询，不用于官方判定。' : '查询失败，不影响官方判定。')),
                        a.osvDifference && react_1.default.createElement("p", { className: "ar-error-text" }, "OSV \u4E0E\u5B98\u65B9\u8303\u56F4\u8868\u8FF0\u4E0D\u540C\uFF1B\u5B98\u65B9\u5224\u5B9A\u4FDD\u6301\u4E0D\u53D8\uFF0C\u8BF7\u5206\u522B\u6838\u5BF9\u7EC4\u4EF6\u548C\u8303\u56F4\u3002"),
                        react_1.default.createElement(SecurityCitation, { source: a.osv }),
                        a.osv.status === 'failed' && react_1.default.createElement("button", { disabled: busy, onClick: () => mutate('osv', project, { cve: a.id }) }, "\u91CD\u8BD5 OSV"),
                        a.osv.data?.record && react_1.default.createElement("pre", null, JSON.stringify(a.osv.data.record.affected, null, 2)))))),
            !security?.advisories.length && react_1.default.createElement("p", { className: "ar-empty-inline" }, sourceError(security?.error) ?? '尚未采集官方列表，请刷新；不能据此认定没有公告。'),
            project === 'kafka' && react_1.default.createElement("details", { className: "ar-suppressions" },
                react_1.default.createElement("summary", null, "\u626B\u63CF\u5668\u62A5\u4E86\uFF0C\u4F46\u5B98\u65B9\u8BF4\u660E\u4E0D\u9002\u7528 \u00B7 \u5355\u72EC\u67E5\u770B"),
                react_1.default.createElement("p", { className: "ar-footnote" }, "\u5B98\u65B9 suppressions \u4E0D\u8BA1\u4E3A\u5F71\u54CD Kafka \u7684\u516C\u544A\u3002"),
                react_1.default.createElement(SecurityCitation, { source: report?.suppressions }),
                report?.suppressions?.data?.suppressions.map(a => react_1.default.createElement("article", { key: a.id },
                    react_1.default.createElement("b", null, a.id),
                    react_1.default.createElement("p", null, a.notes),
                    react_1.default.createElement(SecurityCitation, { source: { ...report.suppressions, url: a.url, fetchedAt: a.fetchedAt } }))),
                react_1.default.createElement("p", null,
                    react_1.default.createElement("a", { href: "https://security.apache.org/report-dependency/", target: "_blank", rel: "noreferrer" }, "ASF\uFF1A\u5982\u4F55\u62A5\u544A\u4F9D\u8D56\u5E93\u5B89\u5168\u95EE\u9898 \u2197")),
                react_1.default.createElement(SecurityCitation, { source: report?.guidance }))));
}
function BriefSection({ part }) {
    if (part.startsWith('## 关注项目动态'))
        return react_1.default.createElement(react_1.default.Fragment, null,
            react_1.default.createElement("h2", { className: "ar-brief-title" }, "\u5173\u6CE8\u9879\u76EE\u52A8\u6001"),
            part.split('\n').slice(1).join('\n').trim().split(/\n(?=### )/).map((project, i) => react_1.default.createElement(BriefSection, { part: project, key: i })));
    if (part.startsWith('## 本周新公告'))
        return react_1.default.createElement("article", { className: "ar-card ar-section" },
            react_1.default.createElement(dsh_client_ui_primitives_1.MarkdownText, { text: part, labels: labels, omitHtml: true }));
    if (part.startsWith('## '))
        return react_1.default.createElement("details", { className: "ar-card ar-section" },
            react_1.default.createElement("summary", null,
                part.split('\n')[0].replace(/^## /, ''),
                " \u00B7 \u5C55\u5F00\u660E\u7EC6"),
            react_1.default.createElement(dsh_client_ui_primitives_1.MarkdownText, { text: part, labels: labels, omitHtml: true }));
    const lines = part.split('\n');
    const preview = part.startsWith('### ') && lines.length > 4;
    return react_1.default.createElement("article", { className: "ar-card ar-section" },
        react_1.default.createElement(dsh_client_ui_primitives_1.MarkdownText, { text: preview ? lines.slice(0, 4).join('\n') : part, labels: labels, omitHtml: true }),
        preview && react_1.default.createElement("details", { className: "ar-brief-more" },
            react_1.default.createElement("summary", null, "\u5C55\u5F00\u5176\u4F59\u5468\u62A5\u6761\u76EE"),
            react_1.default.createElement(dsh_client_ui_primitives_1.MarkdownText, { text: lines.slice(4).join('\n'), labels: labels, omitHtml: true })));
}
function Brief({ data, request, busy }) {
    const [notice, setNotice] = (0, react_1.useState)('');
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(data.markdown);
            setNotice('Markdown 已复制');
        }
        catch {
            setNotice('浏览器未允许复制，请打开已保存文件后复制。');
        }
    };
    const openFile = async () => {
        const tab = window.open('about:blank', '_blank');
        if (!tab) {
            setNotice('浏览器拦截了新窗口，请允许后重试。');
            return;
        }
        tab.opener = null;
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ directory: data.directory, action: 'file' }) });
            if (!response.ok)
                throw new Error((await response.json()).error);
            const url = URL.createObjectURL(await response.blob());
            tab.location.href = url;
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
        catch (error) {
            tab.close();
            setNotice(String(error));
        }
    };
    return react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ar-section-heading" },
            react_1.default.createElement("div", null,
                react_1.default.createElement("h2", null, "\u628A\u8FD9\u4E00\u5468\uFF0C\u7559\u6210\u4E00\u4EFD\u7B80\u62A5"),
                react_1.default.createElement("p", null, "\u5E26\u539F\u6587\u3001\u6765\u6E90\u4E0E\u65F6\u95F4\u7684\u4E2D\u6587 Markdown \u00B7 \u5728\u672C\u5730\u4FDD\u5B58")),
            react_1.default.createElement("div", { className: "ar-actions" },
                react_1.default.createElement("button", { disabled: busy, onClick: () => request('brief') }, data.markdown ? '重新生成' : '生成本周周报'),
                data.markdown && react_1.default.createElement(react_1.default.Fragment, null,
                    react_1.default.createElement("button", { className: "ar-primary", onClick: copy }, "\u590D\u5236 Markdown"),
                    react_1.default.createElement("button", { onClick: openFile }, "\u6253\u5F00\u5DF2\u4FDD\u5B58\u6587\u4EF6 \u2197")))),
        react_1.default.createElement("p", { role: "status", className: "ar-muted" }, notice || '周报无需模型生成。复制和打开操作使用已保存的全文。'),
        data.markdown ? react_1.default.createElement("div", { className: "ar-brief" }, briefSections(data.markdown).map((part, i) => react_1.default.createElement(BriefSection, { part: part, key: i }))) : react_1.default.createElement("div", { className: "ar-card ar-empty" },
            react_1.default.createElement(Icon, { size: 40 }),
            react_1.default.createElement("h3", null, "\u7B2C\u4E00\u4EFD\u5468\u62A5\uFF0C\u4ECE\u8FD9\u91CC\u5F00\u59CB"),
            react_1.default.createElement("p", null, "\u70B9\u51FB\u300C\u751F\u6210\u672C\u5468\u5468\u62A5\u300D\uFF0C\u91C7\u96C6\u5173\u6CE8\u9879\u76EE\u5E76\u4FDD\u5B58\u5230\u6240\u9009\u76EE\u5F55\u3002")));
}
function Dashboard() {
    const [data, setData] = (0, react_1.useState)({ directories: [] });
    const [directory, setDirectory] = (0, react_1.useState)(() => {
        try {
            return localStorage.getItem('apache-radar.directory') ?? '';
        }
        catch {
            return '';
        }
    });
    const [choosing, setChoosing] = (0, react_1.useState)(false);
    const [view, setView] = (0, react_1.useState)('overview');
    const [focusProject, setFocusProject] = (0, react_1.useState)();
    const [busy, setBusy] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)('');
    const [diagnosis, setDiagnosis] = (0, react_1.useState)();
    const [proxyDetection, setProxyDetection] = (0, react_1.useState)();
    const generation = (0, react_1.useRef)(0);
    async function request(action = 'read', project, target = directory, extra) {
        const version = ++generation.current;
        setBusy(true);
        setError('');
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(target ? { directory: target } : {}), action, ...extra, ...(project ? { project } : {}) }) });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error ?? `HTTP ${response.status}`);
            if (generation.current !== version)
                return;
            if (['detect-proxy', 'redetect-proxy', 'apply-proxy', 'clear-proxy'].includes(action)) {
                setProxyDetection(result);
                return;
            }
            if (action === 'diagnose') {
                setDiagnosis(result);
                return;
            }
            setData(result);
            if (result.directory) {
                setDirectory(result.directory);
                setChoosing(false);
                try {
                    localStorage.setItem('apache-radar.directory', result.directory);
                }
                catch { /* Directory selection still works without browser storage. */ }
            }
        }
        catch (cause) {
            if (generation.current === version)
                setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            if (generation.current === version)
                setBusy(false);
        }
    }
    async function exportSnapshot() {
        setError('');
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ directory: data.directory, action: 'export' }) });
            if (!response.ok)
                throw new Error((await response.json()).error);
            const url = URL.createObjectURL(await response.blob()), anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'apache-radar-snapshot.json';
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        catch (error) {
            setError(error instanceof Error ? error.message : '快照导出失败');
        }
    }
    (0, react_1.useEffect)(() => { void request(); return () => { generation.current++; }; }, []);
    (0, react_1.useEffect)(() => {
        const timer = setInterval(() => setClock(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const [clock, setClock] = (0, react_1.useState)(Date.now());
    const countSources = data.counts ? [...data.counts.counts, ...data.counts.retired].flatMap(r => r.sources) : [];
    const securitySources = data.security ? [...data.security.projects.map(p => p.source), data.security.suppressions, data.security.guidance, data.security.flinkPointer].filter(Boolean) : [];
    const stale = securitySources.some(s => s?.status === 'stale' || s?.fetchedAt && clock - Date.parse(s.fetchedAt) >= 3_600_000) || countSources.some(s => s.cacheStatus === 'stale' || (s.fetchedAt && clock - Date.parse(s.fetchedAt) >= 3_600_000))
        || data.sources?.some(s => s.status === 'stale' || (s.fetchedAt && clock - Date.parse(s.fetchedAt) >= 3_600_000));
    const failed = securitySources.some(s => s?.status === 'failed') || data.counts && [...data.counts.counts, ...data.counts.retired].some(r => r.status === 'error') || data.sources?.some(s => s.status === 'failed');
    const ready = !!data.counts;
    return react_1.default.createElement("div", { className: "ar-root", "aria-busy": busy },
        react_1.default.createElement("style", null, css),
        react_1.default.createElement("div", { className: "ar-shell" },
            react_1.default.createElement("header", { className: "ar-header" },
                react_1.default.createElement("div", { className: "ar-brand" },
                    react_1.default.createElement("span", { className: "ar-brand-icon" },
                        react_1.default.createElement(Icon, { size: 27 })),
                    react_1.default.createElement("div", null,
                        react_1.default.createElement("div", { className: "ar-overline" }, "APACHE / COMMUNITY RADAR"),
                        react_1.default.createElement("h1", null, "Apache \u793E\u533A\u96F7\u8FBE"))),
                react_1.default.createElement("span", { className: "ar-local" },
                    react_1.default.createElement("span", { className: "ar-dot" }),
                    "\u672C\u5730\u5DE5\u4F5C\u53F0 \u00B7 \u65E0\u9700\u6A21\u578B")),
            react_1.default.createElement("div", { className: "ar-intro" },
                react_1.default.createElement("p", null, "\u5728\u7EB7\u7E41\u7684\u793E\u533A\u52A8\u6001\u4E2D\uFF0C\u627E\u5230\u4F60\u5173\u5FC3\u7684\u53D8\u5316\u3002"),
                react_1.default.createElement("span", null, "\u516C\u5F00\u6765\u6E90 \u00B7 \u539F\u6587\u53EF\u8FFD\u6EAF \u00B7 UTC+8")),
            react_1.default.createElement("div", { className: "ar-projectbar" },
                data.directory && !choosing ? react_1.default.createElement("div", { className: "ar-directory" },
                    react_1.default.createElement("span", { className: "ar-dot" }),
                    react_1.default.createElement("span", { title: data.directory },
                        "\u672C\u5730\u9879\u76EE \u00B7 ",
                        data.directory.split(/[\\/]/).filter(Boolean).at(-1)),
                    react_1.default.createElement("button", { disabled: busy, onClick: () => setChoosing(true) }, "\u5207\u6362\u76EE\u5F55")) : react_1.default.createElement("form", { onSubmit: e => { e.preventDefault(); void request('read'); } },
                    react_1.default.createElement("label", { htmlFor: "ar-directory" }, "\u9879\u76EE\u76EE\u5F55"),
                    react_1.default.createElement("input", { id: "ar-directory", list: "ar-directories", value: directory, placeholder: "\u8F93\u5165\u672C\u5730\u9879\u76EE\u7684\u7EDD\u5BF9\u8DEF\u5F84", onChange: e => setDirectory(e.target.value), required: true, disabled: busy }),
                    react_1.default.createElement("datalist", { id: "ar-directories" }, data.directories.map(d => react_1.default.createElement("option", { value: d, key: d }))),
                    react_1.default.createElement("button", { disabled: busy }, "\u6253\u5F00")),
                react_1.default.createElement("div", { className: "ar-actions" },
                    react_1.default.createElement("button", { disabled: busy, onClick: () => void request('detect-proxy') }, "\u4ECE\u7CFB\u7EDF\u68C0\u6D4B\u4EE3\u7406"),
                    react_1.default.createElement("button", { disabled: busy || !data.directory, onClick: () => void request('diagnose') }, "\u7F51\u7EDC\u8BCA\u65AD"),
                    react_1.default.createElement("button", { disabled: busy || !data.directory, onClick: () => void exportSnapshot() }, "\u5BFC\u51FA\u5FEB\u7167"),
                    react_1.default.createElement("label", null,
                        "\u5BFC\u5165\u5FEB\u7167 ",
                        react_1.default.createElement("input", { type: "file", accept: "application/json,.json", disabled: busy || !data.directory, style: { maxWidth: 170 }, onChange: async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file)
                                    return;
                                if (file.size > 32 * 1024 * 1024) {
                                    setError('快照超过 32 MiB');
                                    return;
                                }
                                try {
                                    await request('import', undefined, data.directory, { snapshot: await file.text() });
                                }
                                catch {
                                    setError('无法读取快照文件');
                                }
                            } })),
                    react_1.default.createElement("span", { className: "ar-last" },
                        "\u4E0A\u6B21\u91C7\u96C6 ",
                        time(data.collectedAt)),
                    react_1.default.createElement("button", { className: "ar-primary", disabled: busy || !data.directory, onClick: () => void request('refresh', undefined, data.directory) },
                        react_1.default.createElement("span", { className: busy ? 'ar-spin' : '' }, "\u21BB"),
                        " ",
                        busy ? '正在读取…' : '刷新数据'))),
            react_1.default.createElement("nav", { className: "ar-tabs", "aria-label": "\u96F7\u8FBE\u9875\u9762" }, [['overview', '概览', '01'], ['watch', '关注动态', '02'], ['brief', '每周简报', '03']].map(([id, title, num]) => react_1.default.createElement("button", { key: id, "aria-current": view === id ? 'page' : undefined, onClick: () => { setView(id); setFocusProject(undefined); } },
                react_1.default.createElement("span", null, num),
                title))),
            error && react_1.default.createElement("div", { className: "ar-notice danger", role: "alert" },
                react_1.default.createElement("strong", null, "\u64CD\u4F5C\u5931\u8D25"),
                react_1.default.createElement("span", null,
                    error,
                    " ",
                    ready ? '仍保留当前画面中的上次数据。' : ''),
                react_1.default.createElement("button", { disabled: busy, onClick: () => void request('read') }, "\u91CD\u8BD5\u8BFB\u53D6")),
            data.localSnapshot && react_1.default.createElement("div", { className: "ar-notice warn", role: "status" },
                react_1.default.createElement("strong", null, "\u672C\u5730\u5FEB\u7167\uFF08\u5BFC\u5165\uFF09"),
                react_1.default.createElement("span", null, "\u5305\u542B\u5BFC\u5165\u6570\u636E\uFF0C\u975E\u5B9E\u65F6\u5B98\u65B9\u6293\u53D6\uFF1B\u8BF7\u6838\u5BF9\u6765\u6E90\u65F6\u95F4\u3002")),
            data.proxyNote && react_1.default.createElement("div", { className: "ar-notice", role: "status" }, data.proxyNote),
            proxyDetection && react_1.default.createElement("div", { className: "ar-card ar-section", role: "status" },
                react_1.default.createElement("strong", null, "\u4ECE\u7CFB\u7EDF\u68C0\u6D4B\u4EE3\u7406"),
                react_1.default.createElement("p", null,
                    "\u6765\u6E90\uFF1A",
                    proxyDetection.source ?? '插件设置',
                    " \u00B7 \u8BF7\u6C42\u8D85\u65F6\uFF1A",
                    proxyDetection.timeoutSeconds ?? 30,
                    " \u79D2"),
                proxyDetection.pacUrl && react_1.default.createElement("p", null,
                    "PAC \u5730\u5740\uFF1A",
                    proxyDetection.pacUrl),
                react_1.default.createElement("p", null,
                    "Apache \u793A\u4F8B\u4EE3\u7406\uFF1A",
                    proxyDetection.proxy ?? 'DIRECT / 沿用原访问路径'),
                react_1.default.createElement("p", null,
                    "\u4E0A\u6B21\u68C0\u6D4B\uFF1A",
                    proxyDetection.detectedAt ?? '—',
                    " \u00B7 \u7F13\u5B58\u6709\u6548\u671F\uFF1A",
                    (proxyDetection.ttlSeconds ?? 1800) / 60,
                    " \u5206\u949F"),
                proxyDetection.warning && react_1.default.createElement("p", null, proxyDetection.warning),
                proxyDetection.note && react_1.default.createElement("p", null, proxyDetection.note),
                react_1.default.createElement("div", { className: "ar-actions" },
                    react_1.default.createElement("button", { disabled: busy, onClick: () => void request('redetect-proxy') }, "\u91CD\u65B0\u68C0\u6D4B"),
                    react_1.default.createElement("button", { disabled: busy || !proxyDetection.proxy, onClick: () => void request('apply-proxy') }, "\u5E94\u7528\u5230\u63D2\u4EF6\u8BBE\u7F6E"),
                    react_1.default.createElement("button", { disabled: busy, onClick: () => void request('clear-proxy') }, "\u6E05\u7A7A\u63D2\u4EF6\u4EE3\u7406"))),
            diagnosis !== undefined && react_1.default.createElement("div", { className: "ar-card ar-section", role: "status" },
                react_1.default.createElement("strong", null, "\u7F51\u7EDC\u8BCA\u65AD"),
                react_1.default.createElement("pre", { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, JSON.stringify(diagnosis, null, 2))),
            !!data.diagnostics?.length && react_1.default.createElement("div", { className: "ar-notice warn", role: "status" },
                react_1.default.createElement("strong", null, "\u7F51\u7EDC\u8BCA\u65AD \u00B7 \u6765\u6E90\u83B7\u53D6\u5931\u8D25"),
                react_1.default.createElement("div", null, data.diagnostics.map(d => react_1.default.createElement("p", { key: d.code },
                    react_1.default.createElement("b", null,
                        d.code,
                        " \u00B7 ",
                        d.count,
                        " \u4E2A\u6765\u6E90"),
                    react_1.default.createElement("br", null),
                    d.hintZh)))),
            (!data.diagnostics?.length && (stale || failed)) && react_1.default.createElement("div", { className: "ar-notice warn", role: "status" },
                react_1.default.createElement("strong", null, stale ? '正在显示上次成功缓存' : '部分来源未能取得数据'),
                react_1.default.createElement("span", null,
                    stale ? '数据已过期或刷新失败；请核对每个来源的时间。' : '失败不代表没有动态。',
                    " \u5DF2\u4FDD\u7559\u6765\u6E90\u9519\u8BEF\u3002")),
            busy && react_1.default.createElement("div", { role: "status", className: "ar-loading" },
                react_1.default.createElement("span", { className: "ar-spin" }, "\u25CC"),
                " \u6B63\u5728\u8BFB\u53D6\u516C\u5F00\u6765\u6E90\u4E0E\u672C\u5730\u7F13\u5B58\uFF0C\u8BF7\u7A0D\u5019\u2026"),
            ready ? view === 'overview' ? react_1.default.createElement(Overview, { data: data, jump: project => { setFocusProject(project); setView("watch"); } }) : view === 'watch' ? react_1.default.createElement(Watch, { data: data, focusProject: focusProject, mutate: (action, project, extra) => void request(action, project, data.directory, extra), busy: busy }) : react_1.default.createElement(Brief, { data: data, request: action => void request(action, undefined, data.directory), busy: busy })
                : view === 'brief' && data.directory ? react_1.default.createElement(Brief, { data: data, request: action => void request(action, undefined, data.directory), busy: busy }) : !busy && react_1.default.createElement("div", { className: "ar-card ar-empty" },
                    react_1.default.createElement(Icon, { size: 44 }),
                    react_1.default.createElement("h2", null, data.directory ? '雷达已就绪，等待第一次采集' : '为你的项目，打开一扇社区窗口'),
                    react_1.default.createElement("p", null, data.directory ? '点击「刷新数据」获取官方计数与关注动态。只读取公开来源，无需模型或登录。' : '选择已有目录，或在上方输入一个本地项目路径。不需要创建聊天或配置模型。')),
            react_1.default.createElement("footer", { className: "ar-footer" },
                react_1.default.createElement("span", null,
                    "Apache Radar ",
                    react_1.default.createElement("span", { className: "ar-divider" }, "/"),
                    " \u672C\u5730 Apache \u793E\u533A\u96F7\u8FBE"),
                react_1.default.createElement("span", null, "\u7EDF\u8BA1\u53E3\u5F84\u5E76\u5217\u5C55\u793A \u00B7 reporter.apache.org \u4E0D\u4F7F\u7528"))));
}
exports.inject = ['slots'];
function apply(ctx) {
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'apache-radar' }, Dashboard));
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'apache-radar', order: 25, label: () => 'Apache 雷达' }, Icon));
    ctx.slots.inject('plugins.row.config', () => ctx.slots.register({ name: 'plugins.row.config', key: 'dsh-apache-radar#apache-radar' }, props => react_1.default.createElement(network_settings_js_1.NetworkSettings, { ...props })));
}
const css = `
.ar-security-scope{display:flex;flex-wrap:wrap;gap:0 8px;font-size:10px}
.ar-security-scope>span{flex-basis:100%;font-size:10px}
.ar-security-card .ar-number small{font-size:14px;letter-spacing:0;color:var(--ar-faint)}
.ar-root .ar-project-jump{border:0;padding:0;background:transparent;font-size:11px;justify-content:flex-start;white-space:normal;color:var(--ar-accent)}
.ar-security-strip{border-top:2px solid color-mix(in srgb,var(--ar-accent) 45%,var(--ar-line))}
.ar-pin-form{display:flex;align-items:center;flex-wrap:wrap;gap:9px;margin:16px 0;font-size:12px}
.ar-pin-form input{width:190px;max-width:100%}
.ar-advisories{margin-top:16px;border-top:1px solid var(--ar-line);padding-top:12px}
.ar-advisory{padding:13px 0;border-top:1px solid var(--ar-line);scroll-margin-top:20px}
.ar-advisory:first-of-type{margin-top:12px}
.ar-advisory>summary{position:relative;padding-right:22px;display:flex;align-items:flex-start;gap:10px;list-style:none;flex-wrap:wrap}
.ar-advisory>summary:after{content:'＋';position:absolute;right:0;top:0;color:var(--ar-faint)}
.ar-advisory[open]>summary:after{content:'−'}
.ar-advisory>summary b{font-size:12px;color:var(--ar-text)}
.ar-advisory>summary>span:nth-of-type(2){flex:1;min-width:140px}
.ar-advisory-source{flex-basis:100%;font-size:10px;color:var(--ar-faint);overflow-wrap:anywhere}
.ar-advisory-body{padding:12px 0 4px;font-size:12px;overflow-wrap:anywhere}
.ar-advisory-body dl{display:grid;grid-template-columns:105px minmax(0,1fr);gap:8px;padding:14px;background:var(--ar-bg);border-radius:8px}
.ar-advisory-body dt{color:var(--ar-faint)}
.ar-advisory-body dd{margin:0;white-space:pre-line}
.ar-advisory-body pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;max-height:200px;overflow:auto}
.ar-advisory-body .ar-citation{margin:10px 0}
.ar-limits p,.ar-suppressions p{margin:10px 0}
.ar-suppressions{border-top:1px solid var(--ar-line);margin-top:15px;padding-top:15px}
.ar-suppressions article{padding:14px 0;border-bottom:1px solid var(--ar-line);font-size:12px;overflow-wrap:anywhere}
.ar-cve-chip{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:8px 0}
.ar-root .ar-cve-chip button{padding:2px 6px;font-size:11px;color:var(--ar-accent)}

.ar-root {
  --ar-bg:var(--dsw-alias-bg-module-platform);
  --ar-card:var(--dsw-alias-bg-layer-1);
  --ar-text:var(--dsw-alias-label-primary);
  --ar-muted:var(--dsw-alias-label-secondary);
  --ar-faint:var(--dsw-alias-label-tertiary);
  --ar-line:var(--dsw-alias-border-l2);
  --ar-accent:var(--dsw-alias-state-business-primary);
  --ar-warn:var(--dsw-alias-state-warn-label);
  --ar-error:var(--dsw-alias-state-error-primary);
  --ar-success:var(--dsw-alias-state-success-primary);
  height:100%;
  overflow:auto;
  background:var(--ar-bg);
  color:var(--ar-text);
  font-family:inherit;
  font-size:14px;
  line-height:1.6;
  container-type:inline-size
}
.ar-root * {
  box-sizing:border-box
}
.ar-shell {
  max-width:1440px;
  margin:auto;
  padding:40px 42px 24px;
  padding-top:max(40px,var(--dsh-frame-leading-clearance,0px))
}
.ar-root h1,.ar-root h2,.ar-root h3,.ar-root h4,.ar-root p {
  margin:0
}
.ar-root h1 {
  font-size:25px;
  letter-spacing:-.7px;
  font-weight:650
}
.ar-root h2 {
  font-size:19px;
  font-weight:600;
  letter-spacing:-.4px
}
.ar-root h3 {
  font-size:15px;
  font-weight:600
}
.ar-root h4 {
  font-size:12px;
  color:var(--ar-faint);
  font-weight:500;
  margin:15px 0 4px
}
.ar-root a {
  color:inherit;
  text-decoration:none
}
.ar-root a:hover {
  color:var(--ar-accent);
  text-decoration:underline
}
.ar-root button {
  font:inherit;
  cursor:pointer;
  background:var(--ar-card);
  color:var(--ar-text);
  border:1px solid var(--ar-line);
  border-radius:8px;
  padding:7px 13px;
  white-space:nowrap;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px
}
.ar-root button:hover {
  background:var(--dsw-alias-interactive-bg-hover)
}
.ar-root button:disabled {
  opacity:.5;
  cursor:wait
}
.ar-root :is(button,a,input,summary):focus-visible {
  outline:2px solid var(--ar-accent);
  outline-offset:3px
}
.ar-root .ar-primary {
  background:var(--ar-accent);
  color:var(--dsw-static-neutral-bluish-00);
  border-color:transparent
}
.ar-root .ar-primary:hover {
  filter:brightness(1.1);
  background:var(--ar-accent)
}
.ar-root input {
  font:inherit;
  color:inherit;
  background:transparent;
  border:1px solid var(--ar-line);
  border-radius:8px;
  padding:7px 10px;
  min-width:0
}
.ar-header,.ar-brand,.ar-intro,.ar-projectbar,.ar-actions,.ar-card-heading,.ar-section-heading,.ar-watch-toolbar,.ar-footer {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px
}
.ar-brand {
  justify-content:flex-start;
  gap:14px
}
.ar-brand-icon {
  display:grid;
  place-items:center;
  width:50px;
  height:50px;
  background:color-mix(in srgb,var(--ar-accent) 9%,transparent);
  color:var(--ar-accent);
  border:1px solid color-mix(in srgb,var(--ar-accent) 18%,transparent);
  border-radius:14px
}
.ar-overline {
  font-size:10px;
  font-weight:600;
  letter-spacing:1.8px;
  color:var(--ar-faint);
  margin-bottom:3px
}
.ar-local {
  font-size:12px;
  color:var(--ar-muted);
  display:flex;
  align-items:center;
  gap:7px
}
.ar-dot {
  display:inline-block;
  width:6px;
  height:6px;
  border-radius:50%;
  background:var(--ar-success);
  flex-shrink:0
}
.ar-dot.warn {
  background:var(--ar-warn)
}
.ar-intro {
  margin:19px 0 24px;
  color:var(--ar-muted)
}
.ar-intro>span {
  font-size:12px;
  color:var(--ar-faint)
}
.ar-projectbar {
  border:1px solid var(--ar-line);
  border-radius:12px;
  padding:12px 14px;
  background:var(--ar-card);
  flex-wrap:wrap
}
.ar-directory {
  display:flex;
  align-items:center;
  gap:10px;
  font-size:12px;
  color:var(--ar-muted)
}
.ar-directory>span {
  overflow-wrap:anywhere
}
.ar-projectbar form,.ar-watch-toolbar form {
  display:flex;
  align-items:center;
  gap:9px;
  flex:1;
  min-width:200px
}
.ar-projectbar label {
  font-size:12px;
  color:var(--ar-muted);
  white-space:nowrap
}
.ar-projectbar input {
  width:100%;
  max-width:450px;
  font-size:12px;
  font-family:inherit
}
.ar-last {
  font-size:11px;
  color:var(--ar-faint)
}
.ar-tabs {
  display:flex;
  gap:26px;
  border-bottom:1px solid var(--ar-line);
  margin:23px 0 28px
}
.ar-tabs button {
  background:transparent;
  border:0;
  border-radius:0;
  padding:12px 2px 15px;
  color:var(--ar-faint);
  gap:9px;
  font-weight:500;
  position:relative
}
.ar-tabs button span {
  font-size:10px;
  font-variant-numeric:tabular-nums;
  opacity:.65
}
.ar-tabs button[aria-current] {
  color:var(--ar-text)
}
.ar-tabs button[aria-current]:after {
  content:'';
  height:2px;
  background:var(--ar-accent);
  position:absolute;
  bottom:-1px;
  left:0;
  right:0
}
.ar-section-heading {
  margin-bottom:20px;
  align-items:flex-start;
  flex-wrap:wrap
}
.ar-section-heading p {
  font-size:12px;
  color:var(--ar-faint);
  margin-top:5px
}
.ar-card {
  border:1px solid var(--ar-line);
  border-radius:13px;
  background:var(--ar-card);
  box-shadow:0 2px 5px #00000003;
  min-width:0
}
.ar-metrics {
  display:grid;
  grid-template-columns:1.2fr repeat(5,minmax(0,1fr));
  gap:12px;
  margin-bottom:22px
}
.ar-metric {
  padding:19px 18px 16px;
  display:flex;
  flex-direction:column;
  gap:8px
}
.ar-featured {
  border-color:color-mix(in srgb,var(--ar-accent) 32%,var(--ar-line));
  background:linear-gradient(125deg,color-mix(in srgb,var(--ar-accent) 6%,var(--ar-card)),var(--ar-card))
}
.ar-eyebrow {
  font-size:12px;
  font-weight:500;
  color:var(--ar-muted)
}
.ar-number {
  font-size:39px;
  line-height:1.2;
  font-weight:600;
  letter-spacing:-1.7px;
  font-variant-numeric:tabular-nums
}
.ar-featured .ar-number {
  color:var(--ar-accent)
}
.ar-note {
  font-size:11px;
  line-height:1.65;
  color:var(--ar-faint);
  flex:1
}
.ar-citation {
  font-size:10px;
  line-height:1.7;
  color:var(--ar-faint);
  display:flex;
  gap:0 7px;
  flex-wrap:wrap;
  overflow-wrap:anywhere;
  font-variant-numeric:tabular-nums
}
.ar-source-error {
  width:100%;
  margin-top:3px
}
.ar-source-error summary {
  font-size:10px;
  color:var(--ar-error)
}
.ar-citation a {
  color:var(--ar-muted)
}
.ar-citation>span {
  display:block
}
.ar-citation>span:not(.ar-badge) {
  width:100%
}
.ar-two-col {
  display:grid;
  grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);
  gap:20px;
  margin-bottom:20px;
  align-items:start
}
.ar-section {
  padding:23px;
  margin-bottom:20px
}
.ar-two-col>.ar-section {
  margin:0
}
.ar-card-heading {
  margin-bottom:9px;
  align-items:flex-start;
  flex-wrap:wrap
}
.ar-muted {
  color:var(--ar-faint);
  font-size:12px
}
.ar-badge {
  display:inline-flex;
  align-items:center;
  width:fit-content;
  border:1px solid var(--ar-line);
  border-radius:5px;
  padding:1px 6px;
  font-size:10px;
  line-height:1.6;
  color:var(--ar-muted);
  font-weight:500;
  white-space:nowrap
}
.ar-badge.warn {
  color:var(--ar-warn);
  border-color:color-mix(in srgb,var(--ar-warn) 25%,transparent);
  background:color-mix(in srgb,var(--ar-warn) 7%,transparent)
}
.ar-badge.danger {
  color:var(--ar-error);
  background:color-mix(in srgb,var(--ar-error) 8%,transparent);
  border-color:color-mix(in srgb,var(--ar-error) 25%,transparent)
}
.ar-badge.good {
  color:var(--ar-success);
  border-color:color-mix(in srgb,var(--ar-success) 25%,transparent)
}
.ar-retired {
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:10px;
  margin:22px 0
}
.ar-retired-cell {
  padding-right:8px;
  border-right:1px solid var(--ar-line);
  font-size:11px;
  color:var(--ar-muted)
}
.ar-retired-cell:last-child {
  border:0
}
.ar-retired-cell strong {
  display:block;
  color:var(--ar-text);
  font-size:27px;
  font-weight:550;
  margin:5px 0 10px;
  font-variant-numeric:tabular-nums
}
.ar-difference {
  border-top:1px solid var(--ar-line);
  padding:12px 0;
  font-size:11px;
  color:var(--ar-muted)
}
.ar-root summary {
  cursor:pointer;
  font-size:12px;
  color:var(--ar-muted)
}
.ar-difference summary .ar-dot {
  margin-right:6px
}
.ar-difference p {
  margin-top:7px;
  overflow-wrap:anywhere
}
.ar-difference .ar-citation {
  margin-top:7px
}
.ar-categories {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
  margin:20px 0
}
.ar-category {
  background:var(--ar-bg);
  border:1px solid var(--ar-line);
  border-radius:7px;
  min-width:0
}
.ar-category summary {
  list-style:none;
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:8px 10px;
  gap:8px;
  font-size:11px
}
.ar-category b {
  font-variant-numeric:tabular-nums;
  font-weight:500;
  color:var(--ar-text)
}
.ar-category p,.ar-category .ar-citation {
  padding:0 10px 10px;
  font-size:11px;
  color:var(--ar-faint)
}
.ar-footnote {
  font-size:11px;
  color:var(--ar-faint);
  line-height:1.7
}
.ar-notice {
  display:flex;
  align-items:center;
  gap:12px;
  border:1px solid var(--ar-line);
  border-radius:9px;
  padding:12px 16px;
  margin-bottom:20px;
  font-size:12px;
  flex-wrap:wrap
}
.ar-notice.warn {
  color:var(--ar-warn);
  background:color-mix(in srgb,var(--ar-warn) 5%,var(--ar-card));
  border-color:color-mix(in srgb,var(--ar-warn) 25%,transparent)
}
.ar-notice.danger {
  color:var(--ar-error);
  background:color-mix(in srgb,var(--ar-error) 5%,var(--ar-card))
}
.ar-notice span {
  flex:1;
  min-width:180px
}
.ar-notice strong {
  font-weight:550
}
.ar-error-text {
  color:var(--ar-error);
  font-size:11px;
  overflow-wrap:anywhere
}
.ar-loading {
  display:flex;
  align-items:center;
  gap:8px;
  color:var(--ar-faint);
  font-size:12px;
  padding:0 0 16px
}
.ar-spin {
  display:inline-block;
  animation:ar-spin 1.4s linear infinite
}
@keyframes ar-spin {
  to {
    transform:rotate(360deg)
  }
}
.ar-empty {
  padding:70px 25px;
  text-align:center;
  color:var(--ar-faint)
}
.ar-empty svg {
  margin:0 auto 18px;
  color:var(--ar-accent)
}
.ar-empty h2,.ar-empty h3 {
  color:var(--ar-text);
  margin-bottom:10px
}
.ar-empty p {
  max-width:500px;
  margin:auto;
  font-size:13px
}
.ar-watch-toolbar {
  margin-bottom:24px;
  flex-wrap:wrap;
  justify-content:flex-start
}
.ar-watch-toolbar form {
  flex:0 1 auto;
  margin-left:auto
}
.ar-watch-toolbar input {
  width:175px;
  font-size:12px
}
.ar-watch-toolbar button {
  font-size:12px
}
.ar-segment {
  display:flex;
  gap:3px;
  padding:4px;
  background:color-mix(in srgb,var(--ar-text) 4%,transparent);
  border:1px solid var(--ar-line);
  border-radius:10px;
  flex-wrap:wrap
}
.ar-segment button {
  border:0;
  background:transparent;
  color:var(--ar-faint);
  padding:7px 18px;
  min-width:85px
}
.ar-segment button[aria-pressed=true] {
  background:var(--ar-card);
  color:var(--ar-text);
  box-shadow:0 1px 4px #0000000b
}
.ar-item {
  padding:17px 0;
  border-bottom:1px solid var(--ar-line)
}
.ar-item:last-child {
  border-bottom:0
}
.ar-item-meta {
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:7px;
  margin-bottom:8px;
  font-size:10px;
  color:var(--ar-faint)
}
.ar-item-meta .ar-badge {
  white-space:normal;
  overflow-wrap:anywhere;
  max-width:100%
}
.ar-item-meta time {
  margin-left:auto;
  font-variant-numeric:tabular-nums
}
.ar-item-title {
  display:block;
  font-weight:500;
  line-height:1.7;
  font-size:13px;
  overflow-wrap:anywhere
}
.ar-item-title>span {
  color:var(--ar-faint);
  font-size:12px
}
.ar-item-links {
  display:flex;
  gap:12px;
  font-size:10px;
  color:var(--ar-faint);
  margin-top:7px
}
.ar-security {
  border-left:2px solid var(--ar-error);
  padding-left:14px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--ar-error) 4%,transparent),transparent);
  margin-top:9px
}
.ar-item .ar-footnote {
  margin-top:6px
}
.ar-empty-inline {
  color:var(--ar-faint);
  font-size:12px;
  padding:25px 0 15px;
  line-height:1.9
}
.ar-issue-group {
  padding:12px 0 0
}
.ar-issue-group summary {
  font-size:12px;
  font-weight:500
}
.ar-issue-group+.ar-issue-group {
  border-top:1px solid var(--ar-line);
  margin-top:14px
}
.ar-root .ar-more {
  width:100%;
  font-size:11px;
  color:var(--ar-faint);
  background:transparent;
  border-style:dashed;
  margin-top:12px
}
.ar-source-list {
  margin-top:15px
}
.ar-source-row {
  display:flex;
  gap:10px;
  padding:12px 0;
  border-bottom:1px solid var(--ar-line);
  align-items:flex-start;
  font-size:12px
}
.ar-source-row>div {
  min-width:0;
  overflow-wrap:anywhere
}
.ar-brief {
  max-width:980px;
  margin:20px auto
}
.ar-brief .ar-section {
  padding:30px 34px
}
.ar-brief-title {
  margin:28px 0 18px!important
}
.ar-brief-more {
  margin-top:16px;
  padding-top:12px;
  border-top:1px solid var(--ar-line)
}
.ar-brief h1 {
  font-size:23px
}
.ar-brief h2 {
  font-size:18px
}
.ar-brief h3 {
  margin-top:24px
}
.ar-footer {
  margin-top:35px;
  padding-top:20px;
  border-top:1px solid var(--ar-line);
  font-size:10px;
  color:var(--ar-faint);
  flex-wrap:wrap
}
.ar-divider {
  padding:0 8px;
  opacity:.5
}
@container (max-width:1000px) {
  .ar-shell {
    padding:28px 24px 20px
  }
  .ar-metrics {
    grid-template-columns:repeat(3,1fr)
  }
  .ar-two-col {
    grid-template-columns:1fr
  }
  .ar-last,.ar-intro>span {
    display:none
  }
  .ar-retired {
    gap:15px
  }
  .ar-retired-cell {
    font-size:12px
  }
  .ar-brief .ar-section {
    padding:24px
  }
  .ar-local {
    font-size:11px
  }
}
@container (max-width:600px) {
  .ar-shell {
    padding:24px 16px
  }
  .ar-header h1 {
    font-size:21px
  }
  .ar-local {
    display:none
  }
  .ar-metrics {
    grid-template-columns:1fr 1fr
  }
  .ar-metrics .ar-featured {
    grid-column:1/-1
  }
  .ar-metric {
    padding:16px
  }
  .ar-retired {
    grid-template-columns:1fr 1fr;
    gap:18px
  }
  .ar-watch-toolbar form {
    margin-left:0
  }
  .ar-tabs {
    gap:20px
  }
  .ar-section {
    padding:18px
  }
  .ar-projectbar form {
    width:100%;
    flex-basis:100%
  }
  .ar-actions {
    flex-wrap:wrap
  }
  .ar-root h2 {
    font-size:17px
  }
  .ar-intro {
    font-size:12px
  }
  .ar-brief .ar-section {
    padding:20px
  }
  .ar-number {
    font-size:34px
  }
}
@media(prefers-reduced-motion:reduce) {
  .ar-spin {
    animation:none
  }
}
`;

return module.exports;
} });
