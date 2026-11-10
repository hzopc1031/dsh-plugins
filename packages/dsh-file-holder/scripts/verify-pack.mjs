import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8', shell: process.platform === 'win32',
}))
const expected = [
  'package.json', 'index.js', 'index.d.ts', 'cordis.patch.yml', 'icon.svg', 'file-holder.ps1',
  'README.md', 'CHANGELOG.md', 'STATUS.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'locale/zh.json', 'locale/en.json',
  ...['plugin', 'paths', 'query'].flatMap(name => [`lib/${name}.js`, `lib/${name}.d.ts`]),
]
assert.deepEqual(pack.files.map(file => file.path).sort(), expected.sort(), 'Package contents must exactly match the allowlist')
assert.equal(pkg.name, 'dsh-file-holder')
assert.equal(pkg.version, '0.1.0')
assert.equal(pkg.license, 'MIT')
assert.equal(pkg.engines.dsh, '0.2.1-rc.5')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(pkg.dsh.client, undefined)
assert.equal(pkg.repository.directory, 'packages/' + pkg.name)
assert.match(readFileSync('cordis.patch.yml', 'utf8'), /name: dsh-file-holder\s/)
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) assert.equal(pkg.scripts[hook], undefined)
for (const [name, version] of Object.entries(pkg.devDependencies)) {
  if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(version, '0.2.1-rc.5')
}
for (const entry of Object.values(pkg.exports)) {
  const target = typeof entry === 'string' ? entry : entry.default
  if (!target.includes('*')) assert.ok(existsSync(target), 'missing export: ' + target)
  if (typeof entry !== 'string') assert.ok(existsSync(entry.types), 'missing declarations')
}
for (const lang of ['zh', 'en']) {
  const locale = JSON.parse(readFileSync(`locale/${lang}.json`, 'utf8'))
  assert.ok(locale.meta.title && locale.meta.description)
}
const helper = readFileSync('file-holder.ps1', 'utf8')
assert.match(helper, /finally\s*{\s*Check\(RmEndSession\(session\)/)
assert.doesNotMatch(helper, /RmShutdown|RmRestart|Stop-Process|CloseHandle/)
assert.doesNotMatch(readFileSync('lib/plugin.js', 'utf8'), /ctx\.(?:tools|messages|llm)\b/)
console.log(`verify-pack ok: ${pack.files.length} files, ${pack.size} bytes; allowlist, declarations, helper and lifecycle checks passed`)
