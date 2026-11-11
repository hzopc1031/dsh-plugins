import { repoName, repoSchema, limitSchema, fullLimitSchema, type Scan, type Repo, type State } from './types.js'
export function repositories(config: Repo[], state: State): Repo[] {
  const map = new Map(config.map(row => { const r = repoSchema.parse(row); return [r.repo, r] }))
  for (const r of Object.values(state.overrides)) map.set(r.repo, r)
  for (const repo of state.removed) map.delete(repo)
  return [...map.values()].sort((a,b) => a.repo.localeCompare(b.repo))
}
/** Shell-like quoting without expansion; preserve Windows path backslashes. */
export function tokens(raw:string):string[] {
  const out:string[]=[];let value='',quote='',started=false
  for(let i=0;i<raw.length;i++){
    const c=raw[i]
    if(c==='\\'&&(raw[i+1]===quote&&!!quote)){value+=raw[++i];started=true}
    else if(quote){if(c===quote)quote='';else value+=c}
    else if(c==="'"||c==='"'){quote=c;started=true}
    else if(/\s/.test(c)){if(started){out.push(value);value='';started=false}}
    else{value+=c;started=true}
  }
  if(quote)throw new Error('引号未闭合')
  if(started)out.push(value)
  return out
}
export function repoCommand(raw: string, state: State, config:Repo[]=[]): string {
  const [action, name, ...args] = tokens(raw)
  if (!name || !['add','remove','business','local'].includes(action)) throw new Error('用法：/triage-repo add owner/repo [--issues|--prs|--both] [--daily HH:MM|--every 小时] [--limit N] [--business "文本"] [--business-file 路径] [--local 路径] [--ref 分支] [--rules-file 路径] [--full-max N]；local owner/repo 路径 [--ref 分支] | --clear；business owner/repo "文本" | --file 路径 | --clear；remove owner/repo；list')
  const repo = repoName.parse(name)
  if (action === 'remove') {
    if (args.length) throw new Error('remove 不接受其他参数')
    state.removed = [...new Set([...state.removed, repo])]
    delete state.overrides[repo]; delete state.pending[repo]
    return '已移除 ' + repo
  }
  if(action==='local'){
    const existing=repositories(config,state).find(r=>r.repo===repo)
    if(!existing)throw new Error('请先添加仓库')
    const r={...existing};delete r.localRepoPath;delete r.localRef
    if(args.length===1&&args[0]==='--clear'){}
    else if((args.length===1||args.length===3&&args[1]==='--ref')&&args[0]&&!args[0].startsWith('--')){
      r.localRepoPath=args[0];if(args.length===3)r.localRef=args[2]
    }else throw new Error('local 参数无效')
    state.overrides[repo]=repoSchema.parse(r);delete state.lastRun[repo]
    return '已更新本地仓库对照：'+repo
  }
  if(action==='business'){
    const existing=repositories(config,state).find(r=>r.repo===repo)
    if(!existing)throw new Error('请先添加仓库')
    const r={...existing};delete r.business;delete r.businessFile
    if(args.length===1&&args[0]==='--clear'){}
    else if(args.length===2&&args[0]==='--file'&&args[1]&&!args[1].startsWith('--'))r.businessFile=args[1]
    else if(args.length===1&&args[0]&&!args[0].startsWith('--'))r.business=args[0]
    else throw new Error('business 参数无效；含空格文本请加引号')
    state.overrides[repo]=repoSchema.parse(r);delete state.lastRun[repo]
    return '已更新业务说明：'+repo
  }
  const r: Repo = { repo, mode: 'both' }
  const seen = new Set<string>()
  for (let i = 0; i < args.length; i++) {
    const flag = args[i], key = ['--issues','--prs','--both'].includes(flag) ? 'mode' : ['--daily','--every'].includes(flag) ? 'schedule' : flag
    if (seen.has(key)) throw new Error('重复或冲突的选项')
    seen.add(key)
    if (key === 'mode') r.mode = flag.slice(2) as Repo['mode']
    else if (flag === '--daily') r.schedule = { kind: 'daily', time: args[++i] }
    else if (flag === '--every') r.schedule = { kind: 'every', hours: Number(args[++i]) }
    else if (flag === '--limit') r.limit = limitSchema.parse(Number(args[++i]))
    else if(['--local','--ref','--rules-file','--full-max'].includes(flag)){
      const value=args[++i];if(!value||value.startsWith('--'))throw new Error('缺少参数')
      if(flag==='--local')r.localRepoPath=value
      if(flag==='--ref')r.localRef=value
      if(flag==='--rules-file')r.rulesFile=value
      if(flag==='--full-max')r.fullMax=fullLimitSchema.parse(Number(value))
    }
    else if (flag === '--business' || flag === '--business-file') {
      const value=args[++i]
      if(!value||value.startsWith('--'))throw new Error('缺少业务说明参数')
      if(flag==='--business')r.business=value;else r.businessFile=value
    }
    else throw new Error('未知选项')
  }
  if(r.localRef&&!r.localRepoPath)throw new Error('--ref 需要 --local')
  state.overrides[repo] = repoSchema.parse(r)
  state.removed = state.removed.filter(n => n !== repo)
  delete state.lastRun[repo]
  return '已保存 ' + repo
}
export interface RunArguments extends Scan {repo?:string;limit?:number;max?:number}
export function runArguments(raw:string):RunArguments {
  const args=tokens(raw),out:RunArguments={repo:args[0]&&!args[0].startsWith('--')?repoName.parse(args.shift()):undefined},seen=new Set<string>()
  for(let i=0;i<args.length;i++){
    const flag=args[i]
    if(seen.has(flag))throw new Error('重复选项');seen.add(flag)
    if(flag==='--full'){out.full=true;continue}
    const value=args[++i]
    if(!value||value.startsWith('--'))throw new Error('缺少参数')
    if(flag==='--limit')out.limit=limitSchema.parse(Number(value))
    else if(flag==='--max')out.max=fullLimitSchema.parse(Number(value))
    else if(flag==='--since'||flag==='--until'){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('日期无效')
      if(flag==='--since')out.since=value;else out.until=value
    }else throw new Error('未知选项')
  }
  if((out.max!==undefined||out.since||out.until)&&!out.full)throw new Error('时间范围与 --max 需要 --full')
  if(out.full&&out.limit!==undefined)throw new Error('--full 请使用 --max')
  if(out.since&&out.until&&out.since>out.until)throw new Error('时间范围倒置')
  return out
}
