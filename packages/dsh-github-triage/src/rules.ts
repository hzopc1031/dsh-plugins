import type { Item, Judgment } from './types.js'
/** Character bigram Dice similarity works for English and Chinese without a tokenizer dependency. */
export function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const chars = [...s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'').slice(0,3000)]
    return new Set(chars.slice(1).map((c,i)=>chars[i]+c))
  }
  const x=grams(a),y=grams(b)
  return x.size && y.size ? 2*[...x].filter(c=>y.has(c)).length/(x.size+y.size) : 0
}
export function duplicateOf(item: Item, peers: Item[]): number | undefined {
  return peers.filter(p=>p.kind==='issue' && p.number<item.number).find(p=>
    similarity(p.title,item.title)>=0.86 ||
    similarity(p.title,item.title)>=0.55 && item.body.length>80 && p.body.length>80 && similarity(p.body,item.body)>=0.9)?.number
}
export function rules(item: Item, peers: Item[] = []): Judgment {
  const text = item.title+'\n'+item.body
  if (item.kind==='issue') {
    const duplicate = duplicateOf(item,peers)
    const type = duplicate ? '重复' : !item.title.trim() || item.body.trim().length<8 ? '无效' :
      /feature|enhancement|support for|功能|需求|建议|希望/i.test(text) ? '需求' :
      /how (?:to|can)|question|请问|如何|怎么使用/i.test(text) ? '提问' : 'bug'
    const repro = /(?:steps to reproduce|reproduction|复现步骤|重现步骤)[\s\S]{0,120}(?:\d[.)、]|\n[-*]|\x60|https?:)|(?:1[.)、].+\n[\s\S]*2[.)、])|复现[：:].{10}/i.test(item.body)
    const version = /(?:version|版本)[^\n]{0,60}\d|\bv?\d+\.\d+(?:\.\d+)?/i.test(item.body)
    const log = /\x60{3}[^\x60]*(?:error|exception|stack|trace|错误)|(?:error:|exception:|报错[：:]|日志[：:])\s*\S+/i.test(item.body)
    const evidence = [duplicate ? '疑似重复 #' + duplicate + '（相似度启发式，需人工核对）' : '',
      repro?'有复现步骤':'缺复现步骤',version?'有版本信息':'缺版本信息',log?'有日志/报错':'缺日志/报错',
      /^#{1,4}\s+/m.test(item.body)?'有模板分段（未验证仓库特定模板）':'缺 issue 模板关键分段（通用启发式）',
      item.locations?.length?'关键词粗略定位：'+item.locations.join(', '):'未定位（没有代码级复现证明）',
      ...(item.notes??[])].filter(Boolean)
    const critical = /data loss|security|vulnerab|credential leak|数据丢失|安全漏洞|泄露|无法启动|crash|崩溃/i.test(text)
    const useful = type==='bug' && repro && (version || log) || type==='需求' && item.body.length>120
    const worth = ['重复','无效','提问'].includes(type)?'不值得修':useful?'值得修':'待补充'
    return {kind:'issue',type,real:['重复','无效'].includes(type)?'否':type==='bug'&&repro&&(version||log)?'是':'待证实',
      worth,priority:critical&&!['重复','无效'].includes(type)?'高':worth==='值得修'?'中':'低',
      impact:critical?'可能影响数据、安全或核心可用性；尚未验证':'影响范围未量化，需维护者确认',
      severity:critical?'高（依据描述推测）':type==='bug'?'中（待复现）':'低/待评估',
      cost:item.locations?.length?'已有路径线索，成本仍需代码审查':'未知（未完成代码定位）',
      reason:duplicate?'先核对已有报告，避免重复修复':critical?'涉及核心风险，应优先核实':useful?'信息较充分，建议维护者验证后处理':'证据不足或属于答疑，先补信息/分流', evidence}
  }
  const files=item.files??[], notes=item.notes??[]
  const suspicious = files.filter(f=>/(^|\/)(?:package\.json|[^/]*lock[^/]*|[^/]*\.(?:lock|exe|dll|so|dylib|bin|wasm)|Dockerfile|Makefile|[^/]*\.(?:sh|ps1|bat|cmd))$|^\.github\/workflows\/|(^|\/)(?:scripts|permissions?)\/|(?:requirements|pyproject|Cargo|go\.(?:mod|sum)|pom\.xml|composer\.json|Gemfile|Pipfile|build\.gradle|setup\.py)/i.test(f.path))
  const testFiles=files.filter(f=>/(?:^|\/)(?:tests?|__tests__)\/|[._-](?:test|spec)\.|test_[^/]+|_test\./i.test(f.path))
  const code = files.some(f=>/\.(?:[cm]?[jt]sx?|py|rs|go|java|c|cpp|h|cs|rb)$/.test(f.path) && !testFiles.includes(f))
  const failed=item.ci?.filter(c=>c.state==='fail')??[], pending=item.ci?.filter(c=>c.state==='pending')??[]
  const large=(item.changedFiles??files.length)>30 || (item.additions??0)+(item.deletions??0)>1000
  const incomplete=!item.files || !item.ci?.length || notes.length>0
  const linked = item.linked??[]
  const match = linked.some(i=>similarity(item.title+' '+item.body.slice(0,500),i.title+' '+i.body.slice(0,500))>0.45)
  const evidence = [
    '改了 '+(item.changedFiles??files.length)+' 个文件，新增 '+(item.additions??0)+' / 删除 '+(item.deletions??0)+' 行',
    testFiles.length?'有测试改动：'+testFiles.length+' 个文件':code?'有代码改动但没加测试':'未见测试改动（可能仅文档/配置）',
    ...failed.map(c=>'CI 失败: '+c.name),...pending.map(c=>'CI 未完成: '+c.name),
    !item.ci?.length?'CI/check 状态未知':'',
    ...suspicious.map(f=>'可疑/敏感改动：'+f.path+(f.patch&&/postinstall|preinstall|chmod|permissions:|curl|wget|exec\(/i.test(f.patch)?'（含安装/执行/权限线索）':'')),
    large?'改动规模大，建议拆分':'',
    item.draft?'草稿 PR，尚未准备合并':'',
    linked.length?'关联 issue：'+linked.map(i=>'#'+i.number).join(', ')+(match?'；文本有对应线索，未验证实际修复':'；文本对应性不足，需核对实际修复'):'未定位同仓库关联 issue（Fixes #n 等）',
    ...notes,
  ].filter(Boolean)
  const binary=suspicious.some(f=>/\.(?:exe|dll|so|dylib|bin)$/.test(f.path))
  const needsWork=!!(failed.length||pending.length||large||suspicious.length||code&&!testFiles.length||incomplete||item.draft||linked.length&&!match)
  return {kind:'pr',verdict:binary?'不建议合':needsWork?'改完再合':'值得合并',
    risk:binary||suspicious.length||large?'高':needsWork?'中':'低',suspicious:!!suspicious.length,
    priority:binary||suspicious.length||failed.length?'高':needsWork?'中':'低',
    reason:binary?'二进制变更难以审查，先提供可复现构建与来源':needsWork?'存在测试、CI、风险或证据缺口，处理后再审':'规则未发现阻塞项，仍须维护者审查实际实现',evidence:evidence.slice(0,40)}
}

