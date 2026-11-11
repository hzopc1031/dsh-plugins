import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId, type CommandInvocation } from '@deepseek-ai/dsh-commands'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { ingest, readOriginal, type InputFile, type IngestResult } from './ingest.js'
import { reconcile, type ReconcileOptions, type ReconciliationResult } from './reconcile.js'
import { exportPack, packDisclaimer, type ExportSummary } from './export.js'
import { writeConfined } from './write.js'

export const name = 'invoice-gate'
export const inject = ['commands', 'tools']
export const Config = z.object({})
const toolNames = ['invoice_gate_ingest', 'invoice_gate_check', 'invoice_gate_export']
type Agent = CommandInvocation['agent']
interface Run {
  id: string
  agent: Agent
  root: string
  manifest: string
  inputs: InputFile[]
  rules: ReconcileOptions
  corrections?: unknown
  extracted?: IngestResult
  checked?: ReconciliationResult
  pack?: ExportSummary
  statusFile: string
  statusIdentity?: { dev: number; ino: number }
  stopped?: boolean
  release(): void
}
class GateError extends Error {}
function fail(message: string): never { throw new GateError(message) }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
function keys(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('Unsupported request. Amount/identifier rewrite hooks and extra arguments are rejected.')
}
function path(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\0') || value.split(/[\\/]/).includes('..')) fail(`路径 ${typeof value === 'string' ? JSON.stringify(value) : '（未提供有效路径）'}：已拒绝越界或无效路径。请使用项目内、无 .. 的相对路径。Use project-relative paths without traversal.`)
}
async function readDocument(root: string, file: string): Promise<unknown> {
  let data: Buffer
  try { data = await readOriginal(root, file) }
  catch (error) {
    fail(`文件 ${JSON.stringify(file)}：${error instanceof Error && error.message === 'path-outside-project'
      ? '路径越界或符号链接不安全，已拒绝读取。请将普通文件放入所选项目。'
      : '文件不存在或无法读取。请检查相对路径、读取权限并提供普通文件。'}`)
  }
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(data) }
  catch { fail(`文件 ${JSON.stringify(file)}：不是有效 UTF-8。请另存为 UTF-8 JSON；清单和人工确认文件不使用 GB18030 回退。`) }
  try { return JSON.parse(text) }
  catch { fail(`文件 ${JSON.stringify(file)}：JSON 格式损坏或已截断。请检查语法并重新提供完整 JSON。`) }
}
const help = [
  'dsh-invoice-gate — local verification gate / 本地票据核对闸门',
  '/invoice-gate start <manifest.json> — select a confined local run; other tools are blocked until stop.',
  '/invoice-gate ingest | check | export <new-directory> | status | stop | help',
  'Tools: invoice_gate_ingest {}, invoice_gate_check {}, invoice_gate_export {"directory":"SAMPLE-pack"}.',
  'Native tools only during a run; PTC run_code is blocked. Slash commands work without a model.',
  '命令回执和项目内状态 Markdown 提供中文摘要；工具仅返回计数、ID、状态及路径。请打开状态文件与证据包。清单格式见 docs/tools.md。',
  'No OCR or tax-bureau verification (不做 OCR／税局验真).',
  'The model must never invent or change amounts, tax, totals or identifiers. No rewrite tool. 模型不得编造或改写金额、税额、合计、票号。',
  'No model calls or automatic uploads; no outbound network. 不调用模型、不自动上传、不联网。',
  'Arithmetic checks do not prove authenticity, payment or reimbursability; evidence packs do not establish accounting-archive compliance.',
  '算术核对不证明票据真实、已付款或可报销；证据包不代表符合会计档案要求。',
].join('\n')

function summary(run: Run) {
  return {
    runId: run.id, status: run.stopped ? 'stopped' : run.checked ? (run.checked.fullyConfirmed ? 'locally-confirmed' : 'draft') : run.extracted ? 'ingested' : 'started',
    statusFile: run.statusFile,
    manifest: run.manifest, project: run.root, externalVerification: 'not-checked',
    counts: {
      files: run.extracted?.files.length ?? 0, records: run.extracted?.records.length ?? 0,
      exceptions: run.extracted?.inventory.filter(item => ['failed', 'refused', 'partial'].includes(item.status)).length ?? 0,
      mismatches: run.checked?.results.filter(item => item.outcome === 'mismatch').length ?? 0,
      unchecked: run.checked?.results.filter(item => item.outcome === 'unchecked').length ?? 0,
      pendingKeyFields: run.checked?.pendingKeyFields.length ?? 0,
    },
    ...(run.pack ? { pack: run.pack } : {}),
  }
}

const markdown = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/[\\`*_[\]]/g, '\\$&').replace(/\r\n|\r|\n/g, ' ')
function readableStatus(run: Run): string {
  const info = summary(run)
  const exceptions = run.extracted?.inventory.filter(item => ['failed', 'refused', 'partial'].includes(item.status)) ?? []
  return [
    '# 票据核对运行状态 / Invoice Gate', '',
    `- 运行 ID：${run.id}`,
    `- 运行阶段：${run.stopped ? '已停止（工具限制已恢复）' : { started: '已开始，等待导入', ingested: '已导入，等待检查', draft: '已检查', 'locally-confirmed': '已检查' }[info.status]}`,
    `- 核对状态：${run.checked?.fullyConfirmed ? '本地字段核对完成（locally-confirmed）；外部核验未执行' : '草稿（draft）：本地核对未完成'}`,
    `- 文件数：${info.counts.files}；记录数：${info.counts.records}；异常清单项数：${info.counts.exceptions}（含文件及页／行，非去重文件数）`,
    `- 差异数：${info.counts.mismatches}；无法检查规则数：${info.counts.unchecked}；待核关键字段数：${info.counts.pendingKeyFields}`,
    `- 项目目录：${markdown(run.root)}`,
    `- 输入清单：${markdown(run.manifest)}`,
    `- 状态文件（项目相对路径）：${run.statusFile}`, '',
    '外部核验：未执行（not-checked）；不做 OCR／税局验真。', '',
    '## 导入异常', '',
    ...(exceptions.length ? exceptions.map(item => `- ${markdown(item.message ?? '请查看证据包导入清单。')} [${item.fileId} / ${item.unit} / ${item.status} / ${item.reason}]`) : ['当前无已记录的导入异常；未导入或未检查不代表通过。']), '',
    '## 证据包路径（相对于项目目录）', '',
    ...(run.pack ? [
      `- 导出目录：${markdown(run.pack.directory)}`,
      `- Markdown 报告：${markdown(run.pack.files.markdown)}`,
      `- XLSX 报告：${markdown(run.pack.files.xlsx)}`,
      `- JSON 报告：${markdown(run.pack.files.json)}`,
    ] : ['尚未导出当前快照的证据包。']), '',
    '仅使用命令的 DSH 会话可能不显示结果卡片。请在所选项目中打开此状态文件及证据包查看结果；本文件不含金额表或原文。', '',
    packDisclaimer, '',
  ].join('\n')
}

async function writeStatus(run: Run): Promise<string> {
  const text = readableStatus(run)
  try {
    run.statusIdentity = await writeConfined(run.root, run.statusFile, [['status.md', Buffer.from(text)]], true, run.statusIdentity)
  } catch (error) {
    if (error instanceof Error && error.message === 'status-file-replaced') fail('状态文件已被替换、删除或变为符号链接；为保护文件已拒绝覆盖，请停止后重新开始。')
    if (error instanceof Error && error.message === 'path-outside-project') fail('状态文件目录已改变，请恢复所选项目目录后重试。')
    throw error
  }
  return text
}

export function apply(ctx: Context): void {
  let run: Run | undefined, stopped: Run | undefined, busy = false
  const lifecycle = new AbortController()
  const directory = (agent: Agent): string => {
    const service = ctx.get('workingDirectory') as { get(session: Agent['session']): string } | undefined
    const cwd = service ? service.get(agent.session) : agent.session.header.cwd
    if (!cwd || !isAbsolute(cwd)) fail('Select a local project directory first.')
    return cwd!
  }
  const current = (agent: Agent | undefined): Run => {
    if (!run || run.agent !== agent) fail('Start a run in this session with /invoice-gate start <manifest.json>.')
    return run!
  }
  const errorText = (error: unknown, signal: AbortSignal) => signal.aborted || lifecycle.signal.aborted
    ? 'Command cancelled / 命令已取消。'
    : error instanceof GateError ? error.message : '本地操作失败。请检查项目内路径、文件权限、清单及人工确认文件格式；未记录财务明细。Local operation failed.'
  ctx.effect(() => () => { lifecycle.abort(); run?.release(); run = undefined; stopped = undefined })

  async function perform(verb: string, args: unknown, agent: Agent | undefined, signal: AbortSignal, command = false): Promise<string> {
    const control = AbortSignal.any([signal, lifecycle.signal])
    try {
      control.throwIfAborted()
      if (busy) fail('A local operation is still running; wait before retrying or stopping.')
      busy = true
      try {
        keys(args, verb === 'export' ? ['directory', 'includeOriginals'] : [])
        const active = current(agent)
        if (await realpath(directory(active.agent)) !== active.root) fail('Project directory changed. Stop and start a new confined run.')
        control.throwIfAborted()
        if (verb === 'ingest') {
          const extracted = await ingest(active.root, active.inputs)
          control.throwIfAborted()
          active.extracted = extracted; active.checked = undefined; active.pack = undefined
        } else if (verb === 'check') {
          if (!active.extracted) fail('Run ingest before check.')
          active.checked = reconcile(active.extracted!, active.rules, active.corrections)
          active.pack = undefined
        } else if (verb === 'export') {
          if (!active.checked) fail('Run check before export. Draft export is allowed.')
          path(args.directory)
          if (args.includeOriginals !== undefined && typeof args.includeOriginals !== 'boolean') fail('includeOriginals must be a boolean.')
          active.pack = await exportPack(active.root, args.directory, active.checked!, { includeOriginals: args.includeOriginals as boolean | undefined })
          control.throwIfAborted()
        } else fail('Unsupported action. Amount/identifier rewrite is not available.')
        const text = await writeStatus(active)
        return command ? text : JSON.stringify(summary(active))
      } finally { busy = false }
    } catch (error) { throw new GateError(errorText(error, control)) }
  }

  for (const verb of ['ingest', 'check', 'export']) {
    ctx.effect(() => ctx.tools.register(defineTool({
      name: `invoice_gate_${verb}`,
      description: `${verb} the human-selected local invoice-gate run. Counts/status/paths only; no amounts or original text. Start with /invoice-gate start. No rewrite hooks.`,
      parameters: verb === 'export' ? {
        directory: { type: 'string', required: true, description: 'New project-relative pack directory; parent must exist.' },
        includeOriginals: { type: 'boolean', description: 'Copy hash-checked originals locally; default false.' },
      } : {},
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
      execute: (args, exec) => perform(verb, args, exec.agent, exec.signal),
    })))
  }
  ctx.effect(() => ctx.tools.guard(exec => {
    if (!exec.name.startsWith('invoice_gate_')) return
    if (!toolNames.includes(exec.name)) return 'Amount/identifier rewrite and unknown invoice-gate hooks are rejected.'
    if (!run || exec.agent !== run.agent) return 'Start a confined run with /invoice-gate start first.'
    try { keys(exec.arguments, exec.name === 'invoice_gate_export' ? ['directory', 'includeOriginals'] : []); if (exec.name === 'invoice_gate_export') path(exec.arguments.directory) }
    catch { return 'Unsafe path or unsupported arguments. Amount/identifier rewrite hooks are rejected.' }
    return undefined
  }))

  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-invoice-gate'), name: 'invoice-gate',
    description: 'Local invoice gate: start, ingest, check, export, status, stop / 本地票据核对',
    input: { hint: 'help | start <manifest.json> | ingest | check | export <new-directory> | status | stop' },
    recordInput: false,
    handler: async ({ agent, rawInput, signal }) => {
      const control = AbortSignal.any([signal, lifecycle.signal])
      try {
        control.throwIfAborted()
        const [, verb = 'help', arg = ''] = /^(\S+)?(?:\s+([\s\S]*))?$/.exec(rawInput.trim()) ?? []
        if (verb === 'help' && !arg) return { kind: 'success', text: help }
        if (['start', 'stop', 'status'].includes(verb)) {
          if (busy) fail('A local operation is still running; wait before retrying or stopping.')
          busy = true
          try {
            if (verb === 'status' && !arg) {
              const active = run ? current(agent) : stopped?.agent === agent ? stopped : undefined
              return { kind: 'success', text: active ? await writeStatus(active) : '票据核对已停止；尚无本会话的运行状态文件。请使用 /invoice-gate start <manifest.json> 开始。' }
            }
            if (verb === 'stop' && !arg) {
              const active = run ? current(agent) : stopped?.agent === agent ? stopped : undefined
              if (!active) return { kind: 'success', text: '票据核对已停止；尚无本会话的运行状态文件。' }
              active.stopped = true
              try { return { kind: 'success', text: await writeStatus(active) } }
              finally { if (run) { run.release(); run = undefined }; stopped = active }
            }
            if (verb !== 'start') fail('Use /invoice-gate stop without arguments.')
            if (run) fail('Only one run is allowed. Stop the current run first.')
            path(arg)
            const root = await realpath(directory(agent))
            const manifest = await readDocument(root, arg)
            keys(manifest, ['schemaVersion', 'inputs', 'rules', 'corrections'])
            if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.inputs) || !manifest.inputs.length) fail('Manifest requires schemaVersion 1 and a nonempty inputs array.')
            for (const input of manifest.inputs) {
              keys(input, ['path', 'kind', 'mapping', 'sheet', 'ocrJson'])
              path(input.path)
              if (!['ticket', 'ledger'].includes(input.kind as string)) fail('Input kind must be ticket or ledger.')
              if (input.ocrJson !== undefined) path(input.ocrJson)
              if (input.sheet !== undefined && typeof input.sheet !== 'string') fail('Input sheet must be a string.')
            }
            const rules = (manifest.rules === undefined ? {} : manifest.rules) as ReconcileOptions
            reconcile({ files: [], inventory: [], records: [] }, rules)
            let corrections: unknown
            if (manifest.corrections !== undefined) {
              path(manifest.corrections)
              corrections = await readDocument(root, manifest.corrections)
            }
            control.throwIfAborted()
            const restore = agent.ctx.tools.restrict({ allow: toolNames })
            let unguard: (() => void) | undefined
            let unwatch: () => void
            try {
              // Scoped registrations bypass restrict; guard closes that execution path too.
              unguard = agent.ctx.tools.guard(exec => toolNames.includes(exec.name) && exec.agent === agent ? undefined : 'Confined invoice-gate run: other tools are blocked. Use /invoice-gate stop to restore them.')
              unwatch = agent.ctx.effect(() => () => { if (run?.agent === agent) run = undefined })
            } catch (error) { unguard?.(); restore(); throw error }
            const id = randomUUID()
            run = { id, agent, root, manifest: arg, statusFile: `invoice-gate-${id}-status.md`, inputs: manifest.inputs as unknown as InputFile[], rules, corrections, release: () => { unguard?.(); restore(); unwatch() } }
            try {
              const text = await writeStatus(run)
              stopped = undefined
              return { kind: 'success', text }
            } catch (error) { run.release(); run = undefined; throw error }
          } finally { busy = false }
        }
        if ((['ingest', 'check'].includes(verb) && !arg) || (verb === 'export' && arg)) {
          return { kind: 'success', text: await perform(verb, verb === 'export' ? { directory: arg } : {}, agent, control, true) }
        }
        fail('Unsupported action. Amount/identifier rewrite hooks are rejected. Use /invoice-gate help.')
      } catch (error) { return { kind: 'error', text: errorText(error, control) } }
    },
  }))
}
