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
  'dist/client.js',
  ...['plugin', 'model', 'service', 'store', 'validation', 'drafts', 'exports', 'directory-io', 'tools', 'typert.host', 'typert.remote-client']
    .flatMap(name => [`lib/${name}.js`, `lib/${name}.d.ts`]),
  'locale/en.json', 'locale/zh.json', 'package.json',
].sort()
assert.deepEqual(files, expected, 'unexpected package contents')
assert.equal(pkg.name, 'dsh-content-evidence')
assert.equal(pkg.version, '0.1.0')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.deepEqual(pkg.dsh.client, { platform: 'web', inject: ['@deepseek-ai/dsh-client-runtime'] })
assert.equal(pkg.exports['./client'], './dist/client.js')
assert.match(readFileSync('dist/client.js', 'utf8'), /window\.__ModuleLoader__\.load\(\{id:"dsh-content-evidence"/)
assert.match(readFileSync('cordis.patch.yml', 'utf8'), /id: content-evidence\s+name: dsh-content-evidence/)
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) {
  assert.equal(pkg.scripts?.[hook], undefined, 'unexpected lifecycle script')
}
assert.equal(pkg.dependencies, undefined, 'host libraries must be peers')
const nativePackages = ['linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64'].map(host => '@koromix/koffi-' + host)
assert.deepEqual(pkg.optionalDependencies, Object.fromEntries(nativePackages.map(name => [name, '3.3.7'])))
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
for (const name of nativePackages) {
  const entry = lock.packages['node_modules/' + name]
  assert.equal(entry.version, '3.3.7')
  assert.equal(entry.hasInstallScript, undefined, 'native helper must have no install hook')
  assert.equal(entry.dependencies, undefined, 'native helper must have no transitive dependencies')
}

for (const name of ['@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-scope', '@deepseek-ai/dsh-system-prompt', '@deepseek-ai/dsh-typert-protocol', '@deepseek-ai/dsh-api-gateway', '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-layout', '@deepseek-ai/dsh-client-ui-sidebar', 'react', 'zod']) {
  assert.ok(pkg.peerDependencies[name] && pkg.devDependencies[name], 'missing build/runtime peer ' + name)
  assert.equal(pkg.peerDependenciesMeta[name].optional, true)
}
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
