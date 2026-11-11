import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const cwd=fileURLToPath(new URL('../',import.meta.url))
const [pack]=JSON.parse(execFileSync('npm',['pack','--dry-run','--json','--ignore-scripts'],{cwd,encoding:'utf8',shell:process.platform==='win32'}))
const read=async p=>(await readFile(new URL('../'+p,import.meta.url),'utf8')).replace(/^\uFEFF/,'')
const modules=['client','ui-contract','ui-service','local','rule-files','business','config','github','model','pipeline','plugin','rules','safety','schedule','state','types']
const expected=['package.json','index.js','cordis.patch.yml','locale/en.json','locale/zh.json','icon.svg','README.md','LICENSE','CHANGELOG.md','THIRD_PARTY_NOTICES',...modules.flatMap(n=>['lib/'+n+'.js','lib/'+n+'.d.ts'])]
assert.deepEqual(pack.files.map(f=>f.path).sort(),expected.sort())
const pkg=JSON.parse(await read('package.json'))
assert.equal(pkg.name,'dsh-github-triage');assert.equal(pkg.version,'0.3.1');assert.equal(pkg.engines.dsh,'0.2.1-rc.5')
assert.equal(pkg.repository.directory,'packages/dsh-github-triage');assert.equal(pkg.homepage,'https://github.com/hzopc1031/dsh-plugins/tree/main/packages/dsh-github-triage#readme')
const lock=JSON.parse(await read('package-lock.json'));assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);assert.equal(lock.name,pkg.name);assert.equal(lock.packages[''].name,pkg.name)
assert.equal(pkg.main,'index.js');assert.equal(pkg.exports['.'].default,'./index.js');assert.equal(pkg.exports['.'].types,'./lib/plugin.d.ts')
for(const name of ['prepare','preinstall','install','postinstall'])assert.equal(pkg.scripts[name],undefined)
assert.notEqual(pkg.private,true)
assert.equal(pkg.dsh.client.platform,'web')
assert.deepEqual(pkg.dsh.client.inject,['@deepseek-ai/dsh-client-ui-conversation','@deepseek-ai/dsh-client-ui-session','@deepseek-ai/dsh-api-remotes'])
assert.equal(pkg.exports['./client'].default,'./lib/client.js')
const client=await read('lib/client.js')
assert.match(client,/window\.__ModuleLoader__\.load/)
assert.match(client,/factory:\(require\)=>/)
assert.match(client,/conversation.session.header.actions/)
assert.match(client,/require\(["']@deepseek-ai\/dsh-client-ui-primitives["']\)/)
assert.ok(!/node:|require\(["'](?:fs|child_process)["']\)/.test(client))
for(const dependency of ['react','react-dom','jsdom','esbuild','@deepseek-ai/dsh-client-ui-primitives']){
  assert.ok(pkg.devDependencies[dependency]);assert.equal(pkg.dependencies[dependency],undefined)
}
assert.deepEqual(Object.keys(pkg.dependencies).sort(),['undici','zod'])
assert.deepEqual((await readdir(new URL('../lib/',import.meta.url))).sort(),modules.flatMap(n=>[n+'.js',n+'.d.ts']).sort())
for(const lang of ['zh','en']){const l=JSON.parse(await read('locale/'+lang+'.json'));assert.match(l.meta.title,/GitHub/);assert.ok(l.meta.description)}
assert.match(await read('cordis.patch.yml'),/name: dsh-github-triage/)
assert.match(await read('index.js'),/export \* from '.\/lib\/plugin.js'/)
console.log('PASS: '+pack.filename+', '+pack.entryCount+' files; prebuilt exports, bundle, locale, exact allowlist; no install scripts')

