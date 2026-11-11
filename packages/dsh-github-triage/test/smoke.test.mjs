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

test('smoke documents business and deterministic mock model options',()=>{const result=cli(['--help']);assert.match(result.stdout,/--business/);assert.match(result.stdout,/--business-file/);assert.match(result.stdout,/--mock-model/)})
test('smoke business arguments accept quoted shell strings and paths offline',()=>{const result=cli(['--business','核心 登录业务','--business-file','C:\\my docs\\business.md','--mock-model','--schedule-only']);assert.equal(result.status,0);assert.match(result.stdout,/调度演示 #2/)})
test('smoke refuses mock and explicit adapter together',()=>{const result=cli(['--mock-model','--model-adapter','adapter.mjs','--schedule-only']);assert.equal(result.status,1)})
test('deterministic smoke mock exercises the actual model-first pipeline with clear labels',async()=>{const {default:mock}=await import('../scripts/mock-model.mjs');const {run,render}=await import('../lib/pipeline.js');const {emptyState}=await import('../lib/types.js');const {issue,pr,repo,source}=await import('./fixtures.mjs');const state=emptyState(),opts={limit:6,now:1,model:mock,modelRoute:'smoke/mock-model'};const first=await run(source([issue(),pr({number:2})]),{...repo,business:'框架插件隔离与生命周期'},state,opts);assert.ok(first.results.every(r=>r.source==='model'));assert.match(render(first),/模拟模型/);assert.match(render(first),/结合业务：/);const second=await run(source([issue(),pr({number:2})]),{...repo,business:'框架插件隔离与生命周期'},state,opts);assert.equal(second.reused,2);assert.equal(second.briefing,undefined)})
