// Vendored identically in apache-radar, advisory-impact and github-triage; keep these copies in sync.
import type { Context } from '@deepseek-ai/cordis'
import { isAbsolute } from 'node:path'

const keys = ['systemProxy', 'timeoutSeconds', 'httpsProxy', 'noProxy', 'caBundlePath', 'insecureSkipTlsVerify', 'insecureSkipTlsVerifyHosts']
const pick = (value: Record<string, unknown> = {}) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]))
interface Entry { fiber?: unknown; options: { config?: Record<string, unknown> } }
interface Editor { entries(): Entry[]; edit(entry: Entry, change: (current: Record<string, unknown>) => Record<string, unknown>): Promise<void> }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function networkConfigHandler(editor: Editor | undefined, fiber: unknown) {
  return async (request: Request): Promise<Response> => {
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
    try {
      const text = await request.text()
      if (text.length > 16_384) throw new Error('网络设置请求过大。')
      const body: unknown = JSON.parse(text)
      if (!object(body) || Object.keys(body).some(key => !['action', 'value', 'revision'].includes(key)) || typeof body.action !== 'string' || !['read', 'save'].includes(body.action)) throw new Error('无效的网络设置请求。')
      const entry = editor?.entries().find(entry => entry === (fiber as { entry?: unknown })?.entry)
      if (!editor || !entry) throw new Error('宿主配置编辑服务不可用。')
      if (body.action === 'save') {
        if (!object(body.value) || typeof body.revision !== 'string' || Object.keys(body.value).some(key => !keys.includes(key))) throw new Error('无效的网络设置字段。')
        for (const [key, value] of Object.entries(body.value)) {
          if (key.startsWith('insecureSkip')) { if (typeof value !== 'boolean') throw new Error('TLS 开关须为布尔值。') }
          else if (key === 'timeoutSeconds') { if (typeof value !== 'number' || !Number.isFinite(value) || value < 10 || value > 120) throw new Error('请求超时须为 10–120 秒。') }
          else if (typeof value !== 'string' || value.length > 4096) throw new Error('网络设置须为有效文本。')
          if (key === 'systemProxy' && !['auto', 'off'].includes(String(value))) throw new Error('无效的系统代理模式。')
          if (key === 'caBundlePath' && value && !isAbsolute(String(value))) throw new Error('CA 证书路径必须是绝对路径。')
          if (key === 'httpsProxy' && value) {
            let url: URL
            try { url = new URL(String(value)) } catch { throw new Error('无效的 HTTPS 代理地址。') }
            if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.pathname !== '/' || url.search || url.hash) throw new Error('代理须为 HTTP 或 HTTPS 地址。')
          }
        }
        await editor.edit(entry, current => {
          if (JSON.stringify(pick(current)) !== body.revision) throw new Error('网络设置已变化，请重新打开设置后重试。')
          return { ...current, ...body.value as Record<string, unknown> }
        })
      } else if ('value' in body || 'revision' in body) throw new Error('读取设置不接受写入字段。')
      const value = pick(entry.options.config)
      return json({ value, revision: JSON.stringify(value), writable: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      return json({ error: /[\u4e00-\u9fff]/.test(message) ? message : '网络设置保存失败，请检查宿主配置权限或覆盖配置。' }, 400)
    }
  }
}

export function registerNetworkSettings(ctx: Context, id: string): void {
  // The host settings form exposes only volatile fields; ordinary network fields use the same editor as proxy apply/clear.
  ctx.inject(['connection'], scope => {
    const connection = scope.get('connection') as { fetch: { register(route: { path: string; methods: readonly ['POST']; requestBody: 'buffered'; fetch(request: Request): Promise<Response> }): () => Promise<void> } }
    if (!connection?.fetch?.register) return
    scope.effect(() => connection.fetch.register({ path: `/api/${id}/network-settings`, methods: ['POST'], requestBody: 'buffered', fetch: request => networkConfigHandler(ctx.get?.('configEditor') as Editor | undefined, ctx.fiber)(request) }))
  })
}
