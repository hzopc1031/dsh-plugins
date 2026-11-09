import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { defaults, eligible, redact, argumentSummary, pathsFrom, render, archive, filename, reportDirectory } from '../lib/core.js'
const base = () => ({goal:'修复测试',calls:[],changes:[],started:0,ended:1,usage:'不可用',outcome:'completed',from:0,to:10})
test('threshold OR, exact edges, auto off, unique files', () => {
  const s=base(); assert.equal(eligible(s,defaults),false)
  s.calls=Array(10).fill({}); assert.equal(eligible(s,defaults),true)
  assert.equal(eligible(s,{...defaults,auto:false}),false)
  s.calls=[]; s.changes=Array(3).fill({path:'a'}); assert.equal(eligible(s,defaults),false)
  s.changes=['a','b','c'].map(path=>({path})); assert.equal(eligible(s,defaults),true)
  s.changes=[]; s.ended=600000; assert.equal(eligible(s,defaults),true)
  s.ended--; assert.equal(eligible(s,defaults),false)
})
test('nested credentials redacted and raw code omitted before persistence', () => {
  const input={apiKey:'SECRET1',nested:{password:'SECRET2',Authorization:'Bearer SECRET3'},items:[{access_token:'SECRET4'}],command:'curl -H x:SECRET5',file_path:'a.ts'}
  const value=argumentSummary(input)
  for(let i=1;i<=5;i++) assert.equal(value.includes(`SECRET${i}`),false)
  assert.deepEqual(pathsFrom(input),['a.ts'])
  assert.equal(JSON.stringify(redact({token:{path:'secret-file'}})).includes('secret-file'),false)
  assert.equal(String(redact('Bearer SECRET6')).includes('SECRET6'),false)
})
test('report covers failures, pending, retries and never fabricates costs', () => {
  const s=base(), c={id:'1',name:'read',args:'{}',paths:['a'],started:0,duration:2,status:'failure',changes:[]}
  s.calls=[c,{...c,id:'2',status:'success'},{...c,id:'3',status:'pending',duration:null}]
  const out=render(s); for(const label of ['目标','结果','改动清单','失败与重试','不可用','需要确认','工具明细','疑似重试']) assert.ok(out.includes(label))
  assert.ok(out.includes('1 次失败')); assert.ok(out.includes('1 次未完成'))
})
test('safe unique filenames and writes stay within configured directory', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'task-review-unit-'))
  try {
    const dir=reportDirectory(root,'.dsh/reports')
    const a=await archive(dir,'../CON:<bad>|/token=secret',Date.now(),'hello')
    assert.equal(path.dirname(a),dir); assert.equal(await readFile(a,'utf8'),'hello')
    assert.equal(path.basename(a).includes('secret'),false)
    assert.notEqual(filename('x',0),filename('x',0))
    assert.throws(()=>reportDirectory(undefined,'.dsh/reports'))
    assert.equal(reportDirectory(undefined,root),root)
  } finally { await rm(root,{recursive:true,force:true}) }
})
