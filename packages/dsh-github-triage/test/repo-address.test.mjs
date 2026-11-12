import test from 'node:test'
import assert from 'node:assert/strict'
import {repoName,repoSchema,emptyState} from '../lib/types.js'
import {repoCommand,repositories,runArguments} from '../lib/config.js'
import {settings,Config} from '../lib/plugin.js'
import {requestSchema,fieldErrors} from '../lib/ui-contract.js'
import {routeHandler} from '../lib/ui-routes.js'
import {correct} from '../lib/pipeline.js'
import {good} from './fixtures.mjs'

const accepted=[
  'Owner/Repo',' Owner/Repo ','\tOwner/Repo\n','Owner/Repo.git','Owner/Repo/',
  'https://github.com/Owner/Repo','http://github.com/Owner/Repo','https://www.github.com/Owner/Repo',
  'https://github.com/Owner/Repo.git','https://github.com/Owner/Repo.git/',
  'https://github.com/Owner/Repo/','https://github.com/Owner/Repo/issues','https://github.com/Owner/Repo/issues/123',
  'https://github.com/Owner/Repo/pulls','https://github.com/Owner/Repo/pull/123',
  'https://github.com/Owner/Repo/tree/release/feature/src/main.ts',
  'https://github.com/Owner/Repo.git/tree/a/b?tab=readme#anchor',
  'https://github.com/Owner/Repo?tab=readme','https://github.com/Owner/Repo#readme',
  'https://github.com/Owner/Repo?x=/a/b#fragment','https://github.com/Owner/Repo/?tab=readme#readme',
  'github.com/Owner/Repo','github.com/Owner/Repo.git/','github.com/Owner/Repo/tree/a?x=y#readme',
  'www.github.com/Owner/Repo','git@github.com:Owner/Repo','git@github.com:Owner/Repo.git',
  '  git@github.com:Owner/Repo.git  ',' HTTPS://WWW.GITHUB.COM/Owner/Repo.GIT/ ',
  'https://github.com/Owner/Repo.git.git',
]
for(const address of accepted)test('repository address normalizes '+JSON.stringify(address),()=>{
  assert.equal(repoName.parse(address),'owner/repo')
  assert.equal(repoName.parse(repoName.parse(address)),'owner/repo')
  assert.equal(repoSchema.parse({repo:address}).repo,'owner/repo')
  assert.equal(requestSchema.parse({action:'add',value:{repo:address}}).value.repo,'owner/repo')
})
const rejected=[
  '',' ','owner','owner/','/repo','owner//repo','owner/repo/extra',
  'https://github.com','https://github.com/','https://github.com/owner','https://github.com/owner/',
  'https://github.com//repo','github.com/owner/','git@github.com:owner',
  'https://gitlab.com/owner/repo','https://gist.github.com/owner/repo','https://api.github.com/owner/repo',
  'https://github.com.evil.test/owner/repo','https://evilgithub.com/owner/repo',
  'https://github.com@evil.test/owner/repo','https://github.com:443/owner/repo','https://github.com./owner/repo',
  'https://user:fixture-secret@github.com/owner/repo','https://user@github.com/owner/repo',
  'https://:fixture-secret@github.com/owner/repo','github.com@evil.test/owner/repo',
  'git@www.github.com:owner/repo','ssh://git@github.com/owner/repo','ftp://github.com/owner/repo',
  '//github.com/owner/repo','https:\\github.com\\owner\\repo',
  'https://github.com/owner%2Fother/repo','https://github.com/owner/repo%20name',
  'https://github.com/owner/../repo','https://github.com/owner/./repo',
  'owner/.','owner/..','owner/.git','owner/../','-owner/repo','ow_ner/repo',
  'owner/re po','owner/répo','owner/repo!','owner/repo@','owner/repo?x=y','owner/repo#hash',
  'https://github.com/ow\nner/repo','https://github.com/owner/repo\\issues',
  'https://github.com/owner/repo/issues\u0000','https://github.com/owner/repo?x=\u007f',
  'a'.repeat(40)+'/repo','owner/'+'r'.repeat(101),null,3,{},
]
for(const address of rejected)test('repository address rejects '+JSON.stringify(address),()=>{
  assert.equal(repoName.safeParse(address).success,false)
})
test('repository character and length boundaries retain valid punctuation',()=>{
  const value='a'.repeat(39)+'/'+'r'.repeat(97)+'_.-'
  assert.equal(repoName.parse(value),value)
  assert.equal(repoName.parse('https://github.com/Owner-1/.repo_name-2'),'owner-1/.repo_name-2')
})
test('configuration loading, commands and manual scans share canonical repository names',()=>{
  const address='https://www.github.com/Owner/Repo.git/tree/main?tab=readme#intro'
  const config=settings(Config({repositories:[{repo:address}]}))
  assert.equal(config.repositories[0].repo,'owner/repo')
  assert.equal(repositories([{repo:address}],emptyState())[0].repo,'owner/repo')
  const state=emptyState()
  repoCommand('add '+address+' --limit 4',state)
  assert.deepEqual(Object.keys(state.overrides),['owner/repo'])
  assert.equal(state.overrides['owner/repo'].repo,'owner/repo')
  repoCommand('business git@github.com:Owner/Repo.git "new direction"',state)
  assert.equal(state.overrides['owner/repo'].business,'new direction')
  assert.equal(runArguments(address+' --limit 3').repo,'owner/repo')
  repoCommand('remove github.com/Owner/Repo/issues',state)
  assert.deepEqual(state.removed,['owner/repo'])
  assert.deepEqual(state.overrides,{})
})
test('POST add and existing-repository actions delegate normalized values only',async()=>{
  for(const action of ['add','patch','remove','start','detail','rules','export','import','fix']){
    const body={action,repo:accepted[6],patch:{limit:4},scan:{},number:1,path:'rules.md',text:'rules',recommendation:'adopt',reason:'reason'}
    const keys={add:['action'],patch:['action','repo','patch'],remove:['action','repo'],start:['action','repo','scan'],detail:['action','repo','number'],rules:['action','repo'],export:['action','repo','path'],import:['action','repo','text'],fix:['action','repo','number','recommendation','reason']}[action]
    const input=Object.fromEntries(keys.map(k=>[k,body[k]]))
    if(action==='add')input.value={repo:accepted[6]}
    const parsed=requestSchema.parse(input)
    assert.equal(action==='add'?parsed.value.repo:parsed.repo,'owner/repo')
  }
  let called=0
  const response=await routeHandler('repos',async r=>{called++;assert.equal(r.value.repo,'owner/repo');return {ok:true,data:r.value}})(new Request('https://dsh.invalid',{method:'POST',body:JSON.stringify({action:'add',value:{repo:accepted[6]}})}))
  assert.equal((await response.json()).value.repo,'owner/repo');assert.equal(called,1)
})
test('credential rejection never echoes credentials in schema messages or route errors',async()=>{
  const address='https://fixture-user:fixture-secret@github.com/owner/repo'
  const parsed=repoName.safeParse(address);assert.equal(parsed.success,false)
  const messages=JSON.stringify({message:parsed.error.message,fields:fieldErrors(parsed.error)})
  assert.ok(!messages.includes('fixture-user')&&!messages.includes('fixture-secret'))
  assert.throws(()=>repoCommand('add '+address,emptyState()),error=>!error.message.includes('fixture-secret'))
  const response=await routeHandler('repos',async()=>{throw Error('must not delegate')})(new Request('https://dsh.invalid',{method:'POST',body:JSON.stringify({action:'add',value:{repo:address}})}))
  const reply=await response.text()
  assert.ok(reply.includes('validation'));assert.ok(!reply.includes('fixture-user')&&!reply.includes('fixture-secret'))
})

test('correction command normalizes the repository before looking up the cached item',()=>{
  const state=emptyState()
  state.cache['o/r#1']={result:{title:'title',judgment:structuredClone(good)}}
  assert.equal(correct(state,'https://github.com/O/R.git#1 manual-review reason',1),'已保存纠正：o/r#1')
  assert.equal(state.corrections[0].repo,'o/r')
  assert.equal(state.cache['o/r#1'].result.judgment.recommendation,'manual-review')
})
