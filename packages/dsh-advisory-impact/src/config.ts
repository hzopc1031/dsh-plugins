import z from '@deepseek-ai/schemastery'
import { lstat } from 'node:fs/promises'
import type { VersionPin } from './types.js'
import { isMissing, readLocal, writeLocal } from './local.js'

export const DEFAULT_WATCH = ['kafka', 'hadoop', 'flink'] as const
export const PIN_FILE = '.advisory-impact.json'
export const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000
export interface ProductPin extends VersionPin { project: string }
export interface Settings { watch: string[]; pins: ProductPin[]; cacheTtlMs: number }

export const Config = z.object({
  watch: z.array(z.string()).default([...DEFAULT_WATCH]).description('关注的项目 id：kafka / hadoop / flink；其他 id 会明确提示尚无官方来源'),
  pins: z.array(z.object({
    project: z.string().required(), version: z.string().required(),
    component: z.string(), maven: z.string(),
  })).default([]).description('用户实际运行版本；maven 可选，格式 groupId:artifactId，不含版本'),
  cacheTtlMs: z.number().min(0).step(1).default(DEFAULT_TTL_MS).description('本地来源缓存 TTL（毫秒）'),
})

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const project = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value)
const shortText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value)

export function parseSettings(value: unknown = {}): Settings {
  if (!object(value) || Object.keys(value).some(k => !['watch', 'pins', 'cacheTtlMs'].includes(k))) throw new Error('无效的关注/pin 配置字段')
  const watch = value.watch === undefined ? [...DEFAULT_WATCH] : value.watch
  const pins = value.pins === undefined ? [] : value.pins
  const cacheTtlMs = value.cacheTtlMs === undefined ? DEFAULT_TTL_MS : value.cacheTtlMs
  if (!Array.isArray(watch) || watch.length > 100 || !watch.every(project) || new Set(watch).size !== watch.length) throw new Error('watch 必须是无重复的项目 id 列表')
  if (!Array.isArray(pins) || pins.length > 200) throw new Error('pins 必须是运行版本列表')
  for (const pin of pins) {
    if (!object(pin) || Object.keys(pin).some(k => !['project', 'version', 'component', 'maven'].includes(k))
      || !project(pin.project) || !shortText(pin.version)
      || pin.component !== undefined && !shortText(pin.component)
      || pin.maven !== undefined && (!shortText(pin.maven) || !/^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(pin.maven))) throw new Error('无效的版本 pin 或 Maven 坐标')
  }
  if (typeof cacheTtlMs !== 'number' || !Number.isSafeInteger(cacheTtlMs) || cacheTtlMs < 0) throw new Error('cacheTtlMs 必须是非负整数')
  return { watch: [...watch], pins: pins.map(p => ({ ...p } as ProductPin)), cacheTtlMs }
}

/** Re-read on every evaluation so edits apply without a restart; file fields override plugin config. */
export async function loadSettings(config: unknown = {}, projectDirectory?: string): Promise<Settings> {
  const base = parseSettings(config)
  if (!projectDirectory) return base
  let text: string
  try { text = await readLocal(projectDirectory, PIN_FILE, 64 * 1024) } catch (error) {
    if (isMissing(error)) { await lstat(projectDirectory); return base }
    throw error
  }
  const file: unknown = JSON.parse(text)
  parseSettings(file)
  return parseSettings({ ...base, ...file as object })
}

export async function saveSettings(projectDirectory: string, config: unknown): Promise<void> {
  const settings = parseSettings(config)
  const text = JSON.stringify(settings, null, 2) + '\n'
  if (Buffer.byteLength(text) > 64 * 1024) throw new Error('pin 配置超过 64 KiB 限制')
  // Never overwrite a malformed existing pin file during a normal edit.
  await loadSettings({}, projectDirectory)
  await writeLocal(projectDirectory, PIN_FILE, text)
}
