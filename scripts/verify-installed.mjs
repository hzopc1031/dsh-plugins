// Read metadata and boot the tarball installed by the real CLI, without model/network services.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const [host, profile] = process.argv.slice(2).map(p => path.resolve(p))
const entry = name => pathToFileURL(path.join(host, '@deepseek-ai', name, 'lib/index.js')).href
const { loadProfileDirectory, boot, readPluginMeta } = await import(entry('dsh-app-boot'))
const anchor = path.join(host, '@deepseek-ai/dsh/package.json')
const loaded = loadProfileDirectory('task-review-clean', profile, anchor)
assert.deepEqual(loaded.skippedBundles, [])
const patches = loaded.layers.filter(l => l.name === 'dsh-task-review' || JSON.stringify(l.patches).includes('dsh-task-review')).flatMap(l => l.patches)
assert.ok(patches.length)
const config = path.join(profile, 'verify-services.yml')
await writeFile(config, ['dsh-session','dsh-system-prompt','dsh-tools','dsh-commands'].map(n => `- name: ${JSON.stringify(entry(n))}`).join('\n'))
const ctx = await boot('task-review-clean', config, patches, undefined, pathToFileURL(path.join(profile,'package.json')).href)
try {
  const meta = readPluginMeta('dsh-task-review', pathToFileURL(path.join(profile,'package.json')).href)
  console.log(JSON.stringify(meta, null, 2))
  assert.ok(JSON.stringify(meta).includes('任务复盘'))
  assert.ok(JSON.stringify(meta).includes('汇总工具调用'))
  assert.ok(meta.icon)
  assert.equal(meta.error, undefined)
  const { SessionId } = await import(entry('dsh-session'))
  const session = ctx.sessions.create(SessionId('clean-verify'), {meta:{cwd:profile}})
  const result = await ctx.commands.execute({id:session.id,session,ctx,status:'idle'},'/review',[],new AbortController().signal)
  assert.equal(result.result.kind,'success')
  console.log('PASS: installed tarball Loader, bilingual metadata/icon, /review')
} finally { await ctx.fiber.dispose() }
