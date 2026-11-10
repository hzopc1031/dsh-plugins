import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const out = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8', shell: process.platform === 'win32',
}))
const files = out[0].files.map(f => f.path).sort()
const expected = [
  'CHANGELOG.md', 'LICENSE', 'README.md', 'cordis.patch.yml', 'icon.svg', 'index.js',
  'lib/plugin.js', 'lib/plugin.d.ts', 'locale/en.json', 'locale/zh.json', 'package.json',
].sort()
assert.deepEqual(files, expected, 'unexpected package contents')
assert.equal(pkg.name, 'dsh-content-evidence')
assert.equal(pkg.version, '0.1.0')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.match(readFileSync('cordis.patch.yml', 'utf8'), /id: content-evidence\s+name: dsh-content-evidence/)
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) {
  assert.equal(pkg.scripts?.[hook], undefined, 'unexpected lifecycle script')
}
assert.equal(pkg.dependencies, undefined, 'host libraries must be peers')
for (const value of Object.values(pkg.exports)) {
  const target = typeof value === 'string' ? value : value.default
  if (!target.includes('*')) assert.ok(existsSync(target), 'missing export ' + target)
  if (typeof value !== 'string') assert.ok(existsSync(value.types), 'missing type export')
}
for (const locale of ['en', 'zh']) {
  const { meta } = JSON.parse(readFileSync(`locale/${locale}.json`, 'utf8'))
  assert.ok(meta.title && meta.description, 'missing locale metadata')
}
console.log('verify-pack ok: ' + files.length + ' files; bundle, exports, locales and install hooks checked')
