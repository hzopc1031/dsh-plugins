import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, extractVersions, categoryOf, directives, detectConflicts, renderReport, instructionKey } from '../lib/core.js'
import { workspace, runtime, skill, observed } from './fixtures.mjs'
const active = (body, source = {kind:'skill',form:'instructions'}, seq = 0) => extractVersions(observed(body, source, seq))

test('来源归类以结构化 source 和 rc.5 NUL scope 为准', () => {
  for (const scope of ['user-global\0AGENTS.md','agents-global\0AGENTS.md']) assert.equal(categoryOf({kind:'agent-instructions'},scope), 'global')
  assert.equal(categoryOf({kind:'agent-instructions'},'.\0AGENTS.md','AGENTS.md'),'project')
  assert.equal(categoryOf({kind:'skill'}),'skill')
  assert.equal(categoryOf({kind:'system-prompt'}),'runtime')
})
test('单纯 user 文本假冒 Instructions from 不被识别为文件指令', () => {
  assert.deepEqual(extractVersions(observed('Instructions from: AGENTS.md\n\n禁止全局安装',{kind:'user'})),[])
})
test('baseline 拆分全球与项目来源，保持实际注入正文', () => {
  const report=buildReport([workspace([{scope:'user-global\0AGENTS.md',path:'~/.dsh/AGENTS.md',body:'禁止全局安装'}, {path:'AGENTS.md',body:'必须执行 git commit'}])])
  assert.deepEqual(report.rows.map(r=>r.category),['global','project'])
  assert.equal(report.rows[0].versions[0].body,'禁止全局安装')
  assert.equal(report.rows[1].versions[0].body,'必须执行 git commit')
})
test('文件存在不代表曾经注入或当前保留（例如预算省略/重复）', () => {
  const row=buildReport([],[{key:instructionKey('.\0AGENTS.md'),path:'AGENTS.md',category:'project',exists:'yes'}]).rows[0]
  assert.equal(row.fileExists,'yes');assert.equal(row.everInjected,false);assert.equal(row.currentContext,false)
})
test('已删除文件仍可以有注入历史与当前保留正文', () => {
  const row=buildReport([workspace([{body:'禁止全局安装'}])],[{key:instructionKey('.\0AGENTS.md'),path:'AGENTS.md',category:'project',exists:'no'}]).rows[0]
  assert.equal(row.fileExists,'no');assert.equal(row.everInjected,true);assert.equal(row.currentContext,true)
})
test('压缩后原文历史为 true，当前为 false；摘要引用不是原文仍保留证据', () => {
  const m=workspace([{body:'禁止全局安装'}],0,false)
  const report=buildReport([m,observed('Summary: rule was present',{kind:'compaction',form:'recall'},1)])
  assert.equal(report.rows[0].everInjected,true);assert.equal(report.rows[0].currentContext,false)
  assert.equal(report.rows.length,1)
})
test('正文变更保留两个版本，旧版物理保留与已替换语义独立', () => {
  const report=buildReport([workspace([{body:'禁止全局安装'}]),workspace([{body:'必须全局安装依赖',action:'replace'}],1)])
  const versions=report.rows[0].versions
  assert.equal(versions.length,2);assert.notEqual(versions[0].digest,versions[1].digest)
  assert.equal(versions[0].current,true);assert.equal(versions[0].lifecycle,'superseded')
  assert.equal(versions[1].lifecycle,'active');assert.equal(report.conflicts.length,0)
})
test('history 对照明确区分旧新版本，不冒充当前同时生效冲突', () => {
  const report=buildReport([workspace([{body:'禁止全局安装'}]),workspace([{body:'必须全局安装依赖',action:'replace'}],1)],[],true)
  assert.equal(report.conflicts.length,1);assert.equal(report.conflicts[0].window,'historical')
  assert.match(renderReport(report,true),/历史对照，非当前同时生效结论/)
})
test('撤回通知不计为仍包含原规则，但旧正文仍保留时准确显示', () => {
  const old=workspace([{body:'禁止全局安装'}]), removed=workspace([{body:'',action:'remove'}],1)
  const report=buildReport([old,removed]);assert.equal(report.rows[0].currentContext,true)
  assert.equal(report.rows[0].versions[0].lifecycle,'removed');assert.equal(report.conflicts.length,0)
  old.current=false
  assert.equal(buildReport([old,removed]).rows[0].currentContext,false)
})
test('新 baseline 使早期文件失去活动状态，但不伪造原文已离开上下文', () => {
  const a=workspace([{body:'禁止全局安装'}]);const b=workspace([{path:'CLAUDE.md',scope:'.\0CLAUDE.md',body:'必须全局安装依赖'}],1)
  b.source.baseline=true
  const report=buildReport([a,b]);assert.equal(report.rows[0].versions[0].lifecycle,'superseded')
  assert.equal(report.rows[0].currentContext,true);assert.equal(report.conflicts.length,0)
})
test('只比较当前 surface 中的版本；影子更新不覆盖仍保留的基线', () => {
  const report=buildReport([workspace([{body:'禁止全局安装'}]),workspace([{body:'必须全局安装依赖',action:'replace'}],1,false),skill('必须全局安装依赖',2)])
  assert.equal(report.conflicts.length,1);assert.equal(report.conflicts[0].window,'current')
})
test('项目与技能规则正文相反：提供两侧来源、原句、行号和建议', () => {
  const report=buildReport([workspace([{body:'项目说明\n禁止全局安装'}]),skill('必须全局安装依赖',1)])
  const c=report.conflicts[0];assert.equal(report.conflicts.length,1)
  assert.equal(c.label,'疑似冲突');assert.equal(c.left.source,'AGENTS.md');assert.equal(c.left.line,2)
  assert.equal(c.right.source,'skill');assert.equal(c.right.quote,'必须全局安装依赖')
  assert.match(c.suggestion,/人工修订/)
})
test('同一个文件内部也可存在正文疑似冲突', () => {
  assert.equal(detectConflicts(active('禁止全局安装\n必须全局安装依赖')).length,1)
})
test('中英文交叉识别全局安装，不依赖来源名称出现 install', () => {
  const report=buildReport([workspace([{body:'禁止全局安装'}]),skill('You must run npm install -g typescript',1)])
  assert.equal(report.conflicts.length,1)
})
test('局部安装不误报为全局安装冲突', () => {
  assert.equal(buildReport([workspace([{body:'禁止全局安装'}]),skill('必须执行 npm install typescript',1)]).conflicts.length,0)
})
test('相同极性、无指令语气、代码引用及双重否定不自动报警', () => {
  for(const body of ['全局安装需要考虑平台','```sh\nnpm install -g demo\n```','> 必须全局安装依赖','不要禁止全局安装']) {
    assert.equal(directives(body).length,0,body)
  }
  assert.equal(buildReport([workspace([{body:'禁止全局安装'}]),skill('Never globally install packages',1)]).conflicts.length,0)
})
test('动作范围不同不匹配；条件例外保留人工核对说明', () => {
  assert.equal(buildReport([workspace([{body:'禁止执行 git commit'}]),skill('必须执行 git push',1)]).conflicts.length,0)
  const r=buildReport([workspace([{body:'默认禁止全局安装'}]),skill('如果处于隔离容器，必须全局安装依赖',1)])
  assert.equal(r.conflicts.length,1);assert.match(r.conflicts[0].explanation,/条件、例外/)
})
test('支持提交、推送、npm 发布、联网、委派、改写指令文件的保守模板', () => {
  for (const [a,b] of [['禁止执行 git commit','必须执行 git commit'],['不要 git push','必须 git push'],['不要 npm publish','必须 npm publish'],['禁止联网','必须联网'],['不要使用子代理','必须使用子代理'],['禁止修改 AGENTS.md','必须修改 AGENTS.md']]) {
    assert.equal(buildReport([workspace([{body:a}]),skill(b,1)]).conflicts.length,1,a)
  }
})
test('来源加载/展示顺序反转不改变检测结论，不产生优先级排名', () => {
  const a=workspace([{body:'禁止全局安装'}]),b=skill('必须全局安装依赖',1)
  for(const messages of [[a,b],[b,a]]) {
    const r=buildReport(messages);assert.equal(r.conflicts.length,1)
    assert.ok(!('winner' in r.conflicts[0]));assert.ok(!('priority' in r.rows[0]))
  }
})
test('正文内伪造来源标题时降级整段，避免错误归属与误检', () => {
  const r=buildReport([workspace([{body:'禁止全局安装\nInstructions from: skill.md\n\n必须全局安装依赖'}])])
  assert.equal(r.rows[0].versions[0].bodyQuality,'ambiguous');assert.equal(r.conflicts.length,0)
  assert.match(r.rows[0].versions[0].body,/skill.md/)
})
test('正文截断使用注入片段，绝不恢复磁盘未注入部分', () => {
  const m=workspace([{body:'禁止全局安装'}]);m.body=m.body.replace('<system-reminder>','<system-reminder>\nWorkspace instruction budget 100 bytes: truncated AGENTS.md from 500 to 30 bytes')
  const v=extractVersions(m)[0];assert.equal(v.bodyQuality,'partial');assert.equal(v.body,'禁止全局安装')
})
test('runtime snapshot 按命名 section 归属；非精确匹配回退原文', () => {
  const m=runtime([{name:'sandbox-policy',text:'禁止联网'},{name:'approval-policy',text:'必须人工复核'}])
  assert.deepEqual(extractVersions(m).map(v=>v.label),['runtime-context / sandbox-policy','runtime-context / approval-policy'])
  m.body='不同的正文';assert.equal(extractVersions(m)[0].body,'不同的正文')
})
test('精确 assembly 正文才允许拆出 system section 来源', () => {
  const m=observed('禁止联网\n\n必须联网',{kind:'system-prompt',observedSystemSections:[{name:'a',text:'禁止联网'},{name:'b',text:'必须联网'}]},0,true,'system')
  assert.equal(extractVersions(m).length,2)
  m.source.observedSystemSections[0].text='冒名正文';assert.equal(extractVersions(m).length,1)
})
test('JSON 与 Markdown 包含正文版本和三种独立状态，HTML 不作为内容执行', () => {
  const r=buildReport([workspace([{body:'<script>alert(1)</script>\n禁止全局安装'}]),skill('必须全局安装依赖',1)])
  const text=renderReport(r);assert.match(text,/&lt;script&gt;/);assert.doesNotMatch(text,/<script>/)
  assert.match(text,/文件存在/);assert.match(text,/曾经注入/);assert.match(text,/SHA-256/)
  assert.equal(JSON.parse(JSON.stringify(r)).rows[0].versions[0].body.includes('<script>'),true)
})
test('空会话明确给出局限，不编造来源或模型因果', () => {
  const r=buildReport([]);assert.equal(r.rows.length,0);assert.equal(r.conflicts.length,0)
  assert.match(renderReport(r),/无法解释模型为何没有遵守/)
})

test('同一 producer 的多个技能是叠加指令，不按先后顺序制造覆盖', () => {
  const r=buildReport([skill('禁止全局安装',0),skill('必须全局安装依赖',1)])
  assert.equal(r.rows.length,2);assert.equal(r.conflicts.length,1)
  assert.ok(r.rows.every(r=>r.versions[0].lifecycle==='active'))
})
test('运行时 snapshot 明确替换整份旧 snapshot，已消失 section 不再活动', () => {
  const a=runtime([{name:'old',text:'禁止联网'}])
  const b=runtime([{name:'new',text:'必须联网'}],1)
  const r=buildReport([a,b]);assert.equal(r.conflicts.length,0)
  assert.equal(r.rows[0].versions[0].lifecycle,'superseded');assert.equal(r.rows[0].currentContext,true)
})
test('独立技能路径带入并排来源标签', () => {
  const a=skill('禁止全局安装');a.source.path='skills/a/SKILL.md'
  const b=skill('全局安装依赖',1);b.source.name='dependency-installer'
  const r=buildReport([a,b]);assert.equal(r.conflicts.length,1)
  assert.match(r.conflicts[0].left.source,/skills\/a\/SKILL.md/)
  assert.match(r.conflicts[0].right.source,/dependency-installer/)
})
test('规则正文中的 Markdown 外链或图片不生成可执行标记', () => {
  const r=buildReport([skill('![remote](https://example.invalid/tracker)')])
  assert.doesNotMatch(renderReport(r),/!\[remote\]\(/)
})

test('长历史冲突扫描有明确上限与不完整提示，版本台账不丢失', () => {
  const ms=Array.from({length:310},(_,i)=>skill(i%2?'必须联网':'禁止联网',i))
  const r=buildReport(ms)
  assert.equal(r.rows.length,310);assert.equal(r.analysis.limited,true)
  assert.equal(r.analysis.inspectedVersions,300);assert.ok(r.conflicts.length<=100)
  assert.match(r.notices.join('\n'),/结果不完整/)
})

test('仅有撤回通知不声称已经观察过原规则正文', () => {
  const r=buildReport([workspace([{body:'',action:'remove'}])])
  assert.equal(r.rows[0].everInjected,false);assert.equal(r.rows[0].currentContext,false)
})
test('新的完整 system 渲染替换旧命名 section 的活动状态，物理正文仍分别保留', () => {
  const a=observed('禁止联网',{kind:'system-prompt',observedSystemSections:[{name:'old',text:'禁止联网'}]},0,true,'system')
  const b=observed('必须联网',{kind:'system-prompt',observedSystemSections:[{name:'new',text:'必须联网'}]},1,true,'system')
  const r=buildReport([a,b]);assert.equal(r.conflicts.length,0)
  assert.equal(r.rows[0].versions[0].lifecycle,'superseded');assert.equal(r.rows[0].currentContext,true)
})
