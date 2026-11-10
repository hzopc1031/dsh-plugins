import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
const npmCli=process.env.npm_execpath
assert.ok(npmCli,'Run via npm run verify-pack')
const result=execFileSync(process.execPath,[npmCli,'pack','--dry-run','--json','--ignore-scripts'],{encoding:'utf8'})
const [pack]=JSON.parse(result)
const paths=pack.files.map(f=>f.path)
for(const file of ['package.json','index.js','cordis.patch.yml','lib/plugin.js','lib/plugin.d.ts','lib/client.js','lib/client.d.ts','lib/core.js','lib/music.js','lib/tokens.js','assets/direnjie.webp','icon.svg','locale/zh.json','locale/en.json','README.md','LICENSE','docs/feasibility.md']) assert.ok(paths.includes(file),file)
for(const file of paths) assert.ok(!/(node_modules|\.research|\.tmp|test\/|scripts\/|package-lock|\.tgz$|\.(mp3|wav|ogg|flac|m4a)$)/.test(file),file)
const pkg=JSON.parse(await readFile('package.json','utf8'))
for(const key of ['install','postinstall','prepare']) assert.equal(pkg.scripts[key],undefined)
assert.equal(pkg.dsh.bundle.patch,'./cordis.patch.yml');assert.equal(pkg.exports['./client'],'./lib/client.js')
const client=await readFile('lib/client.js','utf8');assert.ok(client.includes('window.__ModuleLoader__.load'));assert.ok(!client.includes('require("node:'))
for(const language of ['zh','en']) assert.match(JSON.parse(await readFile(`locale/${language}.json`,'utf8')).meta.title,/神探狄仁杰/)
for(const file of paths) assert.ok(!/\.svg$/.test(file)||file==='icon.svg',`stale svg art: ${file}`)
assert.ok(!client.includes('长安听雨'),'old display name in client');assert.ok(client.includes('data:image/webp;base64,'),'background art inlined')
await mkdir('.tmp',{recursive:true});await writeFile('.tmp/pack-manifest.json',result)
console.log(`PASS verify-pack: ${pack.filename}, ${paths.length} files, closed runtime, no audio or internal files`)
