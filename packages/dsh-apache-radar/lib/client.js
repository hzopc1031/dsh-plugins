window.__ModuleLoader__.load({ id: 'dsh-apache-radar', factory: hostRequire => {
const settings = { exports: {} };
((module, exports, require) => {"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.networkHint = void 0;
exports.NetworkSettings = NetworkSettings;
// Vendored identically in apache-radar, advisory-impact and github-triage; keep these copies in sync.
const react_1 = require("react");
const networkHint = (code) => /TLS_KEY_TOO_SMALL|key too (?:small|weak)/i.test(code)
    ? '公司证书密钥过短；请在「网络 / 设置」核对 OSV / GitHub API 的证书校验选项。'
    : /CERT|SIGNATURE|ISSUER/.test(code) ? '证书校验失败；请在「网络 / 设置」配置公司 CA。'
        : '来源连接失败；请在「网络 / 设置」检查代理或运行诊断。';
exports.networkHint = networkHint;
function NetworkSettings({ view, endpoint }) {
    const [state, setState] = (0, react_1.useState)({ writable: false });
    const [saving, setSaving] = (0, react_1.useState)(false), [error, setError] = (0, react_1.useState)(''), [saved, setSaved] = (0, react_1.useState)(false);
    const value = state.value ?? {}, disabled = !state.writable || saving;
    async function request(body) {
        if (!endpoint)
            throw new Error('宿主配置编辑服务不可用。');
        const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.error ?? '网络设置保存失败，请重试。');
        return result;
    }
    (0, react_1.useEffect)(() => {
        if (view === 'summary' || !endpoint)
            return;
        let active = true;
        void request({ action: 'read' }).then(result => {
            if (active)
                setState(result);
        }).catch(() => {
            if (active)
                setError('无法读取网络设置，请重新打开后重试。');
        });
        return () => { active = false; };
    }, [endpoint, view]);
    async function write(value) {
        setSaving(true);
        setError('');
        setSaved(false);
        try {
            setState(await request({ action: 'save', value, revision: state.revision }));
            setSaved(true);
        }
        catch (error) {
            setError(error instanceof Error ? error.message : '网络设置保存失败，请重试。');
        }
        finally {
            setSaving(false);
        }
    }
    if (view === 'summary')
        return '网络设置';
    return (0, react_1.createElement)('section', { className: 'ns-settings', 'aria-label': '网络设置' }, (0, react_1.createElement)('style', null, `.ns-settings{font-size:12px;color:var(--dsw-alias-label-secondary)}.ns-settings form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}.ns-settings label{display:flex;flex-direction:column;gap:5px;min-width:0}.ns-settings input,.ns-settings select{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px;min-width:0;width:100%}.ns-settings .ns-toggle{flex-direction:row;align-items:flex-start;margin:10px 0}.ns-settings .ns-toggle input{width:16px;height:16px;flex-shrink:0;accent-color:var(--dsw-alias-state-business-primary)}.ns-settings button{font:inherit;padding:8px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;justify-self:start}.ns-settings :is(input,select,button):focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:3px}.ns-settings [role=alert]{color:var(--dsw-alias-state-error-primary)}.ns-settings .ns-status{display:block;margin-top:10px}.ns-settings button:disabled{opacity:.5}@container (max-width:600px){.ns-settings form{grid-template-columns:minmax(0,1fr)}}`), (0, react_1.createElement)('form', { key: JSON.stringify([value.systemProxy, value.timeoutSeconds, value.httpsProxy, value.noProxy, value.caBundlePath]), onSubmit: (event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const timeout = Number(fields.get('timeoutSeconds'));
            if (!Number.isFinite(timeout) || timeout < 10 || timeout > 120) {
                setError('请求超时须为 10–120 秒。');
                return;
            }
            void write(Object.fromEntries(['systemProxy', 'httpsProxy', 'noProxy', 'caBundlePath', 'timeoutSeconds'].map(key => [key, key === 'timeoutSeconds' ? timeout : String(fields.get(key) ?? '')])));
        } }, (0, react_1.createElement)('label', null, '系统代理', (0, react_1.createElement)('select', { name: 'systemProxy', defaultValue: String(value.systemProxy ?? 'auto'), disabled }, (0, react_1.createElement)('option', { value: 'auto' }, '自动检测（含 PAC）'), (0, react_1.createElement)('option', { value: 'off' }, '关闭自动检测'))), (0, react_1.createElement)('label', null, '请求超时（秒）', (0, react_1.createElement)('input', { name: 'timeoutSeconds', type: 'number', min: 10, max: 120, required: true, defaultValue: Number(value.timeoutSeconds ?? 30), disabled })), ...[['httpsProxy', 'HTTPS 代理', 'http://host:port'], ['noProxy', '绕过代理', 'localhost, .example.com'], ['caBundlePath', '公司 CA 证书路径', 'PEM 文件绝对路径']].map(([key, label, placeholder]) => (0, react_1.createElement)('label', { key }, label, (0, react_1.createElement)('input', { name: key, defaultValue: String(value[key] ?? ''), placeholder, disabled, autoComplete: 'off' }))), (0, react_1.createElement)('button', { type: 'submit', disabled }, saving ? '正在保存…' : '保存网络设置')), ...[['insecureSkipTlsVerifyHosts', '不安全：仅跳过 OSV / GitHub API 证书校验'], ['insecureSkipTlsVerify', '不安全：跳过所有来源的 TLS 证书校验']].map(([key, label]) => (0, react_1.createElement)('label', { key, className: 'ns-toggle' }, (0, react_1.createElement)('input', {
        name: key, type: 'checkbox', checked: value[key] === true, disabled,
        onChange: (event) => write({ [key]: event.target.checked }),
    }), label)), (0, react_1.createElement)('small', null, 'OSV / GitHub API：api.osv.dev / api.github.com。跳过校验会降低连接安全性。'), !state.writable && (0, react_1.createElement)('span', { className: 'ns-status' }, '网络配置暂不可编辑，请检查宿主配置权限。'), error ? (0, react_1.createElement)('span', { role: 'alert', className: 'ns-status' }, error) : saved && (0, react_1.createElement)('span', { role: 'status', className: 'ns-status' }, '网络设置已保存。'));
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
exports.feedDisplay = feedDisplay;
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
const sourceError = (error) => error && /TLS_KEY_TOO_SMALL|key too (?:small|weak)|fetch failed|NETWORK_ERROR|ECONN|ETIMEDOUT|ENOTFOUND|UND_ERR_|CERT|SIGNATURE|ISSUER|HTTP[ _]\d{3}/i.test(error) ? (error.includes('TLS_KEY_TOO_SMALL') ? '证书密钥过短 · 见网络 / 设置' : '来源不可用 · 见网络 / 设置') : error;
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
            label: advisory ? '官方已公布' : project?.source?.data ? '已抓取列表中未找到' : '官方列表不可用，无法核对',
            url: advisory?.url, fetchedAt: project?.source?.fetchedAt, stale: project?.source?.status === 'stale' };
    });
}
const issueTypeName = (type) => ({ bug: '缺陷', improvement: '改进', 'new feature': '新功能', task: '任务', 'sub-task': '子任务', subtask: '子任务', epic: '史诗', wish: '建议', test: '测试', documentation: '文档', 'technical debt': '技术债', security: '安全' })[type?.trim().toLowerCase() ?? ''] ?? (type?.trim() || '其他');
const issueStatusName = (status) => ({ Open: '待处理', 'In Progress': '进行中', Reopened: '重新打开', Resolved: '已解决', Closed: '已关闭', 'Patch Available': '补丁可用', 'In Review': '评审中', 'To Do': '待处理', Done: '已完成' })[status ?? ''] ?? status ?? '状态未知';
const typeTone = (label) => label === '安全' ? 'danger' : label === '缺陷' ? 'warn' : label === '改进' || label === '新功能' ? 'accent' : 'neutral';
function groupIssues(items) {
    const groups = new Map();
    for (const item of items.filter(i => i.kind === 'jira')) {
        const label = item.security ? '安全' : issueTypeName(item.issueType);
        groups.set(label, [...(groups.get(label) ?? []), item]);
    }
    const order = ['安全', '缺陷', '改进', '新功能', '任务', '子任务'];
    return [...groups].sort(([a], [b]) => (order.includes(a) ? order.indexOf(a) : order.length) - (order.includes(b) ? order.indexOf(b) : order.length) || a.localeCompare(b)).map(([label, items]) => ({ label, items }));
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
    return react_1.default.createElement(dsh_client_ui_primitives_1.Tag, { className: "ar-badge", tone: tone === 'good' ? 'success' : tone === 'warn' ? 'warning' : tone === 'danger' ? 'danger' : tone === 'accent' ? 'info' : 'neutral' }, children);
}
const sourceLabel = (source) => `${new URL(source.url).hostname} · ${source.cacheStatus === 'stale' ? '旧缓存 · ' : ''}${source.fetchedAt ? time(source.fetchedAt) : '尚未成功抓取'}`;
function SourceChip({ source }) {
    return react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { label: `${sourceLabel(source)}${source.cacheError ? ` · ${sourceError(source.cacheError)}` : ''}`, portal: true, side: "top" },
        react_1.default.createElement("a", { className: "ar-source-info", href: source.url, target: "_blank", rel: "noreferrer", "aria-label": `来源 ${new URL(source.url).hostname}` }, "\u24D8"));
}
const metricNote = (row) => ({ 'currently-listed': 'TLP 与当前孵化项目', 'chooser-tlps': 'Chooser 顶级项目', 'chooser-podlings': 'Chooser 当前孵化项目', pmcs: '标记为 PMC 的委员会', 'all-committees': '全部委员会，含非 PMC' })[row.id] ?? '独立统计，不合计';
function CountCard({ row, title, featured = false }) {
    return react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { label: `${metricNote(row)} · ${row.sources.map(sourceLabel).join(' / ')}`, portal: true, side: "top", openOnClick: true },
        react_1.default.createElement("article", { tabIndex: 0, className: `ar-card ar-metric ${featured ? 'ar-featured' : ''}`, "aria-label": `${title ?? row.label} ${row.status === 'ok' ? row.value : '暂无数据'}` },
            react_1.default.createElement("h3", { className: "ar-eyebrow" }, title ?? row.label),
            react_1.default.createElement("strong", { className: "ar-number" }, row.status === 'ok' ? row.value : '—'),
            react_1.default.createElement("span", { className: "ar-metric-note" }, metricNote(row)),
            row.status === 'error' && react_1.default.createElement("p", { className: "ar-error-text" }, sourceError(row.error))));
}
const categoryNames = { 'Big data & analytics': '大数据与分析', 'Databases & storage': '数据库与存储', 'Streaming & messaging': '流处理与消息', 'Machine learning & AI': '机器学习与 AI', 'Web, HTTP & APIs': 'Web 与 API', 'Cloud & infrastructure': '云与基础设施', 'Build, testing & dev tools': '构建与开发工具', 'Content, search & documents': '内容与搜索', 'IoT & edge': '物联网与边缘', 'Security & identity': '安全与身份', 'Geospatial & science': '地理与科学计算', 'Integration & workflow': '集成与工作流' };
function CategoryChart({ rows }) {
    const sorted = [...rows].sort((a, b) => (b.status === 'ok' ? b.value : 0) - (a.status === 'ok' ? a.value : 0));
    const max = Math.max(1, ...sorted.map(row => row.status === 'ok' ? row.value : 0));
    return react_1.default.createElement("div", { className: "ar-category-chart", role: "group", "aria-label": "\u9886\u57DF\u5206\u5E03\u6A2A\u6761\u56FE" }, sorted.map(row => {
        const preview = row.members?.slice(0, 3).map(m => m.name).join('、');
        const label = categoryNames[row.label] ?? row.label;
        return react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { key: row.id, label: `${label} · ${row.status === 'ok' ? row.value : '—'}：${preview || '暂无成员'}${(row.members?.length ?? 0) > 3 ? ` 等 ${row.members.length} 个` : ''} · 多标签不合计 · ${row.sources.map(s => new URL(s.url).hostname).join(' / ')}`, portal: true, side: "top", openOnClick: true },
            react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "ghost", className: "ar-category-bar", "aria-label": `${label} ${row.status === 'ok' ? row.value : '暂无数据'}` },
                react_1.default.createElement("span", null, label),
                react_1.default.createElement("strong", null, row.status === 'ok' ? row.value : '—'),
                react_1.default.createElement("span", { className: "ar-bar-track", "aria-hidden": "true" },
                    react_1.default.createElement("i", { style: { width: `${(row.status === 'ok' ? row.value : 0) / max * 100}%` } }))));
    }));
}
function Overview({ data, jump }) {
    const counts = data.counts;
    const titles = ['当前列示', '顶级项目 · TLP', '孵化项目 · Podlings', '项目委员会 · PMC', '全部委员会'];
    const mismatches = counts.comparisons.filter(c => c.status !== 'match');
    return react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ar-section-heading" },
            react_1.default.createElement("div", null,
                react_1.default.createElement("h2", null, "\u793E\u533A\u6982\u51B5"),
                react_1.default.createElement("p", null, "\u5B98\u65B9\u6765\u6E90\u7684\u9879\u76EE\u89C4\u6A21\u4E0E\u5173\u6CE8\u9879\u76EE\u72B6\u6001"))),
        react_1.default.createElement("div", { className: "ar-metrics" }, counts.counts.slice(0, 5).map((row, i) => react_1.default.createElement(CountCard, { key: row.id, row: row, title: titles[i], featured: i === 0 }))),
        react_1.default.createElement("div", { className: "ar-overview-grid" },
            react_1.default.createElement("section", { className: "ar-card ar-section ar-domain" },
                react_1.default.createElement("div", { className: "ar-card-heading" },
                    react_1.default.createElement("h3", null, "\u9886\u57DF\u5206\u5E03"),
                    react_1.default.createElement("span", { className: "ar-heading-count" },
                        counts.categories.status === 'ok' ? counts.categories.rows.length : '—',
                        " \u4E2A\u9886\u57DF")),
                counts.categories.status === 'error' ? react_1.default.createElement("p", { className: "ar-error-text" }, sourceError(counts.categories.error)) : react_1.default.createElement(CategoryChart, { rows: counts.categories.rows })),
            react_1.default.createElement("div", { className: "ar-overview-side" },
                data.security && react_1.default.createElement(SecurityCard, { report: data.security, jump: jump }),
                react_1.default.createElement("section", { className: "ar-card ar-section" },
                    react_1.default.createElement("div", { className: "ar-card-heading" },
                        react_1.default.createElement("h3", null, "\u9000\u4F11\u4E0E Attic"),
                        react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { label: "\u72EC\u7ACB\u7EDF\u8BA1\uFF0C\u4E0D\u5408\u8BA1", portal: true, openOnClick: true },
                            react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "ghost", "aria-label": "\u9000\u4F11\u7EDF\u8BA1\u8BF4\u660E" }, "\u24D8"))),
                    react_1.default.createElement("div", { className: "ar-retired" }, counts.retired.map(row => react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { key: row.id, label: `独立统计，不合计 · ${row.sources.map(sourceLabel).join(' / ')}`, portal: true, side: "top", openOnClick: true },
                        react_1.default.createElement("div", { tabIndex: 0, className: "ar-retired-cell" },
                            react_1.default.createElement("span", null, ({ 'retired-whimsy': 'Whimsy 委员会', 'retired-projects': 'Projects 委员会', 'attic-pmcs': 'Attic PMC', 'attic-subprojects': 'Attic 子项目' })[row.id] ?? row.label),
                            react_1.default.createElement("strong", null, row.status === 'ok' ? row.value : '—'),
                            row.status === 'error' && react_1.default.createElement("p", { className: "ar-error-text" }, sourceError(row.error)))))),
                    react_1.default.createElement("details", { className: "ar-comparisons" },
                        react_1.default.createElement("summary", null,
                            "\u4EA4\u53C9\u6838\u5BF9 ",
                            react_1.default.createElement(Badge, { tone: mismatches.length ? 'warn' : 'good' }, mismatches.length ? `${mismatches.length} 项差异` : '一致')),
                        mismatches.map(c => react_1.default.createElement("details", { className: "ar-difference", key: c.id },
                            react_1.default.createElement("summary", null,
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
                            c.sources.map((s, i) => react_1.default.createElement(SourceChip, { key: i, source: s })))))))),
        react_1.default.createElement("details", { className: "ar-card ar-section ar-methodology" },
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
            react_1.default.createElement(Badge, { tone: item.security ? 'danger' : '' }, item.security ? `安全 · ${kind}` : item.kind === 'jira' ? issueTypeName(item.issueType) : kind),
            item.status && react_1.default.createElement(Badge, { tone: ['accepted', 'implemented', 'released'].includes(item.status) ? 'good' : '' }, item.kind === 'jira' ? issueStatusName(item.statusText ?? item.status) : item.statusText ?? item.status),
            react_1.default.createElement("span", null, item.kind === 'jira' ? item.id : item.version),
            react_1.default.createElement("time", null, item.date ? time(item.date).slice(0, 10) : '日期未知 · 参考条目')),
        react_1.default.createElement("a", { className: "ar-item-title", href: item.url, target: "_blank", rel: "noreferrer" },
            item.title,
            react_1.default.createElement("span", { "aria-label": "\u6253\u5F00\u539F\u6587" }, " \u2197")),
        !!item.security && jiraCves(item.title, true, security).map(cve => react_1.default.createElement("div", { className: "ar-cve-chip", key: cve.id, title: `按已抓取官方列表核对 · ${time(cve.fetchedAt)}${cve.stale ? ' · 旧缓存' : ''}` }, cve.status === 'published' ? react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", onClick: () => revealAdvisory(`${item.project}-${cve.id}`) },
            cve.id,
            " \u00B7 ",
            cve.label,
            " \u2197") : react_1.default.createElement(Badge, null,
            cve.id,
            " \u00B7 ",
            cve.label))),
        react_1.default.createElement("div", { className: "ar-item-links" },
            !!item.fixVersions?.length && react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { label: "\u76EE\u6807\u7248\u672C\uFF0C\u4E0D\u4EE3\u8868\u5DF2\u53D1\u5E03", portal: true, openOnClick: true },
                react_1.default.createElement("span", { tabIndex: 0 },
                    "\u76EE\u6807 ",
                    item.fixVersions.join('、'))),
            react_1.default.createElement("a", { href: item.sourceUrl, target: "_blank", rel: "noreferrer" }, "\u91C7\u96C6\u6765\u6E90 \u2197"),
            item.notesUrl && react_1.default.createElement("a", { href: item.notesUrl, target: "_blank", rel: "noreferrer" }, "\u7248\u672C\u8BF4\u660E \u2197")));
}
function ItemList({ items, empty, security }) {
    const [expanded, setExpanded] = (0, react_1.useState)(false);
    return react_1.default.createElement(react_1.default.Fragment, null,
        items.length ? (expanded ? items : items.slice(0, 4)).map(item => react_1.default.createElement(ItemRow, { key: item.url, item: item, security: security })) : react_1.default.createElement("p", { className: "ar-empty-inline" }, empty),
        items.length > 4 && react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", className: "ar-more", onClick: () => setExpanded(!expanded), "aria-expanded": expanded }, expanded ? '收起' : '展开其余条目'));
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
function feedDisplay(sources, kind, count) {
    const source = sources.find(s => s.kind === kind);
    if (!source || source.status === 'failed')
        return { count: '—', label: '来源不可用', empty: '来源不可用，请查看采集状态后重试。', tone: 'danger' };
    if (source.status === 'unavailable')
        return { count: '—', label: '暂不支持', empty: source.warnings[0] ?? '该项目暂不支持此来源。', tone: '' };
    if (source.status === 'stale')
        return { count: String(count), label: '上次成功缓存', empty: '上次成功缓存中没有条目，请刷新后核对。', tone: 'warn' };
    return { count: String(count), label: '', empty: '近 7 天暂无已收录条目。', tone: '' };
}
function FeedHeading({ name, display }) {
    return react_1.default.createElement("h3", null,
        name,
        " ",
        react_1.default.createElement("span", { className: "ar-heading-count" }, display.count),
        display.label && react_1.default.createElement(Badge, { tone: display.tone }, display.label));
}
function Watch({ data, mutate, busy, focusProject }) {
    const [selected, setSelected] = (0, react_1.useState)(focusProject ?? data.watchList?.[0] ?? '');
    const [newId, setNewId] = (0, react_1.useState)('');
    const project = data.watchList?.includes(selected) ? selected : data.watchList?.[0] ?? '';
    const security = data.security?.projects.find(p => p.project === project);
    const items = data.items?.filter(i => i.project === project) ?? [];
    const undated = data.undatedItems?.filter(i => i.project === project) ?? [];
    const sources = data.sources?.filter(s => !s.project || s.project === project) ?? [];
    const releases = items.filter(i => i.kind === 'release'), proposals = items.filter(i => i.kind === 'proposal'), issues = items.filter(i => i.kind === 'jira');
    const releaseStatus = feedDisplay(sources, 'release', releases.length), proposalStatus = feedDisplay(sources, 'proposal', proposals.length), issueStatus = feedDisplay(sources, 'jira', issues.length);
    return react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "ar-section-heading" },
            react_1.default.createElement("h2", null,
                "\u9879\u76EE\u52A8\u6001 ",
                react_1.default.createElement("span", { className: "ar-heading-count" }, data.watchList?.length ?? 0)),
            react_1.default.createElement("span", { className: "ar-muted" }, "\u6700\u8FD1 7 \u5929")),
        react_1.default.createElement("div", { className: "ar-watch-toolbar" },
            react_1.default.createElement(dsh_client_ui_primitives_1.SegmentedControl, { id: "ar-project", label: "\u5173\u6CE8\u9879\u76EE", value: project, options: (data.watchList ?? []).map(id => ({ value: id, label: projectName(id) })), onChange: setSelected }),
            react_1.default.createElement("details", { className: "ar-manage", open: !project || undefined },
                react_1.default.createElement("summary", null, "\u7BA1\u7406\u5173\u6CE8"),
                react_1.default.createElement("form", { onSubmit: e => { e.preventDefault(); mutate('add', newId); setNewId(''); } },
                    react_1.default.createElement(dsh_client_ui_primitives_1.Input, { "aria-label": "\u6DFB\u52A0\u9879\u76EE id", placeholder: "\u9879\u76EE id\uFF0C\u5982 spark", pattern: "[a-zA-Z][a-zA-Z0-9-]*", required: true, value: newId, onChange: e => setNewId(e.target.value) }),
                    react_1.default.createElement(dsh_client_ui_primitives_1.Button, { type: "submit", size: "sm", variant: "outline", disabled: busy }, "\uFF0B \u5173\u6CE8")),
                project && react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => mutate('remove', project), "aria-label": `取消关注 ${projectName(project)}` }, "\u53D6\u6D88\u5173\u6CE8"))),
        project ? react_1.default.createElement("div", { role: "tabpanel", id: `ar-project-${project}-panel`, "aria-labelledby": `ar-project-${project}` },
            react_1.default.createElement(SecurityStrip, { key: project + (security?.pin ?? ""), project: project, security: security, report: data.security, mutate: mutate, busy: busy, expanded: focusProject === project }),
            react_1.default.createElement("div", { className: "ar-two-col" },
                react_1.default.createElement("section", { className: "ar-card ar-section" },
                    react_1.default.createElement("div", { className: "ar-card-heading" },
                        react_1.default.createElement(FeedHeading, { name: "\u6B63\u5F0F\u53D1\u5E03", display: releaseStatus })),
                    react_1.default.createElement(ItemList, { key: project + 'release', items: releases, empty: releaseStatus.empty })),
                react_1.default.createElement("section", { className: "ar-card ar-section" },
                    react_1.default.createElement("div", { className: "ar-card-heading" },
                        react_1.default.createElement(FeedHeading, { name: project === 'kafka' ? 'KIP' : project === 'flink' ? 'FLIP' : '提案', display: proposalStatus })),
                    react_1.default.createElement(ItemList, { key: project + 'proposal', items: proposals, empty: proposalStatus.empty }))),
            react_1.default.createElement("section", { className: "ar-card ar-section" },
                react_1.default.createElement("div", { className: "ar-card-heading" },
                    react_1.default.createElement(FeedHeading, { name: "JIRA", display: issueStatus }),
                    react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { label: "\u9996\u4E2A\u54CD\u5E94\u9875\uFF1B\u5DE5\u5355\u4E0D\u4EE3\u8868\u5DF2\u53D1\u5E03", portal: true, openOnClick: true },
                        react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "ghost", "aria-label": "JIRA \u91C7\u96C6\u8BF4\u660E" }, "\u24D8"))),
                react_1.default.createElement(IssueDistribution, { items: items }),
                react_1.default.createElement("div", { className: "ar-issue-board" }, groupIssues(items).length ? groupIssues(items).map(group => react_1.default.createElement("details", { "data-issue-type": group.label, className: `ar-issue-group ar-tone-${typeTone(group.label)}`, key: project + group.label, open: group.label === '安全' },
                    react_1.default.createElement("summary", null,
                        react_1.default.createElement("i", { className: "ar-type-dot" }),
                        group.label,
                        " ",
                        react_1.default.createElement("span", { className: "ar-heading-count" }, group.items.length)),
                    react_1.default.createElement(ItemList, { items: group.items, empty: "", security: security }))) : react_1.default.createElement("p", { className: "ar-empty-inline" }, issueStatus.empty))),
            react_1.default.createElement("details", { className: "ar-card ar-section" },
                react_1.default.createElement("summary", null, "\u53C2\u8003\u63D0\u6848 \u00B7 \u65E5\u671F\u672A\u77E5\uFF0C\u4E0D\u8BA1\u5165\u672C\u5468"),
                react_1.default.createElement(ItemList, { key: project + 'undated', items: undated, empty: "\u6682\u65E0\u65E5\u671F\u672A\u77E5\u7684\u53C2\u8003\u6761\u76EE\u3002" })),
            react_1.default.createElement("details", { className: "ar-card ar-section" },
                react_1.default.createElement("summary", null, "\u91C7\u96C6\u7A97\u53E3\u4E0E\u6765\u6E90\u72B6\u6001"),
                react_1.default.createElement("p", { className: "ar-muted" }, data.window?.label),
                react_1.default.createElement(Sources, { sources: sources }))) : react_1.default.createElement("div", { className: "ar-card ar-empty" },
            react_1.default.createElement("h3", null, "\u5173\u6CE8\u5217\u8868\u662F\u7A7A\u7684"),
            react_1.default.createElement("p", null, "\u6DFB\u52A0\u4E00\u4E2A\u9879\u76EE id\uFF0C\u5F00\u59CB\u6574\u7406\u5B83\u7684\u52A8\u6001\u3002")));
}
function IssueDistribution({ items }) {
    const groups = groupIssues(items);
    const total = groups.reduce((n, group) => n + group.items.length, 0);
    return react_1.default.createElement("div", { className: "ar-type-distribution", "aria-label": "JIRA \u7C7B\u578B\u5206\u5E03" },
        react_1.default.createElement("div", { className: "ar-stacked", "aria-hidden": "true" }, groups.map(group => react_1.default.createElement("span", { key: group.label, className: `ar-tone-${typeTone(group.label)}`, style: { flex: group.items.length } }))),
        react_1.default.createElement("div", { className: "ar-type-legend" }, groups.map(group => react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { key: group.label, label: `${group.label} ${group.items.length} · ${Math.round(group.items.length / total * 100)}%`, portal: true },
            react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", className: `ar-type-pill ar-tone-${typeTone(group.label)}`, onClick: e => {
                    const rows = e.currentTarget.closest('section')?.querySelectorAll('.ar-issue-group');
                    const target = Array.from(rows ?? []).find(row => row.dataset.issueType === group.label);
                    if (target) {
                        target.open = true;
                        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        target.querySelector('summary')?.focus();
                    }
                } },
                react_1.default.createElement("i", { className: "ar-type-dot" }),
                group.label,
                react_1.default.createElement("strong", null, group.items.length))))));
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
    return react_1.default.createElement(SourceChip, { source: { url: source.url, fetchedAt: source.fetchedAt ?? null, fetchedAtDisplay: time(source.fetchedAt), sourceTimestamp: source.sourceTimestamp, cacheStatus: source.status === 'stale' ? 'stale' : undefined, cacheError: source.error } });
}
function SecurityCard({ report, jump }) {
    const summary = securityOverview(report);
    const withPin = report.projects.filter(p => p.pin).length;
    return react_1.default.createElement("article", { className: "ar-card ar-section ar-security-card" },
        react_1.default.createElement("div", { className: "ar-card-heading" },
            react_1.default.createElement("h3", null, "\u7248\u672C\u4E0E\u5B89\u5168"),
            react_1.default.createElement(Badge, { tone: summary.affected.length ? 'danger' : '' }, summary.incomplete ? `${summary.affected.length ? `≥${summary.affected.length} 受影响` : '—'} · 来源待核对` : `${summary.affected.length} 个项目受影响`)),
        react_1.default.createElement("div", { className: "ar-security-overview" },
            react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { label: `已填版本 ${withPin} / ${summary.watched}；未填版本或来源不完整时无法判断`, portal: true, openOnClick: true },
                react_1.default.createElement("div", { tabIndex: 0, className: "ar-donut", role: "img", "aria-label": `运行版本覆盖 ${withPin} / ${summary.watched}`, style: { '--ar-ring': `${summary.watched ? withPin / summary.watched * 100 : 0}%` } },
                    react_1.default.createElement("span", null,
                        react_1.default.createElement("strong", null,
                            withPin,
                            react_1.default.createElement("small", null,
                                " / ",
                                summary.watched)),
                        react_1.default.createElement("small", null, "\u5DF2\u586B\u7248\u672C")))),
            react_1.default.createElement("div", { className: "ar-security-projects" }, report.projects.map(p => react_1.default.createElement(dsh_client_ui_primitives_1.Button, { key: p.project, size: "sm", variant: "ghost", className: "ar-project-jump", onClick: () => jump?.(p.project) },
                react_1.default.createElement("span", null, projectName(p.project)),
                react_1.default.createElement(Badge, { tone: summary.affected.includes(p.project) ? 'danger' : '' }, summary.affected.includes(p.project) ? '受影响' : !p.pin ? '未填版本' : !p.source?.data || p.source.status === 'stale' ? '来源待核对' : p.advisories.some(a => a.verdict === 'unknown') ? '部分无法判断' : '已核对'),
                react_1.default.createElement("span", null, "\u2197"))))),
        react_1.default.createElement("p", { className: "ar-note" },
            summary.unpinned,
            " \u4E2A\u672A\u586B\u8FD0\u884C\u7248\u672C",
            summary.incomplete ? ` · ${summary.incomplete} 个来源待核对` : ''));
}
function SecurityStrip({ project, security, report, mutate, busy, expanded = false }) {
    const [version, setVersion] = (0, react_1.useState)(security?.pin ?? '');
    const affected = security?.advisories.filter(a => a.verdict === 'affected').length ?? 0;
    const unknown = security?.advisories.filter(a => a.verdict === 'unknown').length ?? 0;
    const supported = ['kafka', 'hadoop', 'flink'].includes(project);
    return react_1.default.createElement("section", { className: "ar-card ar-section ar-security-strip" },
        react_1.default.createElement("div", { className: "ar-card-heading" },
            react_1.default.createElement("h3", null, "\u7248\u672C\u4E0E\u5B89\u5168"),
            react_1.default.createElement("span", { className: "ar-muted" },
                security?.pin ? security.source?.data ? react_1.default.createElement(react_1.default.Fragment, null,
                    react_1.default.createElement(Badge, { tone: affected ? 'danger' : '' },
                        affected,
                        " \u9879\u53D7\u5F71\u54CD"),
                    " \u00B7 ",
                    unknown,
                    " \u9879\u65E0\u6CD5\u5224\u65AD") : '官方列表不可用，无法判断' : '未填版本 · 无法判断',
                security?.source?.status === 'stale' ? ' · 上次成功缓存' : '')),
        supported && react_1.default.createElement("form", { className: "ar-pin-form", onSubmit: e => { e.preventDefault(); mutate('pin', project, { version }); } },
            react_1.default.createElement("label", { htmlFor: `ar-pin-${project}` }, "\u8FD0\u884C\u7248\u672C"),
            react_1.default.createElement(dsh_client_ui_primitives_1.Input, { id: `ar-pin-${project}`, "aria-label": `${projectName(project)} 运行版本`, placeholder: "\u8F93\u5165\u5B9E\u9645\u7248\u672C\uFF0C\u5982 3.9.0", value: version, maxLength: 200, onChange: e => setVersion(e.target.value) }),
            react_1.default.createElement(dsh_client_ui_primitives_1.Button, { type: "submit", size: "sm", variant: "primary", disabled: busy, className: "ar-primary" }, "\u4FDD\u5B58\u5E76\u6838\u5BF9"),
            security?.pin && react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", type: "button", disabled: busy, onClick: () => mutate('pin', project, { version: '' }) }, "\u6E05\u9664")),
        react_1.default.createElement(SecurityCitation, { source: security?.source }),
        security?.error && react_1.default.createElement("p", { className: "ar-error-text" }, sourceError(security.error)),
        !!security?.notices.length && react_1.default.createElement("details", { className: "ar-limits" },
            react_1.default.createElement("summary", null, "\u6765\u6E90\u8986\u76D6\u8BF4\u660E"),
            security.notices.map(n => react_1.default.createElement("p", { className: "ar-footnote", key: n }, n))),
        project === 'flink' && react_1.default.createElement(SecurityCitation, { source: report?.flinkPointer }),
        react_1.default.createElement("details", { className: "ar-advisories", open: expanded || undefined },
            react_1.default.createElement("summary", null,
                "\u5B98\u65B9\u5B89\u5168\u516C\u544A ",
                react_1.default.createElement("span", { className: "ar-heading-count" }, security?.source?.data ? security.advisories.length : '—')),
            security?.advisories.map(a => react_1.default.createElement("details", { className: "ar-advisory", id: `${project}-${a.id}`, key: a.id, tabIndex: -1, onToggle: e => {
                    if (e.currentTarget.open && a.osv.status === 'unqueried')
                        mutate('osv', project, { cve: a.id });
                } },
                react_1.default.createElement("summary", null,
                    react_1.default.createElement(Badge, { tone: verdictTone[a.verdict] }, verdictName[a.verdict]),
                    react_1.default.createElement("b", null, a.id),
                    react_1.default.createElement("span", null, a.title),
                    react_1.default.createElement("a", { className: "ar-advisory-link", href: a.url, target: "_blank", rel: "noreferrer", onClick: e => e.stopPropagation() }, "\u5B98\u65B9\u539F\u6587 \u2197")),
                react_1.default.createElement("div", { className: "ar-advisory-body" },
                    react_1.default.createElement("p", null, a.reason),
                    react_1.default.createElement("dl", null,
                        react_1.default.createElement("dt", null, "\u5B98\u65B9\u53D7\u5F71\u54CD\u8303\u56F4"),
                        react_1.default.createElement("dd", null, a.affectedText),
                        react_1.default.createElement("dt", null, "\u5B98\u65B9\u4FEE\u590D\u7248\u672C"),
                        react_1.default.createElement("dd", null, a.fixedText ?? '官方未明确列出')),
                    react_1.default.createElement(SecurityCitation, { source: { url: a.url, fetchedAt: a.fetchedAt, sourceTimestamp: a.sourceTimestamp, status: security.source.status, data: null } }),
                    react_1.default.createElement("details", { className: "ar-limits" },
                        react_1.default.createElement("summary", null, "\u5B98\u65B9\u8BF4\u660E\u4E0E\u9002\u7528\u6761\u4EF6"),
                        react_1.default.createElement("p", null, "\u6309\u7EC4\u4EF6\u3001\u914D\u7F6E\u9010\u9879\u6838\u5BF9\uFF1B\u5224\u5B9A\u4E0D\u6784\u6210\u751F\u4EA7\u5B89\u5168\u6216\u5347\u7EA7\u7ED3\u8BBA\u3002"),
                        a.notes.map((note, i) => react_1.default.createElement("p", { key: i }, note))),
                    react_1.default.createElement("div", { className: "ar-osv" },
                        react_1.default.createElement("h4", null, "OSV \u00B7 \u7B2C\u4E8C\u6765\u6E90"),
                        react_1.default.createElement("p", null, a.osv.data?.label ?? (a.osv.status === 'unqueried' ? '展开后按需查询，不用于官方判定。' : '查询失败，不影响官方判定。')),
                        a.osvDifference && react_1.default.createElement("p", { className: "ar-error-text" }, "OSV \u4E0E\u5B98\u65B9\u8303\u56F4\u8868\u8FF0\u4E0D\u540C\uFF1B\u5B98\u65B9\u5224\u5B9A\u4FDD\u6301\u4E0D\u53D8\uFF0C\u8BF7\u5206\u522B\u6838\u5BF9\u7EC4\u4EF6\u548C\u8303\u56F4\u3002"),
                        react_1.default.createElement(SecurityCitation, { source: a.osv }),
                        a.osv.status === 'failed' && react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => mutate('osv', project, { cve: a.id }) }, "\u91CD\u8BD5 OSV"),
                        a.osv.data?.record && react_1.default.createElement("details", null,
                            react_1.default.createElement("summary", null, "OSV \u8303\u56F4\u539F\u6587"),
                            react_1.default.createElement("pre", null, JSON.stringify(a.osv.data.record.affected, null, 2))))))),
            !security?.advisories.length && react_1.default.createElement("p", { className: "ar-empty-inline" }, sourceError(security?.error) ?? '尚未采集官方列表，请刷新；不能据此认定没有公告。'),
            project === 'kafka' && react_1.default.createElement("details", { className: "ar-suppressions" },
                react_1.default.createElement("summary", null, "\u5B98\u65B9\u4E0D\u9002\u7528\u8BF4\u660E \u00B7 suppressions"),
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
    if (part.startsWith('# '))
        return react_1.default.createElement("details", { className: "ar-card ar-section" },
            react_1.default.createElement("summary", null, "\u5468\u62A5\u4FE1\u606F\u4E0E\u7EDF\u8BA1\u53E3\u5F84"),
            react_1.default.createElement(dsh_client_ui_primitives_1.MarkdownText, { text: part, labels: labels, omitHtml: true }));
    if (part.startsWith('## 关注项目动态'))
        return react_1.default.createElement(react_1.default.Fragment, null,
            react_1.default.createElement("h2", { className: "ar-brief-title" }, "\u5173\u6CE8\u9879\u76EE\u52A8\u6001"),
            part.split('\n').slice(1).join('\n').trim().split(/\n(?=### )/).map((project, i) => react_1.default.createElement(BriefSection, { part: project, key: i })));
    if (part.startsWith('## 本周新公告'))
        return react_1.default.createElement("details", { className: "ar-card ar-section" },
            react_1.default.createElement("summary", null,
                "\u672C\u5468\u65B0\u516C\u544A ",
                react_1.default.createElement(Badge, null, part.split('\n').filter(line => /^- (kafka|hadoop|flink) \/ CVE-/.test(line)).length)),
            react_1.default.createElement(dsh_client_ui_primitives_1.MarkdownText, { text: part, labels: labels, omitHtml: true }));
    if (part.startsWith('## '))
        return react_1.default.createElement("details", { className: "ar-card ar-section" },
            react_1.default.createElement("summary", null, part.split('\n')[0].replace(/^## /, '')),
            react_1.default.createElement(dsh_client_ui_primitives_1.MarkdownText, { text: part, labels: labels, omitHtml: true }));
    const lines = part.split('\n');
    // shortcut: generated brief bullets only; use a Markdown AST if the saved format changes.
    const entries = lines.filter(line => line.startsWith('- **'));
    if (!part.startsWith('### ') || !entries.length)
        return react_1.default.createElement("article", { className: "ar-card ar-section" },
            react_1.default.createElement(dsh_client_ui_primitives_1.MarkdownText, { text: part, labels: labels, omitHtml: true }));
    return react_1.default.createElement("article", { className: "ar-card ar-section" },
        react_1.default.createElement("div", { className: "ar-card-heading" },
            react_1.default.createElement("h3", null, projectName(lines[0].replace(/^### /, ''))),
            react_1.default.createElement(Badge, null, entries.length)),
        entries.slice(0, 2).map((line, i) => {
            const split = line.indexOf('；[原文](');
            const title = (split < 0 ? line : line.slice(0, split)).replace(/^- \*\*[^*]+\*\* /, '');
            const link = line.match(/\[原文\]\([^)]+\)/)?.[0] ?? '';
            const type = line.match(/类型：([^；]+)/)?.[1];
            const status = line.match(/状态：([^；]+)/)?.[1];
            const security = line.startsWith('- **安全');
            return react_1.default.createElement("div", { className: "ar-item", key: i },
                react_1.default.createElement("div", { className: "ar-item-meta" },
                    react_1.default.createElement(Badge, { tone: security ? 'danger' : 'accent' }, security ? '安全' : type ? issueTypeName(type) : line.match(/^- \*\*([^*]+)\*\*/)?.[1]),
                    status && react_1.default.createElement(Badge, null, issueStatusName(status)),
                    react_1.default.createElement("time", null, line.match(/日期：(\d{4}-\d{2}-\d{2})/)?.[1])),
                react_1.default.createElement(dsh_client_ui_primitives_1.MarkdownText, { text: `${title} ${link}`, labels: labels, omitHtml: true }));
        }),
        react_1.default.createElement("details", { className: "ar-brief-more" },
            react_1.default.createElement("summary", null, "\u67E5\u770B\u5B8C\u6574\u9879\u76EE\u7B80\u62A5"),
            react_1.default.createElement(dsh_client_ui_primitives_1.MarkdownText, { text: lines.slice(1).join('\n'), labels: labels, omitHtml: true })));
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
                react_1.default.createElement("h2", null, "\u6BCF\u5468\u7B80\u62A5"),
                react_1.default.createElement("p", null, "\u6700\u8FD1 7 \u5929 \u00B7 \u5DF2\u4FDD\u5B58\u7684 Markdown")),
            react_1.default.createElement("div", { className: "ar-actions" },
                react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => request('brief') }, data.markdown ? '重新生成' : '生成本周周报'),
                data.markdown && react_1.default.createElement(react_1.default.Fragment, null,
                    react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", className: "ar-primary", onClick: copy }, "\u590D\u5236 Markdown"),
                    react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", onClick: openFile }, "\u6253\u5F00\u5DF2\u4FDD\u5B58\u6587\u4EF6 \u2197")))),
        notice && react_1.default.createElement("p", { role: "status", className: "ar-muted" }, notice),
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
    const [networkOpen, setNetworkOpen] = (0, react_1.useState)(false);
    const [networkRevision, setNetworkRevision] = (0, react_1.useState)(0);
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
                if (action === 'apply-proxy' || action === 'clear-proxy')
                    setNetworkRevision(revision => revision + 1);
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
                react_1.default.createElement(dsh_client_ui_primitives_1.Tag, { tone: "quiet" }, "v0.1.5")),
            react_1.default.createElement("div", { className: "ar-projectbar", "aria-label": "\u65E5\u5E38\u64CD\u4F5C" },
                data.directory ? react_1.default.createElement("div", { className: "ar-directory" },
                    react_1.default.createElement("span", { className: "ar-dot" }),
                    react_1.default.createElement("span", { title: data.directory }, data.directory.split(/[\\/]/).filter(Boolean).at(-1)),
                    react_1.default.createElement("span", { className: "ar-last" },
                        "\u66F4\u65B0 ",
                        time(data.collectedAt))) : react_1.default.createElement("form", { onSubmit: e => { e.preventDefault(); void request('read'); } },
                    react_1.default.createElement("label", { htmlFor: "ar-directory" }, "\u9879\u76EE\u76EE\u5F55"),
                    react_1.default.createElement(dsh_client_ui_primitives_1.Input, { id: "ar-directory", list: "ar-directories", value: directory, placeholder: "\u672C\u5730\u9879\u76EE\u7684\u7EDD\u5BF9\u8DEF\u5F84", onChange: e => setDirectory(e.target.value), required: true, disabled: busy }),
                    react_1.default.createElement("datalist", { id: "ar-directories" }, data.directories.map(d => react_1.default.createElement("option", { value: d, key: d }))),
                    react_1.default.createElement(dsh_client_ui_primitives_1.Button, { type: "submit", size: "sm", variant: "outline", disabled: busy }, "\u6253\u5F00")),
                react_1.default.createElement(dsh_client_ui_primitives_1.Button, { variant: "primary", className: "ar-primary", disabled: busy || !data.directory, onClick: () => void request('refresh', undefined, data.directory) },
                    react_1.default.createElement("span", { className: busy ? 'ar-spin' : '' }, "\u21BB"),
                    " ",
                    busy ? '正在读取…' : '刷新数据')),
            react_1.default.createElement("details", { className: "ar-network", onToggle: e => setNetworkOpen(e.currentTarget.open) },
                react_1.default.createElement("summary", null, "\u7F51\u7EDC / \u8BBE\u7F6E"),
                react_1.default.createElement("div", { className: "ar-card ar-section ar-network-body" },
                    react_1.default.createElement("div", null,
                        react_1.default.createElement("div", { className: "ar-card-heading" },
                            react_1.default.createElement("h3", null, "\u8FDE\u63A5\u8BBE\u7F6E"),
                            react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { label: "\u8DF3\u8FC7\u6821\u9A8C\u4F1A\u964D\u4F4E\u8FDE\u63A5\u5B89\u5168\u6027\uFF1B\u9650\u5B9A\u5F00\u5173\u4EC5\u7528\u4E8E api.osv.dev / api.github.com", portal: true, openOnClick: true },
                                react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "ghost", "aria-label": "\u8BC1\u4E66\u6821\u9A8C\u8BF4\u660E" }, "\u24D8"))),
                        networkOpen && react_1.default.createElement(network_settings_js_1.NetworkSettings, { key: networkRevision, endpoint: "/api/apache-radar/network-settings" })),
                    react_1.default.createElement("div", null,
                        react_1.default.createElement("h3", null, "\u4EE3\u7406\u4E0E\u8BCA\u65AD"),
                        react_1.default.createElement("div", { className: "ar-actions" },
                            react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => void request(proxyDetection ? 'redetect-proxy' : 'detect-proxy') }, proxyDetection ? '重新检测' : '从系统检测代理'),
                            react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", disabled: busy || !data.directory, onClick: () => void request('diagnose') }, "\u7F51\u7EDC\u8BCA\u65AD")),
                        data.proxyNote && !proxyDetection && react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { label: data.proxyNote, portal: true, openOnClick: true },
                            react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "ghost", "aria-label": "\u4EE3\u7406\u72B6\u6001\u8BF4\u660E" }, "\u81EA\u52A8\u4EE3\u7406 \u24D8")),
                        proxyDetection && react_1.default.createElement("div", { className: "ar-proxy-result", role: "status" },
                            react_1.default.createElement(dsh_client_ui_primitives_1.Tooltip, { label: data.proxyNote ?? '当前系统代理检测结果', portal: true, openOnClick: true },
                                react_1.default.createElement("p", { tabIndex: 0 },
                                    proxyDetection.source ?? '插件设置',
                                    " \u00B7 ",
                                    proxyDetection.proxy ? '检测到代理' : '直连',
                                    " \u00B7 ",
                                    proxyDetection.timeoutSeconds ?? 30,
                                    "s \u24D8")),
                            react_1.default.createElement("details", null,
                                react_1.default.createElement("summary", null, "\u8BE6\u60C5"),
                                proxyDetection.pacUrl && react_1.default.createElement("p", null,
                                    "PAC\uFF1A",
                                    proxyDetection.pacUrl),
                                react_1.default.createElement("p", null,
                                    "\u4EE3\u7406\uFF1A",
                                    proxyDetection.proxy ?? 'DIRECT'),
                                react_1.default.createElement("p", null,
                                    "\u68C0\u6D4B ",
                                    proxyDetection.detectedAt ?? '—',
                                    " \u00B7 \u7F13\u5B58 ",
                                    (proxyDetection.ttlSeconds ?? 1800) / 60,
                                    " \u5206\u949F"),
                                proxyDetection.warning && react_1.default.createElement("p", null, proxyDetection.warning),
                                proxyDetection.note && react_1.default.createElement("p", null, proxyDetection.note)),
                            react_1.default.createElement("div", { className: "ar-actions" },
                                react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", disabled: busy || !proxyDetection.proxy, onClick: () => void request('apply-proxy') }, "\u5E94\u7528\u5230\u63D2\u4EF6\u8BBE\u7F6E"),
                                react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => void request('clear-proxy') }, "\u6E05\u7A7A\u63D2\u4EF6\u4EE3\u7406"))),
                        (diagnosis !== undefined || !!data.diagnostics?.length) && react_1.default.createElement("details", { className: "ar-diagnostics" },
                            react_1.default.createElement("summary", null, "\u8BCA\u65AD\u8BE6\u60C5"),
                            data.diagnostics?.map(d => react_1.default.createElement("p", { key: d.code },
                                d.code,
                                " \u00B7 ",
                                d.count,
                                " \u4E2A\u6765\u6E90 \u00B7 ",
                                d.hintZh)),
                            diagnosis !== undefined && react_1.default.createElement("pre", null, JSON.stringify(diagnosis, null, 2))),
                        react_1.default.createElement("h3", null, "\u672C\u5730\u6570\u636E"),
                        react_1.default.createElement("div", { className: "ar-actions" },
                            react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", disabled: busy || !data.directory, onClick: () => void exportSnapshot() }, "\u5BFC\u51FA\u5FEB\u7167"),
                            react_1.default.createElement("label", { className: "ar-import" },
                                "\u5BFC\u5165\u5FEB\u7167 ",
                                react_1.default.createElement("input", { "aria-label": "\u5BFC\u5165\u5FEB\u7167", type: "file", accept: "application/json,.json", disabled: busy || !data.directory, onChange: async (e) => {
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
                                    } }))),
                        data.directory && react_1.default.createElement(react_1.default.Fragment, null,
                            react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", className: "ar-quiet", disabled: busy, onClick: () => setChoosing(!choosing), "aria-expanded": choosing }, "\u5207\u6362\u76EE\u5F55"),
                            choosing && react_1.default.createElement("form", { className: "ar-directory-form", onSubmit: e => { e.preventDefault(); void request('read'); } },
                                react_1.default.createElement("label", { htmlFor: "ar-change-directory" }, "\u9879\u76EE\u7EDD\u5BF9\u8DEF\u5F84"),
                                react_1.default.createElement(dsh_client_ui_primitives_1.Input, { id: "ar-change-directory", value: directory, onChange: e => setDirectory(e.target.value), required: true, disabled: busy }),
                                react_1.default.createElement(dsh_client_ui_primitives_1.Button, { type: "submit", size: "sm", variant: "outline", disabled: busy }, "\u6253\u5F00\u76EE\u5F55")))))),
            react_1.default.createElement("nav", { className: "ar-tabs", "aria-label": "\u96F7\u8FBE\u9875\u9762" },
                react_1.default.createElement(dsh_client_ui_primitives_1.SegmentedTabs, { size: "sm", label: "\u96F7\u8FBE\u9875\u9762", value: view, onChange: id => { setView(id); setFocusProject(undefined); }, items: [
                        { value: 'overview', label: '总览', id: 'ar-overview-tab', panelId: 'ar-overview-panel' },
                        { value: 'watch', label: '关注动态', id: 'ar-watch-tab', panelId: 'ar-watch-panel' },
                        { value: 'brief', label: '每周简报', id: 'ar-brief-tab', panelId: 'ar-brief-panel' },
                    ] })),
            error && react_1.default.createElement("div", { className: "ar-notice danger", role: "alert" },
                react_1.default.createElement("span", null,
                    sourceError(error),
                    ready ? ' · 保留上次数据' : ''),
                react_1.default.createElement(dsh_client_ui_primitives_1.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => void request('read') }, "\u91CD\u8BD5")),
            data.localSnapshot && react_1.default.createElement("p", { className: "ar-notice warn", role: "status" }, "\u672C\u5730\u5FEB\u7167 \u00B7 \u975E\u5B9E\u65F6\u6570\u636E\uFF0C\u8BF7\u6838\u5BF9\u6765\u6E90\u65F6\u95F4\u3002"),
            !!data.diagnostics?.length ? react_1.default.createElement("p", { className: "ar-notice warn", role: "status" },
                (0, network_settings_js_1.networkHint)(data.diagnostics.find(d => d.code === 'TLS_KEY_TOO_SMALL')?.code ?? data.diagnostics[0].code),
                stale ? ' · 保留上次数据' : '') : (stale || failed) && react_1.default.createElement("p", { className: "ar-notice warn", role: "status" }, stale ? '正在显示上次成功缓存，请刷新后核对。' : '部分来源获取失败，请刷新或查看来源状态。'),
            busy && !ready && react_1.default.createElement("div", { role: "status", "aria-label": "\u6B63\u5728\u8BFB\u53D6", className: "ar-loading" },
                react_1.default.createElement("span", { className: "ar-spin" }, "\u25CC")),
            react_1.default.createElement("div", { role: "tabpanel", id: `ar-${view}-panel`, "aria-labelledby": `ar-${view}-tab` }, ready ? view === 'overview' ? react_1.default.createElement(Overview, { data: data, jump: project => { setFocusProject(project); setView("watch"); } }) : view === 'watch' ? react_1.default.createElement(Watch, { data: data, focusProject: focusProject, mutate: (action, project, extra) => void request(action, project, data.directory, extra), busy: busy }) : react_1.default.createElement(Brief, { data: data, request: action => void request(action, undefined, data.directory), busy: busy })
                : view === 'brief' && data.directory ? react_1.default.createElement(Brief, { data: data, request: action => void request(action, undefined, data.directory), busy: busy }) : !busy && react_1.default.createElement("div", { className: "ar-card ar-empty" },
                    react_1.default.createElement(Icon, { size: 44 }),
                    react_1.default.createElement("h2", null, data.directory ? '开始关注社区变化' : '打开你的项目'),
                    react_1.default.createElement("p", null, data.directory ? '点击「刷新数据」获取社区概况与项目动态。' : '填写本地项目目录，开始使用社区雷达。'))),
            react_1.default.createElement("footer", { className: "ar-footer" },
                react_1.default.createElement("span", null, "Apache Radar \u00B7 0.1.5"))));
}
exports.inject = ['slots'];
function apply(ctx) {
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'apache-radar' }, Dashboard));
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'apache-radar', order: 25, label: () => 'Apache 雷达' }, Icon));
    ctx.slots.inject('plugins.row.config', () => ctx.slots.register({ name: 'plugins.row.config', key: 'dsh-apache-radar#apache-radar' }, props => react_1.default.createElement(network_settings_js_1.NetworkSettings, { ...props, endpoint: "/api/apache-radar/network-settings" })));
}
const css = `
.ar-root{--ar-bg:var(--dsw-alias-bg-module-platform);--ar-card:var(--dsw-alias-bg-layer-1);--ar-text:var(--dsw-alias-label-primary);--ar-muted:var(--dsw-alias-label-secondary);--ar-faint:var(--dsw-alias-label-secondary);--ar-line:var(--dsw-alias-border-l2);--ar-accent:var(--dsw-alias-state-business-primary);--ar-warn:var(--dsw-alias-state-warn-primary);--ar-error:var(--dsw-alias-state-error-primary);--ar-success:var(--dsw-alias-state-success-primary);height:100%;overflow:auto;background:var(--ar-bg);color:var(--ar-text);font-family:inherit;font-size:13px;line-height:1.6;container-type:inline-size}
.ar-root *{box-sizing:border-box}
.ar-shell{max-width:1400px;margin:auto;padding:24px 28px;padding-top:max(24px,var(--dsh-frame-leading-clearance,0px))}
.ar-root :is(h1,h2,h3,h4,p){margin:0}
.ar-root h1{font-size:23px;letter-spacing:-.6px;font-weight:500}
.ar-root h2{font-size:17px;font-weight:500}
.ar-root h3{font-size:14px;font-weight:500}
.ar-root h4{font-size:12px;font-weight:500;margin:12px 0 4px;color:var(--ar-muted)}
.ar-root strong,.ar-root b{font-weight:500;font-variant-numeric:tabular-nums}
.ar-root a{color:inherit;text-decoration:none;overflow-wrap:anywhere}
.ar-root a:focus-visible{text-decoration:underline}
.ar-root :is(button,a,input,summary,[tabindex]):focus-visible{outline:2px solid var(--ar-accent);outline-offset:3px}
.ar-root button{font-family:inherit;flex-shrink:0}
.ar-root input{min-width:0}
.ar-root form>span:has(input){min-width:0;max-width:100%}
.ar-root :is(.ar-error-text,.ar-diagnostics,.ar-difference,.ar-notice){overflow-wrap:anywhere}
.ar-header,.ar-brand,.ar-projectbar,.ar-actions,.ar-card-heading,.ar-section-heading,.ar-watch-toolbar,.ar-footer{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ar-brand{justify-content:flex-start;gap:12px}
.ar-brand-icon{width:42px;height:42px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--ar-accent) 35%,var(--ar-line));border-radius:var(--dsw-radius-md,12px);color:var(--ar-accent);background:radial-gradient(circle at 25% 20%,color-mix(in srgb,var(--ar-accent) 18%,var(--ar-card)),var(--ar-card) 75%)}
.ar-overline{font-size:10px;letter-spacing:1.5px;color:var(--ar-muted)}
.ar-projectbar{flex-wrap:wrap;margin-top:16px;padding:10px 12px;border:1px solid var(--ar-line);border-radius:var(--dsw-radius-md,12px);background:var(--ar-card);font-size:12px}
.ar-directory{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0;color:var(--ar-muted)}
.ar-directory>span{overflow-wrap:anywhere}
.ar-last{font-size:11px;color:var(--ar-muted)}
.ar-dot{width:5px;height:5px;border-radius:50%;display:inline-block;flex:none;background:var(--ar-success)}
.ar-projectbar form,.ar-directory-form,.ar-watch-toolbar form{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}
.ar-projectbar form{flex:1}.ar-projectbar form>span:has(input){flex:1;max-width:450px}
.ar-tabs{display:flex;margin:8px 0 18px;border-bottom:1px solid var(--ar-line);padding-bottom:10px}.ar-tabs>[role=tablist]{width:300px;max-width:100%}
.ar-section-heading{margin:0 0 12px;flex-wrap:wrap}
.ar-section-heading p{font-size:12px;color:var(--ar-muted)}
.ar-card{min-width:0;border:1px solid var(--ar-line);border-radius:var(--dsw-radius-md,12px);background:var(--ar-card)}
.ar-section{padding:16px;margin-bottom:12px}
.ar-card-heading{margin-bottom:12px;flex-wrap:wrap;min-height:24px}
.ar-card-heading>h3{display:flex;align-items:center}
.ar-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:12px}
.ar-metric{padding:16px;display:flex;flex-direction:column;gap:5px;position:relative;overflow:hidden;min-height:110px}.ar-metric>*{position:relative;z-index:1}

.ar-featured{grid-column:span 2;border-color:color-mix(in srgb,var(--ar-accent) 34%,var(--ar-line));background:linear-gradient(115deg,color-mix(in srgb,var(--ar-accent) 12%,var(--ar-card)),var(--ar-card) 75%)}.ar-featured:after{content:"";position:absolute;right:-24px;top:-48px;width:150px;height:150px;border:1px solid color-mix(in srgb,var(--ar-accent) 18%,transparent);border-radius:50%;box-shadow:0 0 0 22px color-mix(in srgb,var(--ar-accent) 4%,transparent),0 0 0 44px color-mix(in srgb,var(--ar-accent) 3%,transparent);pointer-events:none}.ar-featured .ar-number{font-size:34px}
.ar-featured .ar-number{color:var(--ar-accent)}
.ar-root h3.ar-eyebrow{font-size:12px;color:var(--ar-muted);font-weight:400}.ar-metric-note{font-size:11px;color:var(--ar-muted);line-height:1.4}.ar-card-heading h3 .ar-badge{margin-left:8px}
.ar-number{font-size:26px;line-height:1.3;letter-spacing:-.5px}
.ar-overview-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:12px;align-items:stretch;margin-bottom:12px}
.ar-overview-grid>.ar-section,.ar-overview-side>.ar-section{margin:0}
.ar-overview-side{display:grid;gap:12px;align-content:start;min-width:0}
.ar-domain{display:flex;flex-direction:column}.ar-section-heading p{margin-top:3px}.ar-card-heading h3{gap:8px}.ar-domain .ar-card-heading h3:before,.ar-security-card .ar-card-heading h3:before{content:"";display:inline-block;width:4px;height:15px;border-radius:2px;background:var(--ar-accent)}
.ar-category-chart{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 18px;align-content:space-between;flex:1}
.ar-root .ar-category-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 12px;height:auto;padding:8px 0;border-radius:0;text-align:left;background:transparent;width:100%;font-size:12px;white-space:normal;line-height:1.5}
.ar-category-bar>span:first-child{color:var(--ar-muted)}
.ar-category-bar strong{color:var(--ar-text)}
.ar-bar-track{grid-column:1/-1;display:block;height:6px;border-radius:3px;overflow:hidden;background:color-mix(in srgb,var(--ar-accent) 11%,var(--ar-card))}
.ar-bar-track i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--ar-accent),color-mix(in srgb,var(--ar-accent) 68%,var(--ar-card)))}
.ar-category-bar:nth-child(even) .ar-bar-track i{opacity:.65}
.ar-security-overview{display:flex;align-items:center;gap:20px;margin:12px 0}
.ar-donut{corner-shape:round;width:112px;height:112px;flex:none;border-radius:50%;background:conic-gradient(var(--ar-accent) var(--ar-ring),color-mix(in srgb,var(--ar-accent) 12%,var(--ar-card)) 0);display:grid;place-items:center}
.ar-donut>span{corner-shape:round;display:flex;align-items:center;justify-content:center;flex-direction:column;width:90px;height:90px;border-radius:50%;background:var(--ar-card)}
.ar-donut strong{font-size:28px;line-height:1.2}.ar-donut small{font-size:11px;color:var(--ar-muted);margin-top:3px}
.ar-security-projects{display:grid;gap:4px;flex:1;min-width:0}
.ar-root .ar-project-jump{width:100%;justify-content:space-between;padding:3px 0;height:auto;min-height:28px;gap:6px;white-space:normal;font-size:12px}
.ar-note,.ar-footnote{font-size:11px;color:var(--ar-muted)}
.ar-retired{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0 12px}
.ar-retired-cell{font-size:11px;color:var(--ar-muted);min-width:0;overflow-wrap:anywhere}
.ar-retired-cell strong{font-size:25px;display:block;line-height:1.4;color:var(--ar-text)}
.ar-comparisons{border-top:1px solid var(--ar-line);padding-top:9px}
.ar-root summary{cursor:pointer;font-size:12px;color:var(--ar-muted);line-height:1.7}
.ar-root summary::marker{font-size:10px}
.ar-comparisons summary .ar-badge{margin-left:8px}
.ar-difference{border-top:1px solid var(--ar-line);padding:10px 0;font-size:12px}
.ar-difference p,.ar-methodology[open]>p{margin:10px 0}
.ar-heading-count{font-size:12px;font-weight:400;color:var(--ar-muted);margin-left:8px;font-variant-numeric:tabular-nums}
.ar-muted{font-size:12px;color:var(--ar-muted)}
.ar-error-text{font-size:12px;color:var(--ar-error)}
.ar-notice{font-size:12px;padding:9px 12px;border:1px solid var(--ar-line);border-radius:8px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ar-notice.warn{color:var(--ar-warn);background:color-mix(in srgb,var(--ar-warn) 5%,var(--ar-card));border-color:color-mix(in srgb,var(--ar-warn) 25%,var(--ar-line))}
.ar-notice.danger{color:var(--ar-error)}
.ar-loading{min-height:180px;display:grid;place-items:center;font-size:28px;color:var(--ar-muted)}
.ar-spin{display:inline-block;animation:ar-spin 1.4s linear infinite}@keyframes ar-spin{to{transform:rotate(360deg)}}
.ar-empty{padding:48px 20px;text-align:center;color:var(--ar-muted)}
.ar-empty svg{color:var(--ar-accent);margin-bottom:12px}.ar-empty h2,.ar-empty h3{color:var(--ar-text);margin-bottom:8px}.ar-empty p{font-size:13px}
.ar-empty-inline{font-size:12px;color:var(--ar-muted);padding:10px 0}
.ar-watch-toolbar{margin-bottom:12px;flex-wrap:wrap;justify-content:flex-start}
.ar-manage{margin-left:auto;max-width:100%}.ar-manage[open]{padding:10px;border:1px solid var(--ar-line);border-radius:8px;background:var(--ar-card)}
.ar-manage form{margin:8px 0}
.ar-security-strip{border-top:2px solid color-mix(in srgb,var(--ar-accent) 50%,var(--ar-line))}
.ar-pin-form{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0;font-size:12px}.ar-pin-form>span:has(input){width:190px}
.ar-security-strip>.ar-source-info{float:right}.ar-root .ar-source-info{display:inline-flex;align-items:center;justify-content:center;width:24px;min-width:24px;height:24px;padding:0;color:var(--ar-muted)}
.ar-limits{margin:6px 0}.ar-limits p{margin:8px 0}
.ar-advisories{margin-top:10px;padding-top:10px;border-top:1px solid var(--ar-line)}
.ar-advisory{padding:10px 0;border-top:1px solid var(--ar-line);scroll-margin-top:20px}.ar-advisory:first-of-type{margin-top:10px}
.ar-advisory>summary{position:relative;display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;list-style:none;padding-right:20px}
.ar-advisory>summary:after{content:'＋';position:absolute;right:0;top:0}.ar-advisory[open]>summary:after{content:'−'}
.ar-advisory>summary>span:nth-of-type(2){flex:1;min-width:140px;line-height:1.6}.ar-advisory-link{font-size:11px;margin-left:auto}
.ar-advisory-body{font-size:13px;padding:12px 0 4px;overflow-wrap:anywhere}
.ar-advisory-body dl{display:grid;grid-template-columns:105px minmax(0,1fr);gap:8px;padding:12px;background:var(--ar-bg);border-radius:8px}.ar-advisory-body dd{margin:0;white-space:pre-line}.ar-advisory-body dt{color:var(--ar-muted)}
.ar-advisory-body pre,.ar-diagnostics pre{font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto}
.ar-osv,.ar-suppressions{border-top:1px solid var(--ar-line);padding-top:10px;margin-top:12px}.ar-suppressions article{padding:12px 0;border-bottom:1px solid var(--ar-line);font-size:12px;overflow-wrap:anywhere}
.ar-cve-chip{margin:6px 0;display:flex;flex-wrap:wrap;gap:8px}.ar-root .ar-cve-chip button{color:var(--ar-accent);font-size:11px}
.ar-two-col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px;align-items:start}.ar-two-col>.ar-section{margin:0}
.ar-item{padding:10px 0;border-bottom:1px solid var(--ar-line);min-width:0}.ar-item:last-child{border-bottom:0}
.ar-item-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:11px;color:var(--ar-muted);margin-bottom:5px}.ar-item-meta time{margin-left:auto;font-variant-numeric:tabular-nums}
.ar-item-title{display:block;font-size:13px;font-weight:500;line-height:1.6;overflow-wrap:anywhere}.ar-item-title>span{color:var(--ar-muted);font-size:11px}
.ar-item-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:5px;font-size:11px;color:var(--ar-muted)}
.ar-tone-danger{--ar-type:var(--ar-error)}.ar-tone-warn{--ar-type:var(--ar-warn)}.ar-tone-accent{--ar-type:var(--ar-accent)}.ar-tone-neutral{--ar-type:var(--dsw-alias-label-secondary)}
.ar-stacked{display:flex;gap:2px;height:9px;border-radius:4px;overflow:hidden;background:var(--ar-bg);margin:4px 0 10px}.ar-stacked>span{background:var(--ar-type)}
.ar-type-legend{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.ar-root .ar-type-pill{font-size:12px;gap:6px;height:28px;padding:3px 8px;background:color-mix(in srgb,var(--ar-type) 5%,var(--ar-card));color:var(--ar-text)}
.ar-type-dot{width:6px;height:6px;display:inline-block;flex:none;border-radius:2px;background:var(--ar-type)}
.ar-issue-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:start}
.ar-issue-group{border:1px solid var(--ar-line);border-radius:8px;min-width:0;padding:9px 12px;background:var(--ar-card)}
.ar-issue-group>summary{list-style:none;display:flex;align-items:center;gap:7px;color:var(--ar-text);min-height:24px}.ar-issue-group>summary:after{content:'＋';margin-left:auto;color:var(--ar-muted)}.ar-issue-group[open]>summary:after{content:'−'}
.ar-issue-group.ar-tone-danger{grid-column:1/-1;border-color:color-mix(in srgb,var(--ar-error) 24%,var(--ar-line));background:color-mix(in srgb,var(--ar-error) 2%,var(--ar-card))}
.ar-issue-group[open]{grid-column:1/-1}.ar-issue-group[open]>.ar-item{display:inline-block;vertical-align:top;width:calc(50% - 8px);margin-right:16px}.ar-issue-group[open]>.ar-item:nth-of-type(even){margin-right:0}
.ar-root .ar-more{width:100%;font-size:12px;color:var(--ar-muted);margin-top:8px;background:transparent;border:0}
.ar-source-list{margin-top:12px}.ar-source-row{display:flex;align-items:flex-start;gap:10px;padding:10px 0;font-size:12px;border-bottom:1px solid var(--ar-line)}.ar-source-row>div{min-width:0;overflow-wrap:anywhere}
.ar-brief{line-height:1.8;max-width:1100px;margin:16px auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ar-brief>.ar-card{margin:0}.ar-brief>details,.ar-brief-title{grid-column:1/-1}.ar-brief-title{margin:6px 0!important}.ar-brief p,.ar-brief li{font-size:13px}.ar-brief li{margin:6px 0}.ar-brief ul{padding-left:18px}.ar-brief h3{margin-bottom:10px}.ar-brief-more{margin-top:10px;padding-top:8px;border-top:1px solid var(--ar-line)}
.ar-network{margin-top:4px}.ar-network>summary{width:fit-content;margin-left:auto;font-size:12px;padding:3px 0}
.ar-network-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin:8px 0 12px}.ar-network-body>div{min-width:0}.ar-network-body h3:not(:first-child){margin-top:16px}.ar-network-body .ar-card-heading h3{margin-top:0}
.ar-network-body .ar-actions{justify-content:flex-start;flex-wrap:wrap;margin:10px 0;font-size:12px}
/* The shared form keeps its text; Radar exposes its safety explanation through the heading tooltip. */
.ar-network-body .ns-settings>small{display:none}
.ar-proxy-result,.ar-diagnostics{font-size:12px;margin:10px 0}.ar-proxy-result p{margin:6px 0}.ar-proxy-result details{margin-top:6px}
.ar-import{display:flex;align-items:center;flex-wrap:wrap;gap:6px;max-width:100%;font-size:12px;color:var(--ar-muted)}.ar-import input{max-width:100%;width:220px;font-size:11px}
.ar-directory-form{margin-top:8px;font-size:12px}.ar-root .ar-quiet{padding-left:0;color:var(--ar-muted)}
.ar-footer{font-size:10px;color:var(--ar-muted);padding-top:12px;margin-top:18px;border-top:1px solid var(--ar-line)}
@media(hover:hover){.ar-root a:hover{color:var(--ar-accent);text-decoration:underline}.ar-category-bar:hover .ar-bar-track i{opacity:1}.ar-metric:hover{border-color:var(--ar-accent)}}
@container(max-width:1000px){.ar-shell{padding:20px}.ar-overview-grid{grid-template-columns:1fr}.ar-overview-side{grid-template-columns:1fr 1fr}.ar-category-chart{gap:4px 20px}.ar-metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ar-metric{padding:12px}.ar-retired{grid-template-columns:1fr 1fr}.ar-number{font-size:28px}}
@container(max-width:600px){.ar-shell{padding:16px 12px}.ar-header h1{font-size:20px}.ar-overline{font-size:9px;letter-spacing:1px}.ar-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.ar-metric{min-height:96px}.ar-metrics .ar-featured{grid-column:1/-1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center}.ar-metrics .ar-featured .ar-number{grid-column:2;grid-row:1/3}.ar-metrics .ar-featured .ar-metric-note{grid-column:1}.ar-overview-side,.ar-two-col,.ar-network-body,.ar-issue-board,.ar-brief{grid-template-columns:minmax(0,1fr)}.ar-category-chart{column-gap:12px}.ar-section{padding:13px}.ar-security-overview{gap:14px}.ar-retired{grid-template-columns:repeat(4,minmax(0,1fr))}.ar-issue-group[open]>.ar-item{display:block;width:100%;margin-right:0}.ar-advisory-body dl{grid-template-columns:1fr;gap:5px}.ar-advisory-body dd+dt{margin-top:6px}.ar-projectbar{gap:8px}.ar-projectbar form{flex-basis:100%}.ar-directory-form>span:has(input){width:100%}.ar-section-heading .ar-actions{flex-wrap:wrap}.ar-item-meta time{margin-left:0}.ar-watch-toolbar>[role=tablist]{max-width:100%}.ar-root .ar-watch-toolbar [role=tab]{min-width:0;padding-inline:10px}.ar-last{flex-basis:100%;margin-left:13px}}
@container(max-width:400px){.ar-category-chart{grid-template-columns:1fr}.ar-retired{grid-template-columns:1fr 1fr}.ar-header>.ar-badge{display:none}}
@media(pointer:coarse){.ar-root input,.ar-root .ns-settings input{font-size:16px}}
@media(prefers-reduced-motion:reduce){.ar-spin{animation:none}}
`;

return module.exports;
} });
