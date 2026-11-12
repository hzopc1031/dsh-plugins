import test from 'node:test'
import assert from 'node:assert/strict'
import {Github} from '../lib/github.js'
import {run} from '../lib/pipeline.js'
import {emptyState} from '../lib/types.js'
import {model} from './fixtures.mjs'

const response=(data,status=200)=>({ok:status===200,status,headers:{get:()=>null},json:async()=>data})
const wire=(n,pr=false)=>({number:n,title:'no matching source',body:'',updated_at:'2026-11-12T00:00:00Z',
  ...(pr?{pull_request:{},head:{sha:'head'}}:{})})

// Exercise the real list -> run -> enrich -> cache path without GitHub access.
for(const full of [false,true])for(const ratio of [0,0.5,1]){
  test(`request budget: ${full?'full 100':'open 20'}, PR ratio ${ratio}, then cache reuse`,async()=>{
    const limit=full?100:20,prs=limit*ratio,issues=limit-prs,state=emptyState()
    const rows={issues:Array.from({length:issues},(_,i)=>wire(i+1)),prs:Array.from({length:prs},(_,i)=>wire(issues+i+1,true))}
    let calls=[]
    const client=()=>new Github({env:{},gh:async()=>'',fetch:async raw=>{
      const u=new URL(raw);calls.push(u.pathname+u.search)
      if(u.pathname==='/repos/o/r')return response({default_branch:'main',has_issues:true,has_pull_requests:true})
      if(u.pathname.includes('/git/trees/'))return response({tree:[]})
      if(u.pathname==='/search/issues')return response({items:rows[u.searchParams.get('q').includes('is:pr')?'prs':'issues'],total_count:u.searchParams.get('q').includes('is:pr')?prs:issues})
      if(u.pathname==='/repos/o/r/pulls')return response(rows.prs)
      if(u.pathname.endsWith('/files'))return response([])
      if(u.pathname.endsWith('/status'))return response({statuses:[]})
      if(u.pathname.endsWith('/check-runs'))return response({total_count:0,check_runs:[]})
      if(/\/pulls\/\d+$/.test(u.pathname))return response({...wire(Number(u.pathname.split('/').at(-1)),true),changed_files:0})
      throw Error('Unexpected endpoint: '+u.pathname)
    }})
    for(const cached of [false,true]){
      calls=[];const source=client()
      try{
        const report=await run(source,{repo:'o/r',mode:'both'},state,{full,limit,now:1,model,modelRoute:'fixture'})
        assert.equal(calls.length,cached?3:3+(issues?2:0)+4*prs)
        assert.equal(report.reused,cached?limit:0)
        assert.equal(report.analyzed,cached?0:limit)
        assert.ok(!calls.some(path=>/comments|\/commits\?/.test(path)))
      }finally{await source.close()}
    }
  })
}

test('PR linked issue requests are bounded by body references, not three failed attempts',async()=>{
  let calls=[]
  const source=new Github({env:{},gh:async()=>'',fetch:async raw=>{
    const u=new URL(raw);calls.push(u.pathname)
    if(u.pathname.endsWith('/files'))return response([])
    if(u.pathname.endsWith('/status'))return response({statuses:[]})
    if(u.pathname.endsWith('/check-runs'))return response({check_runs:[]})
    if(u.pathname.includes('/issues/'))return response({},404)
    return response(wire(1,true))
  }})
  try{
    await source.enrich('o/r',{kind:'pr',number:1,head:'head',updated_at:wire(1).updated_at,title:'PR',body:'fix #1 fix #2 fix #3 fix #4 fix #5'})
    assert.equal(calls.filter(p=>p.includes('/issues/')).length,5)
    assert.equal(calls.length,9) // detail + file page + two CI + five failed references
  }finally{await source.close()}
})
