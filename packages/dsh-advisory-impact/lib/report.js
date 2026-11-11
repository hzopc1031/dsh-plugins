import path from 'node:path';
import { readLocal, writeLocal } from './local.js';
import { SOURCES } from './http.js';
import { STATE_LABELS } from './view-model.js';
export const REPORT_FILE = 'advisory-impact-report.md';
const text = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]|#])/g, '\\$1').replace(/[\r\n]+/g, ' / ');
const link = (label, url) => `[${text(label)}](${url.replace(/[\s()<>]/g, c => encodeURIComponent(c))})`;
const evidence = (item) => `${link('来源', item.url)} · 抓取：${item.fetchedTime ?? '未成功抓取'}${item.sourceTimestamp ? ' · 页面时间：' + text(item.sourceTimestamp) : ''}`;
export function renderReport(view) {
    const lines = ['# 官方公告影响核对', '', '官方页面为判定依据；OSV 仅为第二来源。报告由本地规则生成，无需模型或 API key。',
        '时间显示为 Asia/Singapore（UTC+8）。来源失败或无法匹配版本时保留未知，不代表没有漏洞。', '',
        '关注：' + text(view.settings.watch.join(' / ') || '无'),
        '运行版本：' + (view.settings.pins.map(p => text(`${p.project} ${p.version}${p.component ? ' / ' + p.component : ''}${p.maven ? ' / ' + p.maven : ''}`)).join('；') || '未填写运行版本，无法判断'), '',
        '## 来源状态', ''];
    const sources = [...view.projects.map(p => p.source), view.suppressions.source, view.guidance, view.flinkPointer];
    for (const source of sources) {
        if (!source)
            continue;
        lines.push(`- ${evidence(source)} · ${source.label}${source.error ? ' · 错误：' + text(source.error) : ''}${source.cacheError ? ' · 缓存错误：' + text(source.cacheError) : ''}`);
    }
    for (const project of view.projects) {
        lines.push('', '## ' + text(project.project), '');
        if (project.error)
            lines.push('来源不可用：' + text(project.error), '');
        for (const notice of project.notices)
            lines.push(text(notice), '');
        if (project.project === 'flink')
            lines.push('ASF Flink 列表为实验性，覆盖 2023 年以来公告，可能滞后官方 CVE 发布。', '');
        if (!project.advisories) {
            lines.push('官方清单不可用，无法判断；不能当作 0 条公告。');
            continue;
        }
        for (const a of project.advisories) {
            lines.push(`### ${text(a.id)} · ${a.label}`, '', `${evidence(a)}`, '', text(a.title), '', '判定理由：' + text(a.reason), '官方受影响版本（原文）：' + text(a.affectedText ?? '未提供可提取的范围'), '官方修复版本（原文）：' + text(a.fixedText ?? '未提供可提取的修复版本'));
            if (a.announcedAt)
                lines.push('公告时间（原文）：' + text(a.announcedAt));
            for (const p of a.pins)
                lines.push(`- 运行版本 ${text(p.pin.version)}${p.pin.component ? ' / ' + text(p.pin.component) : ''}${p.pin.maven ? ' / ' + text(p.pin.maven) : ''}：${p.label}；${text(p.reason)} · ${evidence(a)}`);
            for (const note of a.notes)
                lines.push('- 官方备注：' + text(note));
            for (const suppression of a.suppressions)
                lines.push('- 同时存在官方 suppression：' + text(suppression.notes) + '；见下方独立章节。');
            const osv = a.osv.lookup;
            lines.push('', `${osv.statusLabel} · ${evidence(osv)} · ${osv.label}${osv.error ? ' · 错误：' + text(osv.error) : ''}${osv.cacheError ? ' · 缓存错误：' + text(osv.cacheError) : ''}`, '');
        }
    }
    lines.push('', '## 扫描器报了，但官方说明不适用', '', link('ASF 依赖漏洞报告说明', SOURCES.guidance), '');
    if (!view.suppressions.source)
        lines.push('当前未关注 Kafka，未抓取官方 suppressions。未配置 Hadoop / Flink 官方 suppressions 文件。');
    else if (!view.suppressions.items)
        lines.push('官方 suppressions 来源不可用；不能当作空列表。');
    else {
        lines.push(evidence(view.suppressions.source), '');
        for (const s of view.suppressions.items)
            lines.push(`- ${text(s.id)}：${text(s.notes)} · ${evidence(s)}`);
        if (!view.suppressions.items.length)
            lines.push('本次成功获取的官方文件未列出 suppression。');
        lines.push('', '未配置 Hadoop / Flink 官方 suppressions 文件。');
    }
    lines.push('', '## 仅见 OSV，未见官方公告', '', '本节条目不构成官方受影响或不受影响判定；OSV 为第二来源。', '');
    for (const project of view.projects) {
        if (!project.osvOnly.inventoryAvailable) {
            lines.push(`- ${text(project.project)}：官方清单不可用，无法核对 OSV-only。`);
            continue;
        }
        if (!project.queries.length)
            lines.push(`- ${text(project.project)}：未填写 Maven 坐标，未查询版本命中；不能视为 OSV 无漏洞。`);
        for (const query of project.queries) {
            if (query.source)
                lines.push(`- ${text(project.project)} Maven ${text(query.query.maven)}@${text(query.query.version)} · ${evidence(query.source)} · ${query.source.label}${query.source.error ? ' · 错误：' + text(query.source.error) : ''}${query.source.cacheError ? ' · 缓存错误：' + text(query.source.cacheError) : ''}`);
        }
        for (const item of project.osvOnly.items)
            lines.push(`- ${text(project.project)} ${text(item.id)} (${text(item.aliases.join(', '))})：${text(item.summary ?? '无摘要')} · ${text(item.query.maven)}@${text(item.query.version)} · ${evidence(item)} · ${STATE_LABELS[item.state]}`);
    }
    lines.push('', '## 官方与 OSV 分歧', '', '官方判定保持不变；未比较不代表来源一致。', '');
    let disagreements = 0;
    for (const project of view.projects)
        for (const a of project.advisories ?? []) {
            if (a.osv.comparison === 'not_compared')
                continue;
            disagreements++;
            lines.push(`- ${text(project.project)} ${text(a.id)}：官方${a.label} · ${evidence(a)}；${text(a.osv.note ?? a.osv.comparison)} · OSV ${evidence(a.osv.lookup)}`);
            for (const q of a.osv.queryMatches)
                lines.push(`  - OSV 查询 ${text(q.query.maven)}@${text(q.query.version)} 命中 ${text(q.id)} · ${evidence(q)} · ${STATE_LABELS[q.state]}`);
        }
    if (!disagreements)
        lines.push('本次没有检测到可明确比较的分歧，不代表已证明一致。');
    return lines.join('\n') + '\n';
}
export async function saveReport(projectDirectory, markdown) {
    if (Buffer.byteLength(markdown) > 16 * 1024 * 1024)
        throw new Error('报告超过 16 MiB 限制');
    await writeLocal(projectDirectory, REPORT_FILE, markdown);
    return path.join(projectDirectory, REPORT_FILE);
}
export async function openReport(projectDirectory) {
    return { path: path.join(projectDirectory, REPORT_FILE), markdown: await readLocal(projectDirectory, REPORT_FILE, 16 * 1024 * 1024) };
}
