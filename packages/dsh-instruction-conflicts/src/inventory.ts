import path from 'node:path'
import type { FileSystem, FsInfo } from '@deepseek-ai/dsh-fs'
import { resolveDshHome, resolveAgentsHome, dshHomeDisplay, agentsHomeDisplay } from '@deepseek-ai/dsh-home-paths'
import { categoryOf, instructionKey, type FileFact, type ObservedMessage, type Presence } from './core.js'
export interface Inventory { files: FileFact[]; notices: string[] }
const candidates = ['AGENTS.md', 'CLAUDE.md', 'AGENTS.local.md', 'CLAUDE.local.md']
const forbidden = (s: string): boolean => s.replace(/\\/g, '/').split('/').some(p => ['_private','_tools'].includes(p.toLowerCase()))
function missing(e: unknown): boolean { return !!e && typeof e === 'object' && 'code' in e && ['FS_NOT_FOUND','ENOENT','ENOTDIR'].includes(String(e.code)) }
/** Metadata only. No file contents, recursive scan, config writes or local-fs fallback. */
export async function inventory(fs: FileSystem | undefined, cwd: string | undefined, messages: readonly ObservedMessage[], signal: AbortSignal): Promise<Inventory> {
  const files = new Map<string, FileFact>(), notices: string[] = []
  const stat = async (p: string): Promise<{ state: Presence; info?: FsInfo }> => {
    signal.throwIfAborted()
    if (!fs || forbidden(p)) return { state: 'unknown' }
    try {
      const target = await fs.resolve(p, { signal })
      if (forbidden(target.displayPath)) return { state: 'unknown' }
      const info = await fs.stat(target, signal)
      signal.throwIfAborted()
      return { state: info ? 'yes' : 'no', info }
    } catch (e) { signal.throwIfAborted(); return { state: missing(e) ? 'no' : 'unknown' } }
  }
  const add = async (key: string, label: string, p: string | undefined, category: FileFact['category']) => {
    const result = p ? await stat(p) : { state: 'unknown' as const }
    files.set(key, { key, path: label, category, exists: result.state === 'yes' && result.info?.type !== 'file' ? 'no' : result.state,
      note: !p ? '无法可靠定位历史项目根目录，未探测该路径。' : result.state === 'unknown' ? '元数据不可用、路径受限或未挂载 fs；未知不等于不存在。' : '仅探测文件元数据；存在不证明被注入，未读取磁盘正文。' })
  }
  let root: string | undefined
  const dirs: string[] = []
  if (cwd && path.isAbsolute(cwd) && !forbidden(cwd)) {
    let dir = cwd
    for (let depth = 0; depth < 32; depth++) {
      dirs.push(dir)
      const marker = await stat(path.join(dir, '.git'))
      if (marker.state === 'yes') { root = dir; break }
      if (marker.state === 'unknown') { notices.push('项目根标记不可确认，停止向上探测；项目路径映射仅在根目录已确认时使用。'); break }
      const parent = path.dirname(dir)
      if (parent === dir) { root = dir; break }
      dir = parent
    }
    if (!root && dirs.length === 32) notices.push('祖先探测达到 32 层上限，未确认项目根。')
    // Candidate-only files are separate until a project root can establish a scope key.
    for (const dir of dirs.reverse()) for (const file of candidates) {
      const relative = root ? path.relative(root, path.join(dir, file)).split(path.sep).join('/') : path.join(dir, file)
      const scope = root ? `${path.posix.dirname(relative)}\u0000${path.posix.basename(relative)}` : `unmapped:${relative}`
      await add(instructionKey(scope), relative, path.join(dir, file), 'project')
    }
  }
  const globals = [
    { scope: 'user-global\u0000AGENTS.md', label: dshHomeDisplay(resolveDshHome()) + '/AGENTS.md', absolute: path.join(resolveDshHome(), 'AGENTS.md') },
    { scope: 'agents-global\u0000AGENTS.md', label: agentsHomeDisplay(resolveAgentsHome()) + '/AGENTS.md', absolute: path.join(resolveAgentsHome(), 'AGENTS.md') },
  ]
  for (const g of globals) await add(instructionKey(g.scope), g.label, g.absolute, 'global')
  for (const m of messages) {
    if (m.source.kind !== 'agent-instructions' || !Array.isArray(m.source.changes)) continue
    for (const c of m.source.changes) {
      if (!c || typeof c !== 'object' || !('scope' in c) || !('path' in c) || typeof c.scope !== 'string' || typeof c.path !== 'string') continue
      const category = categoryOf(m.source, c.scope, c.path)
      const g = globals.find(g => g.scope === c.scope)
      let absolute: string | undefined = g?.absolute
      // Source paths are relative to the historic project root, which can change with cwd.
      // If any working-directory changes exist the caller supplies no cwd for mapping.
      if (!g && root && !path.isAbsolute(c.path) && !/^(?:~|\$)/.test(c.path)) {
        const proposed = path.resolve(root, c.path)
        const rel = path.relative(root, proposed)
        if (!rel.startsWith('..') && !path.isAbsolute(rel) && !forbidden(proposed)) absolute = proposed
      }
      await add(instructionKey(c.scope), c.path, absolute, category)
    }
  }
  if (!fs) notices.push('fs 服务未挂载：文件存在状态为未知；注入与当前上下文证据仍可读取。')
  notices.push('候选探测采用 rc.5 默认文件名和 .git 标记，无法获知 agent-instructions 的自定义候选/根标记；不是完整磁盘清单。')
  return { files: [...files.values()], notices }
}

