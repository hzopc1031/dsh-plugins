import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8', shell: process.platform === 'win32',
}))
const files = pack.files.map(file => file.path).sort()
assert.deepEqual(files, [
  'CHANGELOG.md', 'LICENSE', 'README.md', 'cordis.patch.yml', 'docs/decisions.md', 'docs/inputs.md', 'docs/reconciliation.md',
  'icon.svg', 'index.d.ts', 'index.js', 'lib/plugin.d.ts', 'lib/plugin.js', 'lib/ingest.d.ts', 'lib/ingest.js',
  'locale/en.json', 'locale/zh.json', 'package.json',
  'lib/reconcile.d.ts', 'lib/reconcile.js',
  'lib/export.d.ts', 'lib/export.js', 'docs/exports.md', 'docs/tools.md',
].sort(), 'package allowlist mismatch')
assert.equal(pkg.name, 'dsh-invoice-gate')
assert.equal(pkg.version, '0.1.0')
assert.equal(pkg.license, 'MIT')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.match(readFileSync('cordis.patch.yml', 'utf8'), /id: invoice-gate\s+name: dsh-invoice-gate\s+config: \{\}/)
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) {
  assert.equal(pkg.scripts[hook], undefined, 'unexpected lifecycle hook: ' + hook)
}
assert.deepEqual(pkg.dependencies, { exceljs: '4.4.0', 'fast-xml-parser': '5.12.0', 'pdfjs-dist': '4.10.38' })
assert.deepEqual(pkg.overrides, { exceljs: { uuid: '11.1.1' } })
const excelRequire = createRequire(import.meta.resolve('exceljs'))
assert.equal(excelRequire('uuid/package.json').version, '11.1.1')
assert.match(excelRequire('uuid').v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
for (const name of Object.keys(pkg.peerDependencies)) {
  assert.equal(pkg.peerDependenciesMeta[name].optional, true)
  assert.ok(pkg.devDependencies[name], 'missing development peer: ' + name)
}
for (const value of Object.values(pkg.exports)) {
  const target = typeof value === 'string' ? value : value.default
  if (!target.includes('*')) assert.ok(existsSync(target), 'missing export: ' + target)
  if (typeof value !== 'string') assert.ok(existsSync(value.types), 'missing declarations: ' + value.types)
}
const entry = await import('../index.js')
assert.equal(entry.name, 'invoice-gate')
assert.deepEqual(entry.inject, ['commands', 'tools'])
assert.deepEqual(entry.Config({}), {})
assert.equal(typeof entry.apply, 'function')
assert.equal(typeof entry.ingest, 'function')
assert.equal(typeof entry.reconcile, 'function')
assert.equal(typeof entry.exportPack, 'function')
assert.equal(entry.rulesVersion, 'invoice-gate/1')
console.log(`verify-pack PASS: ${files.length} files; bundle, exports, peers and lifecycle hooks checked; ${pack.size} bytes packed`)
