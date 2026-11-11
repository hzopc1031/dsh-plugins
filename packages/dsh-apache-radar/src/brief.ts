import { renderCountsMarkdown, singaporeTime, type CountsReport } from './counts.js'
import { isSecurityItem, type FeedItem, type FeedReport, type FeedSource } from './feeds.js'
import { link } from './fetchers.js'
import { writeLocal } from './local-files.js'
import { message } from './messages.js'

const md = (value: string) => value.replace(/[\\`*_[\]<>|#]/g, '\\$&').replace(/[\r\n]+/g, ' ')
const original = (url: string, label = message('display.original')) => `[${label}](${link(url).replace(/[()<>]/g, c => '%' + c.charCodeAt(0).toString(16))})`
export function sourceLine(source: FeedSource): string {
  const status = message(`feed.status.${source.status}`)
  return `- ${source.project ?? message('display.watch')} / ${message(`feed.kind.${source.kind}`)}：${status}；${source.url ? original(source.url, message('display.source')) : message('display.noSource')}；${message('display.fetchedAt', { time: source.fetchedAt ? singaporeTime(source.fetchedAt) : message('display.noFetch') })}${source.sourceTimestamp ? message('display.sourceTime', { time: md(source.sourceTimestamp) }) : ''}${source.error ? message('display.error', { error: md(message('errors.source', { error: source.error })) }) : ''}${source.warnings.length ? `；${source.warnings.map(md).join('；')}` : ''}`
}
export function itemLine(item: FeedItem): string {
  const security = isSecurityItem(item)
  return message('display.item', { security: security ? message('display.security') : '', kind: message(`feed.kind.${item.kind}`),
    title: md(item.title), original: original(item.url), date: md(item.date ?? message('display.unknownDate')),
    basis: item.dateBasis ? `（${item.dateBasis}）` : '', status: md(item.status ?? message('display.noStatus')),
    statusText: item.statusText ? message('display.statusText', { text: md(item.statusText) }) : '',
    version: item.version ? message('display.version', { text: md(item.version) }) : '',
    issueType: item.issueType ? message('display.issueType', { text: md(item.issueType) }) : '',
    fixVersions: item.fixVersions?.length ? message('display.fixVersions', { text: item.fixVersions.map(md).join('、') }) : '',
    notes: item.notesUrl ? `；${original(item.notesUrl, message('feed.kind.release-notes'))}` : '',
    source: original(item.sourceUrl, message('display.collectedSource')),
  })
}
export function renderWeeklyBrief(counts: CountsReport, feeds: FeedReport, generatedAt = feeds.window.end): string {
  const projects = feeds.watchList.map(project => {
    const items = feeds.items.filter(i => i.project === project)
    const undated = feeds.undatedItems.filter(i => i.project === project)
    return `### ${md(project)}\n\n${items.length ? items.map(itemLine).join('\n') : message('brief.noItems')}\n\n${message('brief.undatedTitle')}\n\n${undated.length ? undated.map(itemLine).join('\n') : message('brief.noUndated')}`
  })
  return message('brief.markdown', { generatedAt: singaporeTime(generatedAt), window: feeds.window.label,
    counts: renderCountsMarkdown(counts), projects: projects.length ? projects.join('\n\n') : message('command.emptyWatch'),
    sources: feeds.sources.length ? feeds.sources.map(sourceLine).join('\n') : message('command.noSources'),
  })
}
export async function writeWeeklyBrief(directory: string, counts: CountsReport, feeds: FeedReport, generatedAt = feeds.window.end): Promise<string> {
  return writeLocal(directory, '.apache-radar-brief.md', renderWeeklyBrief(counts, feeds, generatedAt))
}
