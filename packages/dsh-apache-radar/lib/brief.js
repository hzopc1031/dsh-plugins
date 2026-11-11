import { renderCountsMarkdown, singaporeTime } from './counts.js';
import { isSecurityItem } from './feeds.js';
import { link } from './fetchers.js';
import { writeLocal } from './local-files.js';
const md = (value) => value.replace(/[\\`*_[\]<>|#]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const original = (url, label = '原文') => `[${label}](${link(url).replace(/[()<>]/g, c => '%' + c.charCodeAt(0).toString(16))})`;
const kinds = { release: '发布', jira: 'JIRA 工单', proposal: '提案', 'release-notes': '版本说明' };
export function sourceLine(source) {
    const status = { ok: '成功', cached: '缓存', stale: '刷新失败，沿用上次成功缓存', failed: '失败', unavailable: '不可用' }[source.status];
    return `- ${source.project ?? '关注列表'} / ${kinds[source.kind]}：${status}；${source.url ? original(source.url, '来源') : '无已验证来源'}；抓取：${source.fetchedAt ? singaporeTime(source.fetchedAt) : '无成功抓取时间'}${source.sourceTimestamp ? `；源文件时间：${md(source.sourceTimestamp)}` : ''}${source.error ? `；错误：${md(source.error)}` : ''}${source.warnings.length ? `；${source.warnings.map(md).join('；')}` : ''}`;
}
function itemLine(item) {
    const security = isSecurityItem(item);
    return `- **${security ? '安全 / ' : ''}${kinds[item.kind]}** ${md(item.title)}；${original(item.url)}；日期：${md(item.date ?? '未知（参考项，非本周新增）')}${item.dateBasis ? `（${item.dateBasis}）` : ''}；状态：${md(item.status ?? '来源未提供')}${item.statusText ? `；源文限定：${md(item.statusText)}` : ''}${item.version ? `；版本：${md(item.version)}` : ''}${item.issueType ? `；类型：${md(item.issueType)}` : ''}${item.fixVersions?.length ? `；目标 fixVersion：${item.fixVersions.map(md).join('、')}（不代表已发布）` : ''}${item.notesUrl ? `；${original(item.notesUrl, '版本说明')}` : ''}；${original(item.sourceUrl, '采集来源')}`;
}
export function renderWeeklyBrief(counts, feeds, generatedAt = feeds.window.end) {
    const projects = feeds.watchList.map(project => {
        const items = feeds.items.filter(i => i.project === project);
        const undated = feeds.undatedItems.filter(i => i.project === project);
        return `### ${md(project)}\n\n${items.length ? items.map(itemLine).join('\n') : '已采集数据未列出窗口内条目；请结合下方来源状态，失败或部分结果不能解释为本周无更新。'}\n\n#### 日期未知参考项（不计作本周新增）\n\n${undated.length ? undated.map(itemLine).join('\n') : '已采集数据未列出日期未知条目。'}`;
    });
    return `# Apache 社区周报\n\n生成时间：${singaporeTime(generatedAt)}\n\n时区：Asia/Singapore（UTC+8）。窗口：${feeds.window.label}\n\n这些数字采用不同官方口径，不是单一官方总数。本文由已采集的标题、日期、状态与链接按规则整理，无需模型。JIRA 的 New Feature / fixVersion 和已接受提案均不证明已发布；不提供兼容性或生产升级结论。\n\n${renderCountsMarkdown(counts)}\n## 关注项目动态\n\n${projects.length ? projects.join('\n\n') : '关注列表为空。'}\n\n## 动态来源状态（失败不会记为无更新）\n\n${feeds.sources.length ? feeds.sources.map(sourceLine).join('\n') : '未请求动态来源。'}\n`;
}
export async function writeWeeklyBrief(directory, counts, feeds, generatedAt = feeds.window.end) {
    return writeLocal(directory, '.apache-radar-brief.md', renderWeeklyBrief(counts, feeds, generatedAt));
}
