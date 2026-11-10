import test from 'node:test'
import assert from 'node:assert/strict'
import { copyText, draftText, listDrafts, prepareAppend, requireVersion } from '../lib/core.js'

const boot = { release: { version: '0.2.1-rc.5' } }
const record = draft => JSON.stringify({ draft, view: null, viewRequest: null })
const storage = entries => ({ length: entries.length, key: i => entries[i][0], getItem: key => entries.find(e => e[0] === key)?.[1] ?? null })

test('列出非空 legacy 和 rc.5 结构草稿，保留原文空白与换行', () => {
  const text = '  中文🙂\r\n第二行  '
  assert.deepEqual(listDrafts(storage([
    ['dsh.conversation.b', record({ text, references: [] })],
    ['dsh.conversation.a', record('old draft')],
  ]), boot), [{ sessionId: 'a', text: 'old draft' }, { sessionId: 'b', text }])
})
test('忽略空白草稿、非草稿键、无 sessionId 的键与损坏 JSON', () => {
  const values = ['', ' \t\r\n', null, {}, { text: 'x' }, { text: 5, references: [] }]
  assert.deepEqual(listDrafts(storage([
    ...values.map((draft, i) => ['dsh.conversation.' + i, record(draft)]),
    ['dsh.conversation.bad', '{'], ['other', record('not draft')],
    ['dsh.conversation.', record('missing id')], ['dsh.conversation.missing', null],
  ]), boot), [])
})
test('隐藏的旧空会话仍可找回；空的新会话不会显示；不修改存储或会话投影', () => {
  const entries = [['dsh.conversation.hidden-old-blank', record('尚未发送')], ['dsh.conversation.new-blank', record('')]]
  const before = structuredClone(entries)
  assert.deepEqual(listDrafts(storage(entries), boot), [{ sessionId: 'hidden-old-blank', text: '尚未发送' }])
  assert.deepEqual(entries, before)
})
for (const value of [undefined, null, {}, { release: {} }, { release: { version: '0.2.2' } }, { release: { version: '0.2.1-rc.4' } }, { release: { version: '0.2.1-rc.5+custom' } }]) {
  test('版本锁失败且完全不触碰 storage：' + JSON.stringify(value), () => {
    const trap = new Proxy({}, { get() { assert.fail('version check must run before storage') } })
    assert.throws(() => listDrafts(trap, value), /拒绝读取/)
  })
}
test('精确版本通过', () => assert.doesNotThrow(() => requireVersion(boot)))
test('仅提取胶囊文字投影，不恢复 references 和附件', () => {
  assert.equal(draftText({ text: '看 文件', references: [{ source: 'file', ref: '/a', offset: 2, length: 2, label: '文件', clipboardText: '文件' }], attachments: ['ignored'] }), '看 文件')
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
  assert.deepEqual(prepareAppend({ sessionId: 'x', text: 'old' }, { draft: '看 file.ts', occurrences: [{ length: 7 }], phase: 'plain', draftRev: 1 }).span, { start: 3, end: 3, draftRev: 1 })
})
for (const phase of ['adjudicating', 'claimed', 'submitting']) test('拒绝忙碌或命令输入框：' + phase, () => {
  assert.throws(() => prepareAppend({ sessionId: 'x', text: 'old' }, { draft: '', occurrences: [], phase, draftRev: 1 }), /普通输入/)
})
test('存储不可访问时报错，不伪装成零草稿', () => {
  assert.throws(() => listDrafts({ get length() { throw new Error('storage denied') } }, boot), /storage denied/)
})
