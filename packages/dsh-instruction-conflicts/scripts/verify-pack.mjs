import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
const read = file => readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
const pkg = JSON.parse(read('package.json'))
const out = JSON.parse(execFileSync('npm', ['pack','--dry-run','--json','--ignore-scripts'], { encoding:'utf8', shell:process.platform==='win32' }))
const files = out[0].files.map(f=>f.path).sort()
const expected = ['CHANGELOG.md','LICENSE','README.md','STATUS.md','cordis.patch.yml','icon.svg','index.js','index.d.ts',
  'lib/adapter.js','lib/adapter.d.ts','lib/core.js','lib/core.d.ts','lib/inventory.js','lib/inventory.d.ts','lib/plugin.js','lib/plugin.d.ts',
  'locale/en.json','locale/zh.json','package.json'].sort()
assert.deepEqual(files,expected,'unexpected package contents')
assert.equal(pkg.name,'dsh-instruction-conflicts');assert.equal(pkg.version,'0.2.1')
assert.equal(pkg.engines.dsh,'>=0.2.1-rc.5 <0.3.0-0')
assert.equal(pkg.dsh.bundle.patch,'./cordis.patch.yml')
assert.match(read('cordis.patch.yml'),/id: instruction-conflicts\s+name: dsh-instruction-conflicts/)
for (const hook of ['preinstall','install','postinstall','prepare','prepack','postpack']) assert.equal(pkg.scripts?.[hook],undefined)
assert.equal(pkg.dependencies,undefined,'host libraries must be peers')
for(const [name,version] of Object.entries(pkg.peerDependencies)) {
  assert.ok(pkg.peerDependenciesMeta[name].optional)
  const baseline = name === '@deepseek-ai/cordis' ? '~4.0.5' : name === '@deepseek-ai/schemastery' ? '~3.18.5' : name.startsWith('@deepseek-ai/dsh-') ? '0.2.1-rc.5' : version
  assert.equal(pkg.devDependencies[name], baseline)
}
for(const value of Object.values(pkg.exports)) {
  const target=typeof value==='string'?value:value.default
  if(!target.includes('*')) assert.ok(existsSync(target),'missing export '+target)
  if(typeof value!=='string') assert.ok(existsSync(value.types),'missing types')
}
for(const locale of ['en','zh']) assert.ok(JSON.parse(read('locale/'+locale+'.json')).meta.title)
assert.match(read('LICENSE'),/MIT License/)
assert.match(read('README.md'),/resources\\runtime\\cli\\bin\\dsh\.cmd/)
assert.match(read('STATUS.md'),/未测/)
console.log(`verify-pack ok: ${files.length} files, ${out[0].size} bytes; exact whitelist, bundle, exports, locales, peers, hooks and documentation checked`)
