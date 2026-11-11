import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
assert.ok(process.env.npm_execpath, 'Run this check via npm run verify-pack')
const [pack] = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }))
const expected = [
  'package.json', 'index.js', 'index.d.ts', 'cordis.patch.yml', 'icon.svg', 'README.md', 'CHANGELOG.md', 'STATUS.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'locale/zh.json', 'locale/en.json', 'scripts/smoke-real.mjs', 'scripts/fixture.mjs',
  ...['pe', 'core', 'process', 'plugin'].flatMap(n => [`lib/${n}.js`, `lib/${n}.d.ts`]),
]
assert.deepEqual(pack.files.map(f => f.path).sort(), expected.sort(), 'pack whitelist must match exactly')
assert.equal(pkg.name, 'dsh-dll-doctor'); assert.equal(pkg.version, '0.1.1'); assert.equal(pkg.license, 'MIT')
assert.equal(pkg.engines.dsh, '>=0.2.1-rc.5 <0.3.0'); assert.equal(pkg.engines.node, '>=22')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(pkg.repository.directory, 'packages/' + pkg.name)
assert.match(readFileSync('cordis.patch.yml', 'utf8'), /id: dll-doctor\s/)
assert.match(readFileSync('cordis.patch.yml', 'utf8'), /name: dsh-dll-doctor\s/)
assert.equal(pkg.dependencies, undefined)
for (const key of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) assert.equal(pkg.scripts[key], undefined)
for (const peer of ['@deepseek-ai/dsh-commands', '@deepseek-ai/dsh-subprocess', '@deepseek-ai/dsh-working-directory']) {
  assert.equal(pkg.peerDependencies[peer], '>=0.2.1-rc.5 <0.3.0'); assert.equal(pkg.devDependencies[peer], '0.2.1-rc.5')
}
for (const entry of Object.values(pkg.exports)) {
  const file = typeof entry === 'string' ? entry : entry.default
  if (!file.includes('*')) assert.ok(existsSync(file))
  if (typeof entry !== 'string') assert.ok(existsSync(entry.types))
}
for (const lang of ['zh', 'en']) {
  const { meta } = JSON.parse(readFileSync(`locale/${lang}.json`, 'utf8')); assert.ok(meta.title && meta.description)
}
for (const module of ['pe', 'core', 'process', 'plugin']) {
  const code = readFileSync(`lib/${module}.js`, 'utf8')
  assert.doesNotMatch(code, /node:(?:child_process|https?|net|tls)|\.tools\.register|appendPluginRecord|LoadLibrary\(/)
}
console.log(`verify-pack ok: ${pack.files.length} files, ${pack.size} bytes; prebuilt entries, declarations, exact whitelist, engines and lifecycle checks passed`)
