import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const script=fileURLToPath(new URL('../scripts/smoke-real.mjs',import.meta.url))
const cli=args=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:10000,windowsHide:true})
test('smoke help documents the default and total limit without network access',()=>{
  const result=cli(['--help'])
  assert.equal(result.status,0);assert.match(result.stdout,/cordiverse\/cordis/);assert.match(result.stdout,/合计候选上限/)
})
test('smoke accepts a repository and limit for the offline scheduling demonstration',()=>{
  const result=cli(['deepseek-ai/deepseek-harness','--limit','5','--schedule-only'])
  assert.equal(result.status,0);assert.match(result.stdout,/调度演示 #2/);assert.ok(!result.stdout.includes('真实 smoke：'))
})
for(const args of [['bad-repo'],['o/r','extra'],['--limit','0'],['--limit','101'],['--limit','2.5'],['--unknown']]){
  test('smoke rejects invalid CLI arguments '+args.join(' '),()=>{
    const result=cli([...args,'--schedule-only'])
    assert.equal(result.status,1);assert.match(result.stderr,/参数无效/);assert.match(result.stderr,/用法/)
  })
}
