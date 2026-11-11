import path from 'node:path'
import { execFile } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import { validateLocal, clip, hash, FILE_SNIPPET_LIMIT } from './business.js'
import type { Repo, Item } from './types.js'

export const GIT_TIMEOUT=5000, GIT_OUTPUT=256*1024, LOCAL_TOTAL=16*1024
export class LocalError extends Error {}
const sha=/^[a-f0-9]{40,64}$/
export function refValue(ref:string):string {
  if(!ref||ref.length>256||ref.startsWith('-')||/[\x00-\x20\x7f~^:?*\[\\]/.test(ref)||ref.includes('..')||ref.includes('@{'))throw new LocalError('本地 ref 无效')
  return ref
}
const fileValue=(file:string)=>!!file&&file.length<=1024&&!/[\x00-\x1f\\]/.test(file)&&!file.startsWith('/')&&file.split('/').every(p=>p&&p!=='.'&&p!=='..')
/** Strict command AND argument shapes. No callers may pass Git global options. */
export function gitAllowed(args:readonly string[]):boolean {
  const [cmd,...a]=args
  switch(cmd){
    case 'rev-parse':return a.length===3&&a[0]==='--verify'&&a[1]==='--end-of-options'&&a[2].endsWith('^{commit}')&&(()=>{try{refValue(a[2].slice(0,-9));return true}catch{return false}})()
    case 'ls-tree':return a.length===3&&a[0]==='-rz'&&a[1]==='--name-only'&&sha.test(a[2])
    case 'cat-file':return a.length===2&&a[0]==='-s'&&blob(a[1])
    case 'show':return a.length===3&&a[0]==='--no-ext-diff'&&a[1]==='--no-textconv'&&blob(a[2])
    case 'merge-base':return a.length===3&&a[0]==='--is-ancestor'&&a.slice(1).every(s=>sha.test(s))
    case 'patch-id':return a.length===1&&a[0]==='--stable'
    case 'log':return a.length>=3&&a[0]==='-n80'&&['--format=%H%x09%s','--format=medium'].includes(a[1])&&sha.test(a[2])&&
      (a.length===3||a.length===4&&a[3]==='-p'||a.length===6&&a[3]==='--fixed-strings'&&a[4]==='--regexp-ignore-case'&&/^--grep=[^\x00-\x1f]{1,200}$/.test(a[5]))
    default:return false
  }
}
function blob(s:string):boolean { const i=s.indexOf(':');return sha.test(s.slice(0,i))&&fileValue(s.slice(i+1)) }
export interface GitOptions {signal?:AbortSignal; timeoutMs?:number; maxBytes?:number; input?:string}
/** Node's real execFile API; shell:false; no Git hooks, diff helpers or lazy object fetch. */
export function gitRead(cwd:string,args:readonly string[],options:GitOptions={}):Promise<string> {
  if(!gitAllowed(args))return Promise.reject(new LocalError('拒绝非白名单 Git 命令或参数'))
  options.signal?.throwIfAborted()
  const env={...process.env}
  for(const key of Object.keys(env))if(key.startsWith('GIT_'))delete env[key]
  Object.assign(env,{GIT_OPTIONAL_LOCKS:'0',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'})
  return new Promise((resolve,reject)=>{
    const child=execFile('git',['--no-pager','-c','core.fsmonitor=false','-c','core.hooksPath=','-c','diff.external=','-c','core.attributesFile=',...args.slice(0,1),...(args[0]==='log'?['--no-ext-diff','--no-textconv']:[]),...args.slice(1)],{
      cwd,env,shell:false,windowsHide:true,timeout:options.timeoutMs??GIT_TIMEOUT,maxBuffer:options.maxBytes??GIT_OUTPUT,signal:options.signal,encoding:'utf8',
    },(error,stdout)=>{
      const finish=()=>{
        if(error){reject(new LocalError(options.signal?.aborted?'本地 Git 已取消':error.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER'?'本地 Git 输出超过上限':error.killed?'本地 Git 超时':'本地 Git 读取失败'));return}
        resolve(stdout)
      }
      // Abort callbacks may arrive before process exit; wait for OS handles to close.
      if(error&&child.exitCode===null&&child.signalCode===null)child.once('close',finish)
      else finish()
    })
    child.stdin?.on('error',()=>{})
    child.stdin?.end(options.input??'')
  })
}
export interface LocalRepo {path?:string; sha?:string; status:string; fingerprint:string}
export async function openLocal(repo:Repo,signal?:AbortSignal):Promise<LocalRepo> {
  if(!repo.localRepoPath)return {status:'未配置本地仓库对照',fingerprint:'unconfigured'}
  try{
    validateLocal(repo.localRepoPath)
    const root=await realpath(repo.localRepoPath);validateLocal(root)
    if(!(await stat(root)).isDirectory())throw new LocalError('不是目录')
    // Require the selected repository root, never silently ascend into a parent repo.
    const metadata=await realpath(path.join(root,'.git'));validateLocal(metadata)
    if((await stat(metadata)).isFile()){
      const {readLocal}=await import('./business.js')
      const match=/^gitdir: (.+)\r?$/m.exec(await readLocal(metadata))
      if(!match)throw new LocalError('无效 Git worktree 元数据')
      const gitdir=path.resolve(root,match[1]);validateLocal(gitdir);validateLocal(await realpath(gitdir))
    }
    const ref=refValue(repo.localRef||'HEAD')
    const commit=(await gitRead(root,['rev-parse','--verify','--end-of-options',ref+'^{commit}'],{signal})).trim()
    if(!sha.test(commit))throw new LocalError('不是有效 Git 仓库')
    return {path:root,sha:commit,status:'本地仓库对照：'+ref+' @ '+commit.slice(0,12)+'（已提交代码）',fingerprint:hash(JSON.stringify([root,commit]))}
  }catch{signal?.throwIfAborted();return {status:'本地仓库对照失败：请检查绝对路径、Git 仓库和 ref（拒绝 UNC/设备路径）',fingerprint:hash(JSON.stringify([repo.localRepoPath,repo.localRef,'failed']))}}
}
export interface LocalEvidence {status:string; commit?:string; files:{path:string;exists:boolean;snippet?:string}[]; evidence:string[]}
/** Only committed blobs are read: symlinks and dirty worktree files are never followed. */
export async function localEvidence(local:LocalRepo,item:Item,signal?:AbortSignal):Promise<LocalEvidence> {
  const result:LocalEvidence={status:local.status,commit:local.sha,files:[],evidence:[]}
  if(!local.path||!local.sha)return result
  const run=(args:string[],extra:Partial<GitOptions>={})=>gitRead(local.path!,args,{signal,...extra})
  try{
    const tree=(await run(['ls-tree','-rz','--name-only',local.sha])).split('\0').filter(Boolean)
    const requested=[...new Set([...(item.files??[]).map(f=>f.path),...(item.locations??[]),...(item.fixes??[]).flatMap(f=>(f.files??[]).map(x=>x.path)),...([...item.body.matchAll(/(?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z]{1,8}/g)].map(m=>m[0]))])].filter(fileValue)
    if(item.kind==='issue'&&!requested.length){
      const words=item.title.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(w=>w.length>=4).slice(0,5)
      requested.push(...tree.filter(f=>words.some(w=>f.toLowerCase().includes(w))).slice(0,3))
    }
    for(const file of requested.slice(0,3)){
      signal?.throwIfAborted()
      const exists=tree.includes(file),row:LocalEvidence['files'][number]={path:file,exists};result.files.push(row)
      if(!exists)continue
      const object=local.sha+':'+file,size=Number((await run(['cat-file','-s',object])).trim())
      if(!Number.isFinite(size)||size>64*1024){result.evidence.push(file+'：超过 64KB，跳过正文');continue}
      const text=await run(['show','--no-ext-diff','--no-textconv',object],{maxBytes:64*1024})
      row.snippet=text.includes('\0')?'[二进制文件，跳过]':clip(text,FILE_SNIPPET_LIMIT)
    }
    const history=await run(['log','-n80','--format=%H%x09%s',local.sha])
    const issuePattern=new RegExp('(?:#|GH-)'+item.number+'\\b','i')
    const terms=[...item.title.split(/[^\p{L}\p{N}_]+/u).filter(w=>w.length>=5).slice(0,3),...[...(item.commits??[]),...(item.fixes??[]).flatMap(f=>f.commits??[])].slice(0,6).map(c=>c.message.split('\n')[0].slice(0,150))]
    const matches=history.split(/\r?\n/).filter(line=>{const message=line.slice(line.indexOf('\t')+1);return issuePattern.test(message)||terms.some(t=>message.toLowerCase().includes(t.toLowerCase()))}).slice(0,8)
    result.evidence.push('只检查选定 ref 的提交快照；不读取未提交修改。历史窗口：最近 80 条，关键词匹配只作线索。',...matches.map(m=>'本地提交关键词线索：'+clip(m,300)))
    for(const upstream of [item,...(item.fixes??[]).slice(0,2)]){
      const commits=[upstream.mergeCommit,...(upstream.commits??[]).slice(0,5).map(c=>c.sha),upstream.head].filter((s):s is string=>!!s&&sha.test(s))
      for(const commit of [...new Set(commits)]){
        try{await run(['merge-base','--is-ancestor',commit,local.sha]);result.evidence.push('上游提交已包含在本地历史：'+commit)}catch{signal?.throwIfAborted()}
      }
      const patch=completePatch(upstream)
      if(patch){
        const upstreamId=(await run(['patch-id','--stable'],{input:patch})).trim().split(/\s+/)[0]
        if(upstreamId){
          try{
            const patches=await run(['log','-n80','--format=medium',local.sha,'-p'])
            const ids=await run(['patch-id','--stable'],{input:patches})
            const match=ids.split(/\r?\n/).find(line=>line.startsWith(upstreamId+' '))
            if(match)result.evidence.push('相同 patch-id（可能已回迁）：'+match)
            else result.evidence.push('最近 80 条未找到相同 patch-id；不代表未修复')
          }catch{signal?.throwIfAborted();result.evidence.push('patch-id 历史比较未完成（可能超过输出上限）')}
        }
      }else if(upstream.kind==='pr')result.evidence.push('上游 patch 不完整或含重命名/二进制，跳过 patch-id 比较')
      if(upstream!==item)result.evidence.push('上游关联修复 PR #'+upstream.number+'：'+clip(upstream.title,200))
    }
    if(requested.length>3)result.evidence.push('相关路径超过 3 个，仅检查前 3 个')
    if(!requested.length)result.evidence.push('未定位本地相关文件；不能据此断言问题不存在')
  }catch{signal?.throwIfAborted();result.evidence.push('本地证据读取未完成（超时、输出上限、文件或 Git 限制），请人工核对')}
  // File snippets <=9KB; all other observations share a separate bounded budget.
  while(Buffer.byteLength(JSON.stringify(result))>LOCAL_TOTAL&&result.evidence.length)result.evidence.pop()
  while(Buffer.byteLength(JSON.stringify(result))>LOCAL_TOTAL&&result.files.length)result.files.pop()
  return result
}
/** Only complete simple textual diffs have a trustworthy comparable patch-id. */
export function completePatch(item:Item):string|undefined {
  if(!item.files?.length||item.changedFiles!==item.files.length)return
  const patches:string[]=[]
  for(const f of item.files){
    if(f.status&&f.status!=='modified'||!fileValue(f.path)||!f.patch||!f.patch.startsWith('@@')||f.path.includes(' '))return
    const lines=f.patch.split('\n')
    if(lines.filter(l=>l.startsWith('+')).length!==f.additions||lines.filter(l=>l.startsWith('-')).length!==f.deletions)return
    patches.push('diff --git a/'+f.path+' b/'+f.path+'\n--- a/'+f.path+'\n+++ b/'+f.path+'\n'+f.patch+'\n')
  }
  return patches.join('')
}
