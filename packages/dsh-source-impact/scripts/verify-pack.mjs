import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const out = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8', shell: process.platform === 'win32',
}))
const files = out[0].files.map(f => f.path).sort()
const expected = [
  'CHANGELOG.md', 'LICENSE', 'README.md', 'cordis.patch.yml', 'icon.svg', 'index.js', 'index.d.ts',
  'lib/client.js', 'lib/client.d.ts', 'lib/core.js', 'lib/core.d.ts', 'lib/store.js', 'lib/store.d.ts', 'lib/plugin.js', 'lib/plugin.d.ts',
  'locale/en.json', 'locale/zh.json', 'package.json',
].sort()
assert.deepEqual(files, expected, 'unexpected package contents')
assert.equal(pkg.name, 'dsh-source-impact')
assert.equal(pkg.version, '0.2.1')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(pkg.dsh.client.platform, 'web')
assert.equal(pkg.exports['./client'].default, './lib/client.js')
assert.match(readFileSync('cordis.patch.yml', 'utf8'), /id: source-impact\s+name: dsh-source-impact/)
for (const hook of ['preinstall','install','postinstall','prepare','prepack','postpack']) assert.equal(pkg.scripts?.[hook], undefined, 'unexpected lifecycle script')
assert.equal(pkg.dependencies, undefined, 'host libraries must be peers')
for (const value of Object.values(pkg.exports)) {
  const target = typeof value === 'string' ? value : value.default
  if (!target.includes('*')) assert.ok(existsSync(target), 'missing export ' + target)
  if (typeof value !== 'string') assert.ok(existsSync(value.types), 'missing type export')
}
console.log('verify-pack ok: ' + files.length + ' files, ' + out[0].size + ' bytes packed; bundle, exports and install hooks checked')
