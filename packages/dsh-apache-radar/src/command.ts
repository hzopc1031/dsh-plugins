import { renderCountsMarkdown, singaporeTime, type CountsReport } from './counts.js'
import { itemLine, sourceLine } from './brief.js'
import type { FeedItem, FeedSource, FeedWindow } from './feeds.js'
import type { RadarAction } from './radar.js'
import { message } from './messages.js'

export function renderCommandResult(action: RadarAction, serialized: string): string {
  const data = JSON.parse(serialized) as {
    watchList: string[]; path: string; markdown: string; window: FeedWindow; generatedAt: string;
    collectedAt: string; counts: CountsReport; sources: FeedSource[]; items: FeedItem[]; hasMore: boolean; note: string
  }
  const watch = () => data.watchList.length ? message('command.watchList', { projects: data.watchList.join(' / ') }) : message('command.emptyWatch')
  const sources = () => `${message('command.sources')}\n\n${data.sources.length ? data.sources.map(sourceLine).join('\n') : message('command.noSources')}`
  if (action === 'open') return data.markdown
  if (action === 'watch') return `${message('command.watchTitle')}\n\n${watch()}\n\n${message('command.watchPath', { path: data.path })}`
  if (action === 'counts') return renderCountsMarkdown(JSON.parse(serialized) as CountsReport)
  if (action === 'lookup') return [
    message('command.lookupTitle'), message('command.collectedAt', { time: singaporeTime(data.collectedAt) }),
    message('command.window', { window: data.window.label }),
    data.items.length ? data.items.map(item => `### ${item.project}\n\n${itemLine(item)}`).join('\n\n') : message('command.noMatches'),
    ...(data.hasMore ? [message('command.more')] : []), data.note, sources(),
  ].join('\n\n')
  return [
    message(action === 'brief' ? 'command.briefSaved' : 'command.refreshed'),
    message('command.generatedAt', { time: singaporeTime(data.generatedAt) }), watch(),
    message('command.window', { window: data.window.label }),
    ...(action === 'brief' ? [message('command.briefPath', { path: data.path }), message('command.openHint')] : []),
    data.note, renderCountsMarkdown(data.counts), sources(),
  ].join('\n\n')
}
