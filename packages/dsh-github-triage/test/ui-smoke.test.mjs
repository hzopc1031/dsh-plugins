/** Isolated script contract tests; the fake CLI never boots or installs DSH. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp,writeFile,rm,access,readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const exec=promisify(execFile),script=fileURLToPath(new URL('../scripts/ui-smoke.mjs',import.meta.url))
async function invoke(args){
  try{const result=await exec(process.execPath,[script,...args],{windowsHide:true,timeout:20000});return {...result,code:0}}
  catch(e){return {stdout:e.stdout,stderr:e.stderr,code:e.code}}
}
test('UI smoke documents OS TEMP, local CLI install, isolated Edge and exit codes',async()=>{
  const r=await invoke(['--help']);assert.equal(r.code,0)
  for(const text of ['TEMP','--offline','--ignore-scripts','dsh.cmd','desktop profile','0 通过','3 清理失败'])assert.ok(r.stdout.includes(text),text)
})
test('UI smoke rejects invalid arguments and missing CLI with prerequisite exit code',async()=>{
  assert.equal((await invoke(['--unknown','x'])).code,2)
  assert.equal((await invoke(['--dsh',path.join(tmpdir(),'nonexistent-ui-smoke-cli.cmd'),'--browser',process.execPath])).code,2)
})
test('UI smoke confines local install to TEMP, scrubs diagnostics and cleans home on failure',async()=>{
  const fixture=await mkdtemp(path.join(tmpdir(),'triage-smoke-fixture-'))
  let artifact
  try{
    const fake=path.join(fixture,'cli.mjs')
    await writeFile(fake,`import assert from 'node:assert/strict';import path from 'node:path';import {tmpdir} from 'node:os';import {writeFileSync} from 'node:fs';
const args=process.argv.slice(2);if(args[0]==='--version'){console.log('0.2.1-rc.5');process.exit(0)}
assert.deepEqual(args.slice(0,4),['plugin','--profile','web','add']);
assert.ok(args.includes('--offline')&&args.includes('--ignore-scripts'));assert.equal(process.env.npm_config_ignore_scripts,'true');
assert.equal(process.env.GH_TOKEN,undefined);assert.equal(process.env.DSH_PROFILE,undefined);
assert.ok(path.relative(tmpdir(),process.env.DSH_HOME).startsWith('dsh-github-triage-ui-home-'));
writeFileSync(${JSON.stringify(path.join(fixture,'home.txt'))},process.env.DSH_HOME);
console.error('https://127.0.0.1/?token=fixture-private#fixture-hash');process.exit(7);`)
    // Fake CLI is ours; no third-party program besides Node runs in this test.
    const r=await invoke(['--dsh',fake,'--browser',process.execPath]);assert.equal(r.code,1)
    const home=await readFile(path.join(fixture,'home.txt'),'utf8')
    await assert.rejects(access(path.dirname(home)))
    artifact=r.stdout.match(/(\S:[^\r\n]*dsh-github-triage-ui-artifacts-[^\r\n]*)/)?.[1]
    assert.ok(artifact,r.stdout)
    const log=await readFile(path.join(artifact,'install-local.log'),'utf8')
    assert.ok(!log.includes('fixture-private')&&!log.includes('fixture-hash'))
  }finally{
    for(const dir of [artifact,fixture].filter(Boolean)){
      const rel=path.relative(tmpdir(),dir);assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel))
      await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100})
    }
  }
})
