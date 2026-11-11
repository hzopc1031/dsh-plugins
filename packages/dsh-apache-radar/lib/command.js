import { renderCountsMarkdown, singaporeTime } from './counts.js';
import { itemLine, sourceLine } from './brief.js';
import { message } from './messages.js';
export function renderCommandResult(action, serialized) {
    if (action === 'security') {
        const report = JSON.parse(serialized);
        return ['## 版本与安全', ...report.projects.map(p => `### ${p.project} · ${p.pin ?? '未填写运行版本'}\n\n${p.error ?? ''}\n\n${p.advisories.map(a => `- [${a.id}](${a.url}) · ${({ affected: '受影响', not_affected: '不受影响', unknown: '无法判断' })[a.verdict]}：${a.reason}；官方范围 ${a.affectedText}；官方修复 ${a.fixedText ?? '未明确'}；抓取 ${singaporeTime(a.fetchedAt)}${a.sourceTimestamp ? `；源时间 ${a.sourceTimestamp}` : ''}`).join('\n')}${p.hasMore ? '\n更多公告见项目页或使用工具 query 过滤。' : ''}\n${p.source?.error ?? ''}`), report.note].join('\n\n');
    }
    const data = JSON.parse(serialized);
    const watch = () => data.watchList.length ? message('command.watchList', { projects: data.watchList.join(' / ') }) : message('command.emptyWatch');
    const sources = () => `${message('command.sources')}\n\n${data.sources.length ? data.sources.map(sourceLine).join('\n') : message('command.noSources')}`;
    if (action === 'open')
        return data.markdown;
    if (action === 'watch')
        return `${message('command.watchTitle')}\n\n${watch()}\n\n${message('command.watchPath', { path: data.path })}`;
    if (action === 'counts')
        return renderCountsMarkdown(JSON.parse(serialized));
    if (action === 'lookup')
        return [
            message('command.lookupTitle'), message('command.collectedAt', { time: singaporeTime(data.collectedAt) }),
            message('command.window', { window: data.window.label }),
            data.items.length ? data.items.map(item => `### ${item.project}\n\n${itemLine(item)}`).join('\n\n') : message('command.noMatches'),
            ...(data.hasMore ? [message('command.more')] : []), data.note, sources(),
        ].join('\n\n');
    return [
        message(action === 'brief' ? 'command.briefSaved' : 'command.refreshed'),
        message('command.generatedAt', { time: singaporeTime(data.generatedAt) }), watch(),
        message('command.window', { window: data.window.label }),
        ...(action === 'brief' ? [message('command.briefPath', { path: data.path }), message('command.openHint')] : []),
        data.note, renderCountsMarkdown(data.counts), sources(),
    ].join('\n\n');
}
