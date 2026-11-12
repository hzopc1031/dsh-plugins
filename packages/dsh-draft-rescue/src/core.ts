import type { InputState, TokenSpan } from '@deepseek-ai/dsh-client-ui-conversation/client'

export const STORAGE_PREFIX = 'dsh.conversation.'
export interface Draft { readonly sessionId: string; readonly text: string }
export interface StorageReader {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key))
}

/** Recognize both audited semantic formats, never guess at unknown fields. */
export function draftText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!object(value) || !keys(value, ['text', 'references', 'command', 'quotes'])
    || typeof value.text !== 'string' || !Array.isArray(value.references)) return undefined
  const text = value.text
  let end = 0
  if (value.command !== undefined) {
    if (!object(value.command) || !keys(value.command, ['token']) || typeof value.command.token !== 'string') return undefined
    const spelling = value.command.token.trimEnd()
    if (!/^\/\S/u.test(spelling) || !text.startsWith(spelling)) return undefined
    end = spelling.length
  }
  for (const ref of value.references) {
    if (!object(ref) || !keys(ref, ['source', 'ref', 'label', 'clipboardText', 'offset', 'length', 'appearance', 'invalid'])
      || typeof ref.source !== 'string' || typeof ref.ref !== 'string'
      || typeof ref.label !== 'string' || typeof ref.clipboardText !== 'string'
      || typeof ref.offset !== 'number' || !Number.isInteger(ref.offset) || ref.offset < end
      || typeof ref.length !== 'number' || !Number.isInteger(ref.length) || ref.length <= 0
      || ref.length !== ref.clipboardText.length
      || (ref.appearance !== undefined && (typeof ref.appearance !== 'string' || !['session', 'file', 'folder'].includes(ref.appearance)))
      || (ref.invalid !== undefined && typeof ref.invalid !== 'boolean')) return undefined
    end = ref.offset + ref.length
    if (end > text.length || text.slice(ref.offset, end) !== ref.clipboardText) return undefined
  }
  if (value.quotes !== undefined && !Array.isArray(value.quotes)) return undefined
  const spans = [...value.references]
  for (const quote of value.quotes ?? []) {
    if (!object(quote) || !keys(quote, ['offset', 'length', 'text'])
      || typeof quote.text !== 'string' || !quote.text.trim()
      || !Number.isSafeInteger(quote.offset) || (quote.offset as number) < 0
      || !Number.isSafeInteger(quote.length) || (quote.length as number) <= 0) return undefined
    // Official rc.1 formatQuoteText: normalize CR/CRLF and prefix every line.
    const formatted = quote.text.replace(/\r\n?/gu, '\n').split('\n').map(line => `> ${line}`).join('\n')
    if (quote.length !== formatted.length || text.slice(quote.offset as number, (quote.offset as number) + formatted.length) !== formatted) return undefined
    spans.push(quote)
  }
  end = object(value.command) ? (value.command.token as string).trimEnd().length : 0
  for (const span of spans.sort((a, b) => a.offset - b.offset)) {
    if (span.offset < end) return undefined
    end = span.offset + span.length
    if (end > text.length) return undefined
  }
  return text
}

/** Validate the public input shape before scanning storage or preparing an edit. */
export function requireInput(input: unknown): asserts input is Pick<InputState, 'draft' | 'draftRev' | 'occurrences' | 'phase'> {
  if (!object(input) || typeof input.draft !== 'string' || !Number.isSafeInteger(input.draftRev)
    || (input.draftRev as number) < 0 || typeof input.phase !== 'string'
    || !['plain', 'adjudicating', 'claimed', 'submitting', 'sending'].includes(input.phase)
    || !Array.isArray(input.occurrences)
    || draftText({ text: input.draft, references: input.occurrences.map(ref => {
      if (!object(ref)) return ref
      const { occurrenceId: _id, ...semantic } = ref
      return semantic
    }) }) === undefined) throw new Error('无法识别宿主输入框结构，已拒绝读取草稿或追加。')
}

export function requireCapabilities(input: unknown, actions: unknown): void {
  requireInput(input)
  if (!object(actions) || typeof actions.insertText !== 'function') throw new Error('宿主缺少 insertText 输入接口，已拒绝读取草稿或追加。')
}

/** Enumerate storage independently of session-list visibility; never writes or deletes. */
export function listDrafts(storage: StorageReader): Draft[] {
  if (!Number.isSafeInteger(storage.length) || storage.length < 0 || typeof storage.key !== 'function' || typeof storage.getItem !== 'function') {
    throw new Error('无法识别本机草稿存储接口，已拒绝读取草稿。')
  }
  const result: Draft[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key?.startsWith(STORAGE_PREFIX) || key.length === STORAGE_PREFIX.length) continue
    const raw = storage.getItem(key) // Storage permission errors are surfaced, not silently swallowed.
    if (raw === null) continue
    let value: unknown
    try { value = JSON.parse(raw) } catch { throw new Error('草稿存储 JSON 损坏，已拒绝读取草稿；未修改原记录。') }
    if (!object(value) || !keys(value, ['draft', 'view', 'viewRequest'])
      || !(value.view === null || typeof value.view === 'string')
      || !(value.viewRequest === null || (object(value.viewRequest) && keys(value.viewRequest, ['view', 'focus'])
        && typeof value.viewRequest.view === 'string' && typeof value.viewRequest.focus === 'string'))) {
      throw new Error('无法识别草稿存储结构，已拒绝读取草稿；未修改原记录。')
    }
    const text = draftText(value.draft)
    if (text === undefined) throw new Error('无法识别草稿格式，已拒绝读取草稿；未修改原记录。')
    if (text?.trim()) result.push({ sessionId: key.slice(STORAGE_PREFIX.length), text })
  }
  return result.sort((a, b) => a.sessionId.localeCompare(b.sessionId))
}

export function copyText(draft: Draft): string { return draft.text }

/** Append in detect coordinates (a reference chip counts as ONE character). */
export function prepareAppend(draft: Draft, input: Pick<InputState, 'draft' | 'draftRev' | 'occurrences' | 'phase'>, currentSnapshot?: unknown): { text: string; span: TokenSpan } {
  requireInput(input)
  if (input.phase !== 'plain') throw new Error('当前输入框忙碌或处于命令模式，请回到普通输入后追加。')
  let quoteWidth = 0
  if (currentSnapshot !== undefined) {
    if (!object(currentSnapshot) || draftText(currentSnapshot) !== input.draft) throw new Error('当前草稿快照与输入框不一致，请复制原文后粘贴。')
    const references = currentSnapshot.references as { offset: number; length: number }[]
    if (references.length !== input.occurrences.length || references.some((ref, i) => ref.offset !== input.occurrences[i]!.offset || ref.length !== input.occurrences[i]!.length)) throw new Error('当前草稿快照与输入框不一致，请复制原文后粘贴。')
    quoteWidth = ((currentSnapshot.quotes ?? []) as { length: number }[]).reduce((sum, quote) => sum + quote.length - 1, 0)
  }
  const end = input.draft.length - quoteWidth - input.occurrences.reduce((sum, ref) => sum + ref.length - 1, 0)
  if (end < 0) throw new Error('输入框状态无效，请重试。')
  return {
    text: (input.draft ? '\n' : '') + copyText(draft),
    span: { start: end, end, draftRev: input.draftRev },
  }
}
