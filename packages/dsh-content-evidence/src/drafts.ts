import type { Claim, ComplianceFinding, Draft, DraftBody, DraftInput, Platform, Topic } from './model.js'
import { hash, id, invalid, record, text } from './validation.js'

export function evidenceHash(topic: Topic): string {
  return hash(JSON.stringify([topic.sources, topic.materials, topic.experiments, topic.claims]))
}
export function stringList(value: unknown, field: string, max = 100): string[] {
  if (!Array.isArray(value) || value.length > max) invalid(field)
  return value.map(item => text(item, field))
}
export function parseBody(value: unknown, target: Platform): DraftBody {
  const body = record(value)
  let keys: string[]
  switch (body.kind) {
    case 'x-single':
      if (target !== 'x') invalid('body.kind')
      text(body.post, 'post'); keys = ['kind', 'post']; break
    case 'x-thread':
      if (target !== 'x' || !stringList(body.posts, 'posts').length) invalid('posts')
      keys = ['kind', 'posts']; break
    case 'xiaohongshu':
      if (target !== 'xiaohongshu') invalid('body.kind')
      text(body.title, 'title', 2000); text(body.body, 'body')
      if (!stringList(body.cards, 'cards').length) invalid('cards')
      keys = ['kind', 'title', 'body', 'cards']; break
    case 'douyin': case 'weixin-video':
      if (target !== body.kind) invalid('body.kind')
      text(body.voiceover, 'voiceover')
      if (!stringList(body.shots, 'shots').length) invalid('shots')
      keys = ['kind', 'voiceover', 'shots']; break
    default: return invalid('body.kind')
  }
  if (Object.keys(body).some(key => !keys.includes(key))) invalid('body')
  return Object.fromEntries(keys.map(key => [key, structuredClone(body[key])])) as DraftBody
}
export function parseDraftInput(value: unknown, target: Platform): DraftInput {
  const input = record(value)
  if (Object.keys(input).some(key => !['body', 'claimIds', 'expectedRevision', 'evidenceHash'].includes(key))) invalid('draft input')
  const body = parseBody(input.body, target)
  const claimIds = stringList(input.claimIds, 'claimIds')
  claimIds.forEach(id)
  if (new Set(claimIds).size !== claimIds.length) invalid('claimIds')
  revision(input.expectedRevision)
  digest(input.evidenceHash)
  text(JSON.stringify(body), 'body size', 200_000)
  return { body, claimIds, expectedRevision: input.expectedRevision as number, evidenceHash: input.evidenceHash as string }
}
export function revision(value: unknown): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid('expectedRevision')
}
export function digest(value: unknown): void {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) invalid('hash')
}
export function bodyFields(body: DraftBody): [string, string][] {
  switch (body.kind) {
    case 'x-single': return [['post', body.post]]
    case 'x-thread': return body.posts.map((post, i) => [`posts[${i}]`, post])
    case 'xiaohongshu': return [['title', body.title], ['body', body.body], ...body.cards.map((card, i): [string, string] => [`cards[${i}]`, card])]
    default: return [['voiceover', body.voiceover], ...body.shots.map((shot, i): [string, string] => [`shots[${i}]`, shot])]
  }
}
export function selectedClaims(topic: Topic, claimIds: string[]): Claim[] {
  return claimIds.map(claimId => topic.claims.find(claim => claim.id === claimId) ?? invalid('claimIds'))
}
function sourceUrl(topic: Topic, claim: Claim): string | undefined {
  const sourceId = topic.materials.find(material => material.id === claim.sourceId)?.sourceId ?? claim.sourceId
  return topic.sources.find(source => source.id === sourceId)?.url
}
export function renderDraft(body: DraftBody, topic: Topic, claimIds: string[]): string {
  const copy = bodyFields(body).map(([location, value]) => `${location}:\n${value}`).join('\n\n')
  const citations = selectedClaims(topic, claimIds).map(claim => `${claim.text} — ${claim.status}${sourceUrl(topic, claim) ? ` ${sourceUrl(topic, claim)}` : claim.sourceId ? ` ${claim.sourceId}` : ''}`)
  return `${copy}\n\n证据：\n${citations.length ? citations.join('\n') : '待核实（未关联证据）'}`
}
export function draftHash(draft: Pick<Draft, 'content' | 'body' | 'claimIds' | 'evidenceHash'>): string {
  return draft.body === undefined ? hash(draft.content) : hash(JSON.stringify([draft.body, draft.claimIds, draft.evidenceHash, draft.content]))
}
const urlPattern = /https?:\/\/[^\s<>"'）)\]，。]+/giu
function urls(value: string): string[] { return value.match(urlPattern) ?? [] }
// shortcut: digit tokens only; require human unit/semantic review until a stronger fact verifier is added.
function numbers(value: string): string[] {
  return value.replace(urlPattern, '').match(/[+-]?\d+(?:[.,]\d+)*(?:%|％)?/g) ?? []
}
export function validateFacts(body: DraftBody, topic: Topic, claimIds: string[]): void {
  const claims = selectedClaims(topic, claimIds)
  const allowedNumbers = new Set(claims.flatMap(claim => numbers(claim.text)))
  const allowedUrls = new Set(claims.flatMap(claim => sourceUrl(topic, claim) ? [sourceUrl(topic, claim)!] : []))
  for (const [, value] of bodyFields(body)) {
    if (numbers(value).some(number => !allowedNumbers.has(number))) invalid('number absent from selected claims')
    if (urls(value).some(url => !allowedUrls.has(url))) invalid('URL absent from selected sources')
  }
}

// shortcut: small editorial heuristics, not semantic fact verification; add human review for paraphrases and coverage.
const patterns = [
  { code: 'sensitive', pattern: /(?:翻墙|代开发票|刷单|买粉)/giu, fix: '删除该词；如属必要实验描述，改写并由人工确认语境。' },
  { code: 'absolute', pattern: /(?:百分之百|100[%％]|绝对|保证|包赚|稳赚|零风险|全网第一|永远|最佳|最强)|\b(?:guarantee(?:d)?|always|never|risk[ -]?free|best)\b/giu, fix: '删除绝对承诺，改为有来源、有限定条件的描述。' },
] as const
export function rulesHash(extraTerms: readonly string[]): string {
  return hash(JSON.stringify(['editorial-rules-v1', extraTerms]))
}
export function checkCompliance(topic: Topic, draft: Draft, extraTerms: readonly string[]): ComplianceFinding[] {
  const findings: ComplianceFinding[] = []
  const add = (code: ComplianceFinding['code'], location: string, excerpt: string, fix: string) => findings.push({ code, location, excerpt, fix })
  const fields = draft.body ? bodyFields(draft.body) : [['content', draft.content]] as [string, string][]
  if (!draft.body) add('legacy-shape', 'body', '', '将旧版纯文本保存为对应平台结构，再复核。')
  if (!fields.some(([, value]) => /(?:AI\s*生成|人工智能生成|AI[ -]generated)/iu.test(value))) {
    add('ai-label', 'body', '', '添加清楚的“AI 生成”提示，并在发布时确认平台的 AI 标识要求。')
  }
  for (const [location, value] of fields) {
    for (const { code, pattern, fix } of patterns) {
      for (const match of value.matchAll(pattern)) add(code, `${location}@${match.index}`, match[0], fix)
    }
    for (const term of extraTerms) {
      const literal = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
      for (const match of value.matchAll(literal)) {
        add('sensitive', `${location}@${match.index}`, match[0], '删除或改写用户配置的提示词，并人工确认语境。')
      }
    }
  }
  if (draft.evidenceHash !== evidenceHash(topic)) add('evidence-changed', 'evidenceHash', '', '重新读取共享证据表，确认后保存草稿并复核。')
  if (!draft.claimIds?.length) add('citation', 'claimIds', '待核实', '为事实关联共享证据表中的条目和真实来源。')
  for (const claim of selectedClaims(topic, draft.claimIds ?? [])) {
    if (!claim.sourceId) add('citation', `claims[${claim.id}]`, `${claim.text.slice(0, 200)}（待核实）`, '补充实际来源；缺乏来源时删除该事实或保留待核实状态。')
  }
  return findings
}
