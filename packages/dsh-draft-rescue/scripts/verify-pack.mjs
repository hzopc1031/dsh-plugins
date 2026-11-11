import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8', shell: process.platform === 'win32',
}))
const expected = [
  'package.json', 'index.js', 'index.d.ts', 'cordis.patch.yml', 'icon.svg',
  'README.md', 'LICENSE', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md', 'locale/zh.json', 'locale/en.json',
  ...['plugin', 'client', 'core'].flatMap(name => [`lib/${name}.js`, `lib/${name}.d.ts`]),
]
assert.deepEqual(pack.files.map(file => file.path).sort(), expected.sort(), '发布文件必须精确匹配白名单')
assert.equal(pkg.version, '0.2.1')
assert.equal(pkg.license, 'MIT')
assert.equal(pkg.engines.dsh, '>=0.2.1-rc.5 <0.3.0')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(pkg.dsh.client.platform, 'web')
assert.equal(pkg.repository.directory, 'packages/' + pkg.name)
assert.match(readFileSync('cordis.patch.yml', 'utf8'), new RegExp('name: ' + pkg.name + '\\s'))
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) assert.equal(pkg.scripts[hook], undefined)
for (const entry of Object.values(pkg.exports)) {
  const target = typeof entry === 'string' ? entry : entry.default
  if (!target.includes('*')) assert.ok(existsSync(target), 'missing export: ' + target)
  if (typeof entry !== 'string') assert.ok(existsSync(entry.types), 'missing declarations')
}
for (const lang of ['zh', 'en']) {
  const locale = JSON.parse(readFileSync(`locale/${lang}.json`, 'utf8'))
  assert.ok(locale.meta.title && locale.meta.description)
}
const client = readFileSync('lib/client.js', 'utf8')
assert.ok(client.startsWith('window.__ModuleLoader__.load({id:' + JSON.stringify(pkg.name)))
assert.match(client, /return module\.exports;}}\);/)
console.log(`verify-pack ok: ${pack.files.length} files, ${pack.size} bytes; prebuilt factory, declarations, bundle and lifecycle checks passed`)
