import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const out = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8', shell: process.platform === 'win32',
}))
const files = out[0].files.map(f => f.path).sort()
assert.deepEqual(files, [
  'CHANGELOG.md', 'LICENSE', 'README.md', 'STATUS.md', 'cordis.patch.yml', 'icon.svg', 'index.js', 'index.d.ts',
  'lib/core.js', 'lib/core.d.ts', 'lib/plugin.js', 'lib/plugin.d.ts',
  'locale/en.json', 'locale/zh.json', 'package.json',
].sort(), 'package allowlist mismatch')
assert.equal(pkg.name, 'dsh-permission-doctor')
assert.equal(pkg.version, '0.2.0')
assert.equal(pkg.license, 'MIT')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.match(readFileSync('cordis.patch.yml', 'utf8'), /id: permission-doctor\s+name: dsh-permission-doctor/)
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) assert.equal(pkg.scripts?.[hook], undefined)
assert.equal(pkg.dependencies, undefined)
for (const value of Object.values(pkg.exports)) {
  const target = typeof value === 'string' ? value : value.default
  if (!target.includes('*')) assert.ok(existsSync(target), 'missing export ' + target)
  if (typeof value !== 'string') assert.ok(existsSync(value.types))
}
const entry = await import('../index.js')
assert.deepEqual(entry.inject, ['commands', 'tools'])
assert.equal(entry.name, 'permission-doctor')
const core = await import('../lib/core.js')
assert.equal(typeof core.diagnose, 'function')
console.log('verify-pack PASS: 15 files; bundle, prebuilt exports, types, peer dependencies and lifecycle hooks checked; ' + out[0].size + ' bytes packed')
