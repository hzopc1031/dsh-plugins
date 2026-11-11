import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const pkg = JSON.parse(await readFile('package.json', 'utf8'))
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) assert.equal(pkg.scripts[hook], undefined)
assert.notEqual(pkg.private, true)
assert.deepEqual(pkg.dependencies, { parse5: '7.3.0' })
for (const peer of Object.keys(pkg.peerDependencies)) {
  assert.equal(pkg.peerDependenciesMeta[peer].optional, true)
  assert.ok(pkg.devDependencies[peer])
}
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(await readFile('index.js', 'utf8'), "export * from './lib/plugin.js'\n")
for (const lang of ['en', 'zh']) {
  const locale = JSON.parse(await readFile(`locale/${lang}.json`, 'utf8'))
  assert.ok(locale.meta.title && locale.meta.description)
}
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8', shell: process.platform === 'win32',
}))
const expected = ['package.json', 'index.js', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json',
  'icon.svg', 'README.md', 'LICENSE', 'CHANGELOG.md', 'docs/decisions.md',
  ...['plugin', 'http', 'fetchers', 'counts', 'watch', 'feeds', 'feed-cache', 'local-files', 'brief', 'radar'].flatMap(name => [`lib/${name}.js`, `lib/${name}.d.ts`])]
assert.deepEqual(pack.files.map(f => f.path).sort(), expected.sort())
console.log(`PASS: ${pack.filename}, ${pack.entryCount} files, prebuilt lib, no lifecycle hooks or internal fixtures`)
