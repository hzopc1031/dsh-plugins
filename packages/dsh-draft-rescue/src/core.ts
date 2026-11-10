import type { InputState, TokenSpan } from '@deepseek-ai/dsh-client-ui-conversation/client'

export const SUPPORTED_VERSION = '0.2.1-rc.5'
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

/** Exact boot release identity, never inferred from the draft's shape. */
export function requireVersion(boot: unknown): void {
  const version = object(boot) && object(boot.release) ? boot.release.version : undefined
  if (version !== SUPPORTED_VERSION) throw new Error('仅支持 DSH 0.2.1-rc.5；版本不符或无法识别，已拒绝读取草稿。')
}

/** Validate rc.5 semantic spans, but recover only their plain text projection. */
export function draftText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!object(value) || typeof value.text !== 'string' || !Array.isArray(value.references)) return undefined
  const text = value.text
  let end = 0
  if (value.command !== undefined) {
    if (!object(value.command) || typeof value.command.token !== 'string') return undefined
    const spelling = value.command.token.trimEnd()
    if (!/^\/\S/u.test(spelling) || !text.startsWith(spelling)) return undefined
    end = spelling.length
  }
  for (const ref of value.references) {
    if (!object(ref) || typeof ref.source !== 'string' || typeof ref.ref !== 'string'
      || typeof ref.label !== 'string' || typeof ref.clipboardText !== 'string'
      || typeof ref.offset !== 'number' || !Number.isInteger(ref.offset) || ref.offset < end
      || typeof ref.length !== 'number' || !Number.isInteger(ref.length) || ref.length <= 0
      || ref.length !== ref.clipboardText.length
      || (ref.appearance !== undefined && !['session', 'file', 'folder'].includes(String(ref.appearance)))
      || (ref.invalid !== undefined && typeof ref.invalid !== 'boolean')) return undefined
    end = ref.offset + ref.length
    if (end > text.length || text.slice(ref.offset, end) !== ref.clipboardText) return undefined
  }
  return text
}

/** Enumerate storage independently of session-list visibility; never writes or deletes. */
export function listDrafts(storage: StorageReader, boot: unknown): Draft[] {
  requireVersion(boot) // Must precede every storage access, including length.
  const result: Draft[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key?.startsWith(STORAGE_PREFIX) || key.length === STORAGE_PREFIX.length) continue
    const raw = storage.getItem(key) // Storage permission errors are surfaced, not silently swallowed.
    if (raw === null) continue
    let value: unknown
    try { value = JSON.parse(raw) } catch { continue }
    if (!object(value)) continue
    const text = draftText(value.draft)
    if (text?.trim()) result.push({ sessionId: key.slice(STORAGE_PREFIX.length), text })
  }
  return result.sort((a, b) => a.sessionId.localeCompare(b.sessionId))
}

export function copyText(draft: Draft): string { return draft.text }

/** Append in detect coordinates (a reference chip counts as ONE character). */
export function prepareAppend(draft: Draft, input: Pick<InputState, 'draft' | 'draftRev' | 'occurrences' | 'phase'>): { text: string; span: TokenSpan } {
  if (input.phase !== 'plain') throw new Error('当前输入框忙碌或处于命令模式，请回到普通输入后追加。')
  const end = input.draft.length - input.occurrences.reduce((sum, ref) => sum + ref.length - 1, 0)
  if (end < 0) throw new Error('输入框状态无效，请重试。')
  return {
    text: (input.draft ? '\n' : '') + copyText(draft),
    span: { start: end, end, draftRev: input.draftRev },
  }
}
