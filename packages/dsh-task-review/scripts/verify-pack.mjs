import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8', shell: process.platform === 'win32' }))
const expected = ['package.json','index.js','cordis.patch.yml','locale/en.json','locale/zh.json','icon.svg','README.md','LICENSE','CHANGELOG.md',...['bash','core','plugin','state'].flatMap(n=>[`lib/${n}.js`,`lib/${n}.d.ts`])]
assert.deepEqual(pack.files.map(f=>f.path).sort(),expected.sort())
const pkg=JSON.parse(await readFile('package.json','utf8'))
for(const script of ['prepare','install','postinstall']) assert.equal(pkg.scripts[script],undefined)
assert.notEqual(pkg.private,true)
assert.equal(pkg.dependencies,undefined)
for(const lang of ['en','zh']) {
  const locale=JSON.parse(await readFile(`locale/${lang}.json`,'utf8'))
  assert.ok(locale.meta.title && locale.meta.description)
}
console.log(`PASS: ${pack.filename}, ${pack.entryCount} files, prebuilt lib, no internal files/install scripts, valid locale JSON`)
