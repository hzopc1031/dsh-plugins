import { execFile } from 'node:child_process'
import { EnvHttpProxyAgent, fetch as proxyFetch, type Dispatcher } from 'undici'
import { repoName, limitSchema, fullLimitSchema, type Scan, type Item } from './types.js'
import { SafeText } from './safety.js'
import { BusinessReadError, clip, FILE_SNIPPET_LIMIT, MAX_CONTEXT_FILES } from './business.js'

export type Fetcher = (url: string, init: {
  method: string; headers: Record<string,string>; signal: AbortSignal; redirect: 'error'; dispatcher?: Dispatcher
}) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }>
export type GhToken = (signal?: AbortSignal) => Promise<string>
export const ghToken: GhToken = signal => new Promise(resolve => {
  execFile('gh', ['auth','token'], { signal, timeout: 5000, windowsHide: true, maxBuffer: 16384, shell: false },
    (error, stdout) => resolve(error ? '' : stdout.trim()))
})
export class GithubError extends Error {
  constructor(public readonly status: number, public readonly retryAt?: number) {
    super(status === 403 || status === 429 ? 'GitHub 限流或权限不足；稍后重试。' : 'GitHub 请求失败，请检查网络、代理和仓库访问权限。')
  }
}
interface IssueWire { number: number; title: string; body: string | null; updated_at: string; html_url: string; pull_request?: unknown }
interface RepositoryWire { has_issues?: boolean; has_pull_requests?: boolean }
interface PullWire extends IssueWire { head: { sha: string }; additions?: number; deletions?: number; changed_files?: number; draft?: boolean; merge_commit_sha?:string; merged?:boolean }
export class Github {
  #options: { safe?: SafeText; fetch?: Fetcher; env?: NodeJS.ProcessEnv; gh?: GhToken; timeoutMs?: number; maxPages?: number; now?: () => number }
  #token = ''
  #ready?: Promise<void>
  #dispatcher?: EnvHttpProxyAgent
  #cooldown = 0
  #trees = new Map<string, Promise<string[]>>()
  readonly safe: SafeText
  #warnings: string[] = []
  #featureWarnings: string[] = []
  #repositories = new Map<string, RepositoryWire>()
  get warnings(): string[] { return [...this.#warnings, ...this.#featureWarnings] }
  constructor(options: { safe?: SafeText; fetch?: Fetcher; env?: NodeJS.ProcessEnv; gh?: GhToken; timeoutMs?: number; maxPages?: number; now?: () => number } = {}) {
    this.#options = options
    this.safe = options.safe ?? new SafeText(options.env)
  }
  private async auth(signal?: AbortSignal): Promise<void> {
    if (!this.#ready) this.#ready = (async () => {
      const env = this.#options.env ?? process.env
      this.#token = env.GH_TOKEN?.trim() || env.GITHUB_TOKEN?.trim() || await (this.#options.gh ?? ghToken)(signal)
      this.safe.add(this.#token)
      if (!this.#token) this.#warnings.push('匿名访问 GitHub，限流额度较低；可设置 GH_TOKEN/GITHUB_TOKEN 或登录 gh。')
    })()
    await this.#ready
    signal?.throwIfAborted()
  }
  async request<T>(path: string, method = 'GET', signal?: AbortSignal): Promise<T> {
    if (method !== 'GET') throw new Error('只读客户端拒绝非 GET 请求')
    // Fixed origin and a restricted path: tokens cannot follow redirects or attacker URLs.
    if (!/^\/(?:repos\/|search\/issues\?|graphql\?)/.test(path) || path.includes('://') || /[\\\r\n#]/.test(path)) throw new Error('非法 GitHub 路径')
    const url = new URL(path, 'https://api.github.com')
    if (url.origin !== 'https://api.github.com') throw new Error('非法 GitHub 地址')
    if (url.pathname === '/graphql') this.validateQuery(url.searchParams.get('query') ?? '')
    const now = (this.#options.now ?? Date.now)()
    if (now < this.#cooldown) throw new GithubError(429, this.#cooldown)
    const combined = AbortSignal.any([AbortSignal.timeout(this.#options.timeoutMs ?? 20000), ...(signal ? [signal] : [])])
    await this.auth(combined)
    const headers: Record<string,string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'dsh-github-triage/0.4.0' }
    if (this.#token) headers.Authorization = 'Bearer ' + this.#token
    if (!this.#options.fetch && !this.#dispatcher) this.#dispatcher = new EnvHttpProxyAgent()
    try {
      const response = await (this.#options.fetch ?? proxyFetch)(url.href, { method: 'GET', headers, signal: combined, redirect: 'error', dispatcher: this.#dispatcher })
      if (!response.ok) {
        let retryAt: number | undefined
        if ([403,429].includes(response.status)) {
          const after = response.headers.get('retry-after')
          const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000
          const wait = after && /^\d+$/.test(after) ? now + Number(after)*1000 : after ? Date.parse(after) : 0
          retryAt = Math.max(now + 60000, Number.isFinite(wait) ? wait : 0, Number.isFinite(reset) ? reset : 0)
          this.#cooldown = retryAt
        }
        throw new GithubError(response.status, retryAt)
      }
      return this.safe.value(await response.json()) as T
    } catch (error) {
      if (signal?.aborted) throw new Error('GitHub 请求已取消')
      if (error instanceof GithubError) throw error
      throw new GithubError(0)
    }
  }
  private validateQuery(query: string): void {
    // No arbitrary documents, anonymous operations, fragments, or extra operations.
    if (!/^\s*query\b/.test(query) || /\b(?:mutation|subscription|fragment)\b/i.test(query) || (query.match(/\bquery\b/g) ?? []).length !== 1) throw new Error('只读 GraphQL 仅接受单一 query')
  }
  async graphql<T>(query: string, signal?: AbortSignal): Promise<T> {
    this.validateQuery(query)
    return this.request<T>('/graphql?query=' + encodeURIComponent(query), 'GET', signal)
  }
  private pages(): number { return Math.max(1, Math.min(3, this.#options.maxPages ?? 3)) }
  async list(repoInput: string, mode: 'issues'|'prs'|'both', limit: number, signal?: AbortSignal, scan:Scan={}): Promise<Item[]> {
    const repo = repoName.parse(repoInput); (scan.full?fullLimitSchema:limitSchema).parse(limit)
    // Refresh capabilities on each run: only explicitly false flags disable an API.
    this.#featureWarnings = []
    this.#trees.delete(repo)
    const metadata = await this.request<RepositoryWire>('/repos/' + repo, 'GET', signal)
    this.#repositories.set(repo, metadata)
    const issuesDisabled = mode !== 'prs' && metadata.has_issues === false
    const prsDisabled = mode !== 'issues' && metadata.has_pull_requests === false
    if (issuesDisabled || prsDisabled) this.#featureWarnings.push('该仓库已关闭 ' +
      (issuesDisabled && prsDisabled ? 'Issues/PR' : issuesDisabled ? 'Issues' : 'PR') + ' 功能；已跳过对应拉取。')
    if(scan.full){
      if(issuesDisabled&&prsDisabled||mode==='issues'&&issuesDisabled||mode==='prs'&&prsDisabled)return []
      const range=scan.since||scan.until?' updated:'+(scan.since&&scan.until?scan.since+'..'+scan.until:scan.since?'>='+scan.since:'<='+scan.until):''
      const kinds:('issue'|'pr')[]=[],items:Item[]=[]
      if(mode!=='prs'&&!issuesDisabled)kinds.push('issue')
      if(mode!=='issues'&&!prsDisabled)kinds.push('pr')
      let totalCount=0
      // Search requires an explicit type; each stream needs its own limit before merging.
      for(const kind of kinds){
        const query='repo:'+repo+' is:'+kind+range,typedItems:Item[]=[]
        for(let page=1;page<=Math.ceil(limit/100);page++){
          const data=await this.request<{items:IssueWire[];total_count:number;incomplete_results?:boolean}>('/search/issues?q='+encodeURIComponent(query)+'&sort=updated&order=desc&per_page=100&page='+page,'GET',signal)
          if(page===1)totalCount+=data.total_count
          if(data.incomplete_results)this.#warnings.push('GitHub 搜索返回不完整结果；请缩小时间范围后重试。')
          typedItems.push(...data.items.map(i=>({...this.issue(repo,i),kind:i.pull_request?'pr' as const:'issue' as const,url:'https://github.com/'+repo+(i.pull_request?'/pull/':'/issues/')+i.number})))
          if(data.items.length<100||typedItems.length>=limit)break
        }
        items.push(...typedItems.slice(0,limit))
      }
      if(totalCount>limit)this.#warnings.push('全量扫描超过上限 '+limit+'，仅取最近更新的条目（含开放与关闭）；可缩小时间范围。')
      this.#warnings.push('全量扫描会增加 GitHub 请求与模型费用；后续定时仅处理开放条目的新增和变化。')
      return items.sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(0,limit)
    }
    const items: Item[] = []
    if (mode !== 'prs' && !issuesDisabled) {
      const data = await this.request<{items: IssueWire[]}>('/search/issues?q=' + encodeURIComponent('repo:' + repo + ' is:issue is:open') + '&sort=updated&order=desc&per_page=' + limit, 'GET', signal)
      items.push(...data.items.filter(i => !i.pull_request).slice(0,limit).map(i => this.issue(repo,i)))
    }
    if (mode !== 'issues' && !prsDisabled) {
      const data = await this.request<PullWire[]>('/repos/' + repo + '/pulls?state=open&sort=updated&direction=desc&per_page=' + limit, 'GET', signal)
      items.push(...data.slice(0,limit).map(i => ({...this.issue(repo,i),kind:'pr' as const,head:i.head.sha})))
    }
    return items.sort((a,b) => b.updated_at.localeCompare(a.updated_at)).slice(0,limit)
  }
  private issue(repo: string, i: IssueWire): Item {
    return {number:i.number,kind:'issue',title:i.title.slice(0,500),body:(i.body ?? '').slice(0,16000),updated_at:i.updated_at,
      url:'https://github.com/' + repo + '/issues/' + i.number}
  }
  async contents(repo:string,file:string,maxBytes:number,signal?:AbortSignal):Promise<string> {
    repo=repoName.parse(repo)
    if (!file || file.length>4096 || file.startsWith('/') || /[\\\x00-\x1f]/.test(file) || file.split('/').some(p=>!p||p==='.'||p==='..')) throw new BusinessReadError('仓库文件路径、类型或大小不符合只读限制')
    // Without ref, GitHub contents reads the default branch. Never follow download_url.
    const data=await this.request<{type:string;size:number;encoding:string;content:string}>(
      '/repos/'+repo+'/contents/'+file.split('/').map(encodeURIComponent).join('/'),'GET',signal)
    if(data.type!=='file'||data.encoding!=='base64'||!Number.isSafeInteger(data.size)||data.size<0||data.size>maxBytes||typeof data.content!=='string'||data.content.length>Math.ceil(maxBytes/3)*4+2048)throw new BusinessReadError('仓库文件路径、类型或大小不符合只读限制')
    const bytes=Buffer.from(data.content,'base64')
    if(bytes.length>maxBytes||bytes.includes(0))throw new BusinessReadError('仓库文件路径、类型或大小不符合只读限制')
    try { return this.safe.text(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) }
    catch { throw new BusinessReadError('仓库文件不是有效 UTF-8 文本') }
  }
  private async snippets(repo:string,item:Item,paths:string[],signal?:AbortSignal):Promise<void> {
    item.snippets=[]
    const candidates=[...new Set(paths)].filter(p=>/\.(?:[cm]?[jt]sx?|py|rs|go|java|c|cpp|h|cs|rb|md|rst|txt|ya?ml|json|toml)$/i.test(p)&&
      !/(?:^|\/)(?:\.env|credentials?|secrets?|id_rsa|id_ed25519)(?:[.\/]|$)/i.test(p)).slice(0,MAX_CONTEXT_FILES)
    for(const file of candidates){
      try {
        const text=await this.contents(repo,file,64*1024,signal)
        item.snippets.push({path:file,text:clip(text,FILE_SNIPPET_LIMIT),truncated:Buffer.byteLength(text)>FILE_SNIPPET_LIMIT})
      } catch(e) {
        if(signal?.aborted || e instanceof GithubError && e.retryAt)throw e
        item.notes!.push('相关文件片段不可用：'+file+'（不存在、非文本、超过 64KB 或读取失败）')
      }
    }
  }
  async enrich(repo: string, item: Item, signal?: AbortSignal): Promise<Item> {
    repoName.parse(repo)
    const result: Item = {...item,notes:[]}
    const optional = async <T>(path: string): Promise<T | undefined> => {
      try { return await this.request<T>(path,'GET',signal) } catch (e) {
        if (signal?.aborted || e instanceof GithubError && (e.status===429 || e.retryAt)) throw e
        result.notes!.push('部分证据不可用（权限、网络或接口限制）'); return undefined
      }
    }
    if (item.kind === 'issue') {
      if (!this.#trees.has(repo)) this.#trees.set(repo, (async () => {
        const meta = await optional<{default_branch:string}>('/repos/' + repo)
        if (!meta) return []
        const tree = await optional<{tree:{path:string;type:string}[];truncated:boolean}>('/repos/' + repo + '/git/trees/' + encodeURIComponent(meta.default_branch) + '?recursive=1')
        if (tree?.truncated) result.notes!.push('仓库树被截断；定位不完整')
        return (tree?.tree ?? []).filter(t=>t.type==='blob').slice(0,5000).map(t=>t.path)
      })())
      const words = (item.title.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) ?? []).filter(w=>!['issue','error','failed','please','with','when','does','support','feature','request','crash'].includes(w))
      const tree=await this.#trees.get(repo)!
      const stack=(item.body??'').match(/(?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z]+(?::\d+(?::\d+)?)?/g)??[]
      const stackPaths=stack.map(p=>p.replace(/:\d+(?::\d+)?$/,''))
      result.locations = [...new Set([...tree.filter(p=>stackPaths.some(s=>s===p||s.endsWith('/'+p))),
        ...tree.filter(p=>words.some(w=>p.toLowerCase().includes(w)))])].slice(0,5)
      await this.snippets(repo,result,result.locations,signal)
      return result
    }
    const base = '/repos/' + repo
    const pr = await this.request<PullWire>(base + '/pulls/' + item.number,'GET',signal)
    // Preserve a consistent snapshot: retry next time instead of caching mixed heads.
    if (item.head && pr.head.sha !== item.head || pr.updated_at !== item.updated_at) throw new Error('PR 在拉取时发生更新，请重试')
    Object.assign(result,{head:pr.head.sha,mergeCommit:pr.merge_commit_sha,additions:pr.additions,deletions:pr.deletions,changedFiles:pr.changed_files,draft:pr.draft,url:'https://github.com/'+repo+'/pull/'+item.number})
    result.files = []
    for (let page=1;page<=this.pages();page++) {
      const files = await this.request<{filename:string;additions:number;deletions:number;status?:string;patch?:string}[]>(base+'/pulls/'+item.number+'/files?per_page=100&page='+page,'GET',signal)
      result.files.push(...files.map(f=>({path:f.filename,additions:f.additions,deletions:f.deletions,status:f.status,patch:f.patch?clip(f.patch,16*1024):undefined})))
      if (files.length<100) break
    }
    if ((pr.changed_files ?? 0)>result.files.length) result.notes!.push('文件列表达到分页上限；审查不完整')
    const sha = encodeURIComponent(pr.head.sha)
    const statuses = await optional<{statuses:{context:string;state:string}[]}>(base+'/commits/'+sha+'/status?per_page=100')
    const checks = await optional<{total_count:number;check_runs:{name:string;status:string;conclusion:string|null}[]}>(base+'/commits/'+sha+'/check-runs?per_page=100')
    result.ci = [...(statuses?.statuses ?? []).map(c=>({name:c.context,state:c.state==='success'?'pass' as const:['failure','error'].includes(c.state)?'fail' as const:'pending' as const})),
      ...(checks?.check_runs ?? []).map(c=>({name:c.name,state:['success','neutral','skipped'].includes(c.conclusion ?? '')?'pass' as const:c.status!=='completed'?'pending' as const:'fail' as const}))]
    if ((checks?.total_count ?? 0)>100) result.notes!.push('CI 检查超过分页上限')
    result.linked = []
    for (const match of item.body.matchAll(/\b(?:fix(?:es|ed)?|clos(?:e[sd]?)|resolv(?:e[sd]?))\s+(?:https:\/\/github.com\/[^\s/]+\/[^\s/]+\/issues\/|#)(\d+)/gi)) {
      if (this.#repositories.get(repo.toLowerCase())?.has_issues === false) {
        result.notes!.push('该仓库已关闭 Issues 功能；已跳过关联 issue 拉取'); break
      }
      if (result.linked.length>=3) {result.notes!.push('关联 issue 超过 3 条上限');break}
      // Cross-repository links are not fetched as same-repository issues.
      if (match[0].includes('https://') && !match[0].toLowerCase().includes('github.com/'+repo.toLowerCase()+'/issues/')) continue
      const linked = await optional<IssueWire>(base+'/issues/'+Number(match[1]))
      if (linked && !linked.pull_request) result.linked.push({number:linked.number,title:linked.title,body:(linked.body??'').slice(0,2000)})
    }
    await this.snippets(repo,result,result.files.map(f=>f.path),signal)
    return result
  }
  /** Extra GET evidence only when a local comparison was explicitly configured. */
  async localDetails(repo:string,item:Item,signal?:AbortSignal):Promise<Item> {
    repo=repoName.parse(repo)
    const result={...item,notes:[...(item.notes??[])]}
    const commits=async(pr:Item)=>{
      const data=await this.request<{sha:string;commit:{message:string}}[]>('/repos/'+repo+'/pulls/'+pr.number+'/commits?per_page=100','GET',signal)
      pr.commits=data.slice(0,100).map(c=>({sha:c.sha,message:clip(c.commit.message,500)}))
      if(data.length===100)result.notes.push('上游提交最多读取 100 条，可能不完整')
    }
    try{
      if(item.kind==='pr')await commits(result)
      else {
        const data=await this.request<{items:IssueWire[]}>('/search/issues?q='+encodeURIComponent('repo:'+repo+' is:pr is:merged "#'+item.number+'"')+'&sort=updated&order=desc&per_page=5','GET',signal)
        result.fixes=[]
        for(const candidate of data.items.slice(0,5)){
          if(!new RegExp('(?:fix(?:es|ed)?|clos(?:e[sd]?)|resolv(?:e[sd]?))\\s+#'+item.number+'\\b','i').test(candidate.body??''))continue
          const detail=await this.request<PullWire>('/repos/'+repo+'/pulls/'+candidate.number,'GET',signal)
          if(!detail.merged)continue
          const fix:Item={...this.issue(repo,detail),kind:'pr',head:detail.head.sha,mergeCommit:detail.merge_commit_sha,changedFiles:detail.changed_files,files:[]}
          const files=await this.request<{filename:string;additions:number;deletions:number;status?:string;patch?:string}[]>('/repos/'+repo+'/pulls/'+fix.number+'/files?per_page=100','GET',signal)
          fix.files=files.map(f=>({path:f.filename,additions:f.additions,deletions:f.deletions,status:f.status,patch:f.patch?clip(f.patch,16*1024):undefined}))
          await commits(fix);result.fixes.push(fix)
          if(result.fixes.length===2)break
        }
      }
    }catch(error){
      signal?.throwIfAborted()
      if(error instanceof GithubError&&[403,429].includes(error.status))throw error
      result.notes.push('上游提交/关联修复 PR 证据未完整取得')
    }
    return result
  }
  async close(): Promise<void> { await this.#dispatcher?.close() }
}

