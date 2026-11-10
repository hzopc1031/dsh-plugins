import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import type { RootContent, PhrasingContent } from 'mdast'
import path from 'path-browserify'
import type { AssistantMessageNode } from '@deepseek-ai/dsh-client-ui-conversation/client'

export interface FileReference {
  readonly label: string
  readonly destination: string
  readonly path: string
  readonly absolute?: string
  readonly relative?: string
  readonly line?: number
  readonly endLine?: number
}

/** rc.5 file-link grammar; keep the authored line range for clipboard output. */
export function parseLocalLink(value: string): { path: string; line?: number; endLine?: number } | undefined {
  const hash = value.indexOf('#')
  const destination = hash < 0 ? value : value.slice(0, hash)
  if (destination.includes('?')) return undefined
  let decoded: string
  try { decoded = decodeURIComponent(destination) } catch { return undefined }
  if (!decoded || /[\u0000-\u001f\u007f]/.test(decoded) || /^[\\/]{2}/.test(decoded)
    || (/^[a-z][a-z\d+.-]*:/i.test(decoded) && !/^[a-z]:[\\/]/i.test(decoded))) return undefined
  if (hash < 0) return { path: decoded }
  const match = /^L([1-9]\d*)(?:-L([1-9]\d*))?$/.exec(value.slice(hash + 1))
  if (!match) return undefined
  const line = Number(match[1]), endLine = match[2] === undefined ? undefined : Number(match[2])
  if (!Number.isSafeInteger(line) || (endLine !== undefined && (!Number.isSafeInteger(endLine) || endLine < line))) return undefined
  return { path: decoded, line, ...(endLine === undefined ? {} : { endLine }) }
}

const drive = (value: string): string | undefined => /^[a-z]:\//i.test(value) ? value.slice(0, 2).toLowerCase() : undefined
const absolute = (value: string): boolean => value.startsWith('/') || drive(value) !== undefined
const slashes = (value: string): string => value.replace(/\\/g, '/')
function normalizeHost(value: string): string {
  return drive(value) ? value.slice(0, 2) + path.normalize('/' + value.slice(3)) : path.normalize(value)
}

/** Browser-safe normalization; no filesystem reads and no guessed workspace. */
export function pathForms(file: string, cwd?: string): { absolute?: string; relative?: string } {
  const target = slashes(file)
  const root = cwd ? slashes(cwd) : undefined
  const base = root && absolute(root) && !root.startsWith('//') ? normalizeHost(root) : undefined
  const resolved = absolute(target) ? normalizeHost(target) : base ? normalizeHost(`${base}/${target}`) : undefined
  if (!resolved) return { relative: path.normalize(target) }
  if (!base || drive(base) !== drive(resolved)) return { absolute: resolved }
  // Windows drive paths compare case-insensitively while retaining target spelling.
  const from = base.split('/'), to = resolved.split('/')
  const same = (a: string, b: string): boolean => drive(base) ? a.toLowerCase() === b.toLowerCase() : a === b
  let common = 0
  while (common < from.length && common < to.length && same(from[common], to[common])) common++
  const relative = [...from.slice(common).filter(Boolean).map(() => '..'), ...to.slice(common)].join('/') || '.'
  return { absolute: resolved, relative }
}

function labelOf(node: RootContent | PhrasingContent): string {
  if ('value' in node) return node.value
  if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? ''
  if ('children' in node) return node.children.map(child => labelOf(child)).join('')
  return ''
}

/** Mature CommonMark/GFM parser handles reference links, code, escapes and nesting. */
export function extractReferences(markdown: string, cwd?: string): FileReference[] {
  const ast = fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
  const definitions = new Map<string, string>()
  function collect(node: RootContent): void {
    if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url)
    if ('children' in node) node.children.forEach(collect)
  }
  ast.children.forEach(collect)
  const result: FileReference[] = []
  const seen = new Set<string>()
  function visit(node: RootContent): void {
    const destination = node.type === 'link' ? node.url : node.type === 'linkReference' ? definitions.get(node.identifier) : undefined
    if (destination !== undefined) {
      const local = parseLocalLink(destination)
      if (local) {
        const key = JSON.stringify([local.path, local.line, local.endLine])
        if (!seen.has(key)) {
          seen.add(key)
          result.push({ label: labelOf(node) || local.path, destination, ...local, ...pathForms(local.path, cwd) })
        }
      }
    }
    if ('children' in node) node.children.forEach(visit)
  }
  ast.children.forEach(visit)
  return result
}

/** Only the requested loaded finalized message; never fetches history or streams. */
export function completedMarkdown(nodes: readonly AssistantMessageNode[], messageId: string): string | undefined {
  const node = nodes.find(node => node.messageId === messageId && !node.interrupted)
  if (!node) return undefined
  return node.blocks.filter(block => block.kind === 'text').map(block => block.text).join('\n\n')
}

export function copyPath(reference: FileReference, mode: 'absolute' | 'relative' | 'line'): string | undefined {
  if (mode === 'absolute') return reference.absolute
  if (mode === 'relative') return reference.relative
  const base = reference.absolute ?? reference.relative
  if (!base || reference.line === undefined) return undefined
  return `${base}#L${reference.line}${reference.endLine === undefined ? '' : `-L${reference.endLine}`}`
}
