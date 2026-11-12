import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8', shell: process.platform === 'win32' }))
const expected = [
  'package.json', 'index.js', 'index.d.ts', 'cordis.patch.yml', 'icon.svg',
  'LICENSE', 'README.md', 'CHANGELOG.md', 'locale/en.json', 'locale/zh.json',
  'docs/decisions.md', 'docs/dsh-api.md',
  ...['overview-light', 'overview-dark', 'suppressions-dark'].map(name => `docs/images/${name}.png`),
  ...['intranet-http', 'plugin', 'types', 'http', 'fetchers', 'verdicts', 'local', 'config', 'cache', 'osv', 'evaluate', 'view-model', 'report', 'surface', 'tools', 'panel-host', 'panel-model', 'client'].flatMap(name => [`lib/${name}.js`, `lib/${name}.d.ts`]),
].sort()
assert.deepEqual(pack.files.map(file => file.path).sort(), expected, 'Unexpected or missing package files')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) {
  assert.ok(!pkg.scripts?.[hook], `Lifecycle hook forbidden: ${hook}`)
}
assert.equal(pkg.name, 'dsh-advisory-impact')
assert.equal(pkg.version, '0.1.2')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(pkg.main, 'index.js')
assert.equal(pkg.exports['./client'], './lib/client.js')
assert.equal(pkg.dsh.client.platform, 'web')
assert.match(readFileSync('lib/client.js', 'utf8'), /window\.__ModuleLoader__\.load/)
assert.equal(pkg.exports['.'].default, './index.js')
assert.match(readFileSync('cordis.patch.yml', 'utf8'), /id: advisory-impact, name: dsh-advisory-impact/)
for (const peer of Object.keys(pkg.peerDependencies)) {
  assert.ok(pkg.devDependencies[peer], `Missing development peer: ${peer}`)
  assert.equal(pkg.peerDependenciesMeta[peer].optional, true)
}
for (const locale of ['en', 'zh']) {
  const { meta } = JSON.parse(readFileSync(`locale/${locale}.json`, 'utf8'))
  assert.ok(meta.title && meta.description)
}
console.log(`verify-pack ok: ${expected.length} files; no install/pack lifecycle hooks`)
