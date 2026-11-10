import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8', shell: process.platform === 'win32',
}))
const expected = [
  'package.json', 'index.js', 'lib/plugin.js', 'lib/plugin.d.ts',
  'lib/detect.js', 'lib/detect.d.ts', 'lib/html.js', 'lib/html.d.ts', 'lib/notes.js', 'lib/notes.d.ts',
  'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'icon.svg',
  'README.md', 'LICENSE', 'CHANGELOG.md',
]
assert.deepEqual(pack.files.map(file => file.path).sort(), expected.sort(), 'unexpected package contents')
assert.equal(pkg.name, 'dsh-html-deck-export')
assert.equal(pkg.version, '0.1.0')
assert.notEqual(pkg.private, true)
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.match(readFileSync('cordis.patch.yml', 'utf8'), /id: html-deck-export\s+name: dsh-html-deck-export\s+config: \{\}/)
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) {
  assert.equal(pkg.scripts?.[hook], undefined, `unexpected lifecycle hook: ${hook}`)
}
assert.equal(pkg.dependencies, undefined, 'scaffold needs no runtime dependencies')
for (const peer of Object.keys(pkg.peerDependencies)) {
  assert.equal(pkg.peerDependenciesMeta[peer].optional, true)
  assert.ok(pkg.devDependencies[peer], `missing development peer: ${peer}`)
}
for (const entry of Object.values(pkg.exports)) {
  for (const target of typeof entry === 'string' ? [entry] : Object.values(entry)) {
    if (!target.includes('*')) assert.ok(existsSync(target), `missing export: ${target}`)
  }
}
for (const lang of ['en', 'zh']) {
  const locale = JSON.parse(readFileSync(`locale/${lang}.json`, 'utf8'))
  assert.ok(locale.meta.title && locale.meta.description, `missing metadata: ${lang}`)
}
console.log(`PASS: ${pack.filename}, ${pack.entryCount} files; bundle, exports, locales and lifecycle hooks checked`)
