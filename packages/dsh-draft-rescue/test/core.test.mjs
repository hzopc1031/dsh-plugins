import test from 'node:test'
import assert from 'node:assert/strict'
import { copyText, draftText, listDrafts, prepareAppend, requireCapabilities } from '../lib/core.js'

const input = { draft: '', draftRev: 0, phase: 'plain', occurrences: [] }
const record = draft => JSON.stringify({ draft, view: null, viewRequest: null })
const storage = entries => ({ length: entries.length, key: i => entries[i][0], getItem: key => entries.find(e => e[0] === key)?.[1] ?? null })

test('列出非空 legacy 和 rc.5 结构草稿，保留原文空白与换行', () => {
  const text = '  中文🙂\r\n第二行  '
  assert.deepEqual(listDrafts(storage([
    ['dsh.conversation.b', record({ text, references: [] })],
    ['dsh.conversation.a', record('old draft')],
  ])), [{ sessionId: 'a', text: 'old draft' }, { sessionId: 'b', text }])
})
test('忽略空白草稿、非草稿键、无 sessionId 的键与扫描中已删除的记录', () => {
  assert.deepEqual(listDrafts(storage([
    ...['', ' \t\r\n'].map((draft, i) => ['dsh.conversation.' + i, record(draft)]),
    ['other', record('not draft')], ['dsh.conversation.', record('missing id')],
    ['dsh.conversation.missing', null],
  ])), [])
})

test('存储格式无法识别时整次扫描拒绝，不返回已扫描条目，不修改数据', () => {
  for (const raw of ['{', 'null', '{}', record(null), record({text:'x'}),
    JSON.stringify({draft:'x',view:null}), JSON.stringify({draft:'x',view:null,viewRequest:null,future:1}),
    JSON.stringify({draft:'x',view:1,viewRequest:null}), JSON.stringify({draft:'x',view:null,viewRequest:{view:'x',focus:1}})]) {
    const entries = [['dsh.conversation.a', record('valid')], ['dsh.conversation.b', raw]]
    const before = structuredClone(entries)
    assert.throws(() => listDrafts(storage(entries)), /已拒绝读取/)
    assert.deepEqual(entries, before)
  }
})

test('隐藏的旧空会话仍可找回；空的新会话不会显示；不修改存储或会话投影', () => {
  const entries = [['dsh.conversation.hidden-old-blank', record('尚未发送')], ['dsh.conversation.new-blank', record('')]]
  const before = structuredClone(entries)
  assert.deepEqual(listDrafts(storage(entries)), [{ sessionId: 'hidden-old-blank', text: '尚未发送' }])
  assert.deepEqual(entries, before)
})
test('能力检查不依赖版本标签；rc.5、rc.1 和未知版本使用相同有效接口', () => {
  for (const version of ['0.2.1-rc.5', '0.2.2-rc.1', 'unknown']) {
    assert.doesNotThrow(() => requireCapabilities({...input, release: {version}}, {insertText() {}}))
  }
})

test('输入接口或结构不符时在获取 storage 前拒绝', () => {
  for (const state of [undefined, {}, {...input,draftRev:NaN}, {...input,draftRev:-1},
    {...input,phase:'future'}, {...input,occurrences:[{length:2}]}]) {
    let read = false
    assert.throws(() => { requireCapabilities(state, {insertText(){}}); read=true }, /已拒绝读取/)
    assert.equal(read, false)
  }
  assert.throws(() => requireCapabilities(input, {}), /insertText/)
})

test('仅提取胶囊文字投影，未知字段拒绝', () => {
  const draft = { text: '看 文件', references: [{ source: 'file', ref: '/a', offset: 2, length: 2, label: '文件', clipboardText: '文件' }] }
  assert.equal(draftText(draft), '看 文件')
  assert.equal(draftText({...draft, attachments: ['unknown']}), undefined)
})

test('结构草稿拒绝无效或重叠引用与命令 token', () => {
  const ref = { source: 'file', ref: '/a', offset: 0, length: 2, label: 'aa', clipboardText: 'aa' }
  for (const references of [[{ ...ref, length: 3 }], [{ ...ref, offset: -1 }], [ref, ref], [{ ...ref, source: 1 }]]) {
    assert.equal(draftText({ text: 'aa', references }), undefined)
  }
  assert.equal(draftText({ text: 'aa', references: [], command: { token: '/bad' } }), undefined)
  assert.equal(draftText({ text: '/goal hello', references: [], command: { token: '/goal ' } }), '/goal hello')
})
test('剪贴板准备返回原文，绝不 trim 或转 Markdown', () => {
  const draft = { sessionId: 'id', text: '  [原文](url)\n\n🙂  ' }
  assert.equal(copyText(draft), draft.text)
})
test('空输入框追加原文，并使用 revision guard', () => {
  assert.deepEqual(prepareAppend({ sessionId: 'x', text: 'old' }, { draft: '', occurrences: [], phase: 'plain', draftRev: 9 }), {
    text: 'old', span: { start: 0, end: 0, draftRev: 9 },
  })
})
test('已有输入追加换行后原文，尾部折叠范围不替换现有选区', () => {
  assert.deepEqual(prepareAppend({ sessionId: 'x', text: 'old\n ' }, { draft: 'new🙂', occurrences: [], phase: 'plain', draftRev: 3 }), {
    text: '\nold\n ', span: { start: 5, end: 5, draftRev: 3 },
  })
})
test('当前输入框有引用胶囊时，尾部坐标按每个胶囊一字符计算', () => {
  assert.deepEqual(prepareAppend({ sessionId: 'x', text: 'old' }, { draft: '看 file.ts', occurrences: [{ occurrenceId: 1, source:'file', ref:'/file.ts', label:'file.ts', clipboardText:'file.ts', offset:2, length:7 }], phase: 'plain', draftRev: 1 }).span, { start: 3, end: 3, draftRev: 1 })
})
for (const phase of ['adjudicating', 'claimed', 'submitting', 'sending']) test('拒绝忙碌或命令输入框：' + phase, () => {
  assert.throws(() => prepareAppend({ sessionId: 'x', text: 'old' }, { draft: '', occurrences: [], phase, draftRev: 1 }), /普通输入/)
})
test('存储不可访问时报错，不伪装成零草稿', () => {
  assert.throws(() => listDrafts({ get length() { throw new Error('storage denied') } }), /storage denied/)
})

test('rc.1 quote snapshots validate normalized projection and all atomic span overlaps', () => {
  const text = 'before > first\n> second after'
  const quote = {offset:7, length:16, text:'first\r\nsecond'}
  assert.equal(draftText({text,references:[],quotes:[quote]}), text)
  assert.deepEqual(listDrafts(storage([['dsh.conversation.rc1',record({text,references:[],quotes:[quote]})]])), [{sessionId:'rc1',text}])
  for(const quotes of [null, {}, [{...quote,length:15}], [{...quote,offset:8}], [quote,quote], [{...quote,text:' '}], [{...quote,extra:1}]]) {
    assert.equal(draftText({text,references:[],quotes}), undefined)
  }
  assert.equal(draftText({text,quotes:[quote],references:[{source:'file',ref:'x',label:'first',clipboardText:'first',offset:9,length:5}]}), undefined)
  assert.equal(draftText({text:'/go > x',command:{token:'/go '},references:[],quotes:[{offset:4,length:3,text:'x'}]}), '/go > x')
})

test('0.2.2-rc.1 accepts the same draft schema', () => {
  const runtime = { release: { version: '0.2.2-rc.1' } }
  assert.deepEqual(listDrafts(storage([['dsh.conversation.a', record({ text: 'rc.1', references: [] })]]), runtime), [{ sessionId: 'a', text: 'rc.1' }])
})

test('rc.1 quote spans are validated and count as one position when appending', () => {
  const snapshot = { text: '> quoted\n尾', references: [], quotes: [{ text: 'quoted', offset: 0, length: 8 }] }
  assert.equal(draftText(snapshot), snapshot.text)
  const result = prepareAppend({ text: 'new' }, { draft: snapshot.text, occurrences: [], phase: 'plain', draftRev: 4 }, snapshot)
  assert.equal(result.span.start, 3)
  assert.equal(result.text, '\nnew')
  assert.equal(draftText({ ...snapshot, quotes: [{ ...snapshot.quotes[0], length: 9 }] }), undefined)
  assert.equal(draftText({ ...snapshot, quotes: [snapshot.quotes[0], snapshot.quotes[0]] }), undefined)
  assert.throws(() => prepareAppend({ text: 'new' }, { draft: 'changed', occurrences: [], phase: 'plain', draftRev: 4 }, snapshot), /不一致/)
  assert.throws(() => prepareAppend({ text: 'new' }, { draft: snapshot.text, occurrences: [], phase: 'plain', draftRev: 4 }, { ...snapshot, references: [{ source:'file', ref:'x', label:'尾', clipboardText:'尾', offset:9, length:1 }] }), /不一致/)
})

test('persisted quotes and references share atomic coordinates regardless of JSON property order', () => {
  const ref = { offset: 4, length: 4, source: 'file', ref: '/file', label: 'file', clipboardText: 'file' }
  const snapshot = { text: '> q file', references: [ref], quotes: [{ offset: 0, length: 3, text: 'q' }] }
  const occurrences = [{ occurrenceId: 1, clipboardText: 'file', label: 'file', ref: '/file', source: 'file', length: 4, offset: 4 }]
  const prepared = prepareAppend({ text: 'new' }, { draft: snapshot.text, occurrences, phase: 'plain', draftRev: 9 }, snapshot)
  assert.deepEqual(prepared, { text: '\nnew', span: { start: 3, end: 3, draftRev: 9 } })
})
