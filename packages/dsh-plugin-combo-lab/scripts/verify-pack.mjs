import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const output = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: new URL('..', import.meta.url), encoding: 'utf8', shell: process.platform === 'win32'
}))
const files = output[0].files.map(f => f.path).sort()
const expected = ['CHANGELOG.md', 'LICENSE', 'README.md', 'cordis.patch.yml', 'icon.svg', 'index.js',
  'lib/core.js', 'lib/core.d.ts', 'lib/store.js', 'lib/store.d.ts', 'lib/plugin.js', 'lib/plugin.d.ts',
  'locale/en.json', 'locale/zh.json', 'package.json'].sort()
assert.deepEqual(files, expected, '打包清单必须精确匹配（无源码、测试、凭据、缓存或 node_modules）')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack']) assert.equal(pkg.scripts?.[hook], undefined)
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(pkg.version, '0.1.0')
assert.equal(pkg.repository.directory, 'packages/' + pkg.name)
console.log('verify-pack ok: ' + files.length + ' files, ' + output[0].size + ' bytes packed; no install/build hooks')