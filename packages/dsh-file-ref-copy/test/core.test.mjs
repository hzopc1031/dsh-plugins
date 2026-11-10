import test from 'node:test'
import assert from 'node:assert/strict'
import { completedMarkdown, copyPath, extractReferences, parseLocalLink, pathForms } from '../lib/core.js'

for (const [destination, expected] of [
  ['资料/中文.md', { path: '资料/中文.md' }],
  ['docs/My%20Notes.md', { path: 'docs/My Notes.md' }],
  ['docs/%E4%B8%AD%E6%96%87.md#L24-L30', { path: 'docs/中文.md', line: 24, endLine: 30 }],
  ['C:%5Cwork%5Cfile.ts#L2', { path: 'C:\\work\\file.ts', line: 2 }],
  ['file%23name%3F.txt', { path: 'file#name?.txt' }],
  ['100%25%2520.txt', { path: '100%%20.txt' }],
]) test('官方本地链接规则：' + destination, () => assert.deepEqual(parseLocalLink(destination), expected))

test('中文空格绝对路径从原始 Markdown 提取，标签无需含路径', () => {
  const [ref] = extractReferences('[报告](<D:/项目 文件/中文 报告.md#L7-L9>)', 'D:/项目 文件')
  assert.equal(ref.path, 'D:/项目 文件/中文 报告.md')
  assert.equal(ref.label, '报告')
  assert.equal(copyPath(ref, 'absolute'), 'D:/项目 文件/中文 报告.md')
  assert.equal(copyPath(ref, 'relative'), '中文 报告.md')
  assert.equal(copyPath(ref, 'line'), 'D:/项目 文件/中文 报告.md#L7-L9')
})
test('工作区相对路径、..、百分号转义与带行号复制', () => {
  const [ref] = extractReferences('[源文件](../资料/My%20Notes.md#L24)', 'C:\\项目\\src')
  assert.equal(copyPath(ref, 'absolute'), 'C:/项目/资料/My Notes.md')
  assert.equal(copyPath(ref, 'relative'), '../资料/My Notes.md')
  assert.equal(copyPath(ref, 'line'), 'C:/项目/资料/My Notes.md#L24')
})
test('GFM 表格、引用式链接、代码标签、嵌套格式和图片标签', () => {
  const markdown = '| 文件 |\n| --- |\n| [**看** `源文件`][ref] |\n\n[ref]: docs/%E4%B8%AD%E6%96%87.md#L3\n\n[![图](https://site/img)](src/a.ts)'
  const refs = extractReferences(markdown, '/workspace')
  assert.equal(refs.length, 2)
  assert.equal(refs[0].label, '看 源文件')
  assert.equal(refs[0].absolute, '/workspace/docs/中文.md')
  assert.equal(refs[1].label, '图')
})
test('只提取实际链接，忽略代码块、行内代码、裸路径、图片与原始 HTML', () => {
  const md = '`[a](bad/a)`\n\n```md\n[b](bad/b)\n```\n\n![图](bad/c)\n\n<a href="bad/d">x</a>\n\nsrc/裸路径.ts\n\n[有效](src/ok.ts)'
  assert.deepEqual(extractReferences(md).map(r => r.path), ['src/ok.ts'])
})
test('同一路径同行范围去重，不同行范围分别保留', () => {
  const refs = extractReferences('[a](a.ts#L1) [b](a.ts#L1) [c](a.ts#L2) [d](a.ts)')
  assert.equal(refs.length, 3)
  assert.equal(copyPath(refs[2], 'line'), undefined)
})
for (const value of ['', '//site/file', '%2F%2Fsite/file', '%5C%5Cserver%5Cfile', 'https://site/a', 'mailto:a@b', 'file:///C:/a', 'vscode:open', 'javascript:alert', '%6Aavascript:alert', '#L2', 'a.ts?raw=1', 'a%ZZ.ts', 'a%00.ts', 'a%7F.ts', 'a.ts#title', 'a.ts#L0', 'a.ts#L3-L2', 'a.ts#L9007199254740992', 'a.ts#L1-L9007199254740992']) {
  test('排除 rc.5 不接受的目标：' + value, () => assert.equal(parseLocalLink(value), undefined))
}
test('百分号只解码一次，转义 # 与 ? 保留为文件名部分', () => {
  const [ref] = extractReferences('[x](docs/100%25%2520%23%3F.md#L8)', '/work')
  assert.equal(ref.absolute, '/work/docs/100%%20#?.md')
  assert.equal(copyPath(ref, 'line'), '/work/docs/100%%20#?.md#L8')
})
test('无工作区时保留相对路径，绝对路径不会猜工作区', () => {
  assert.deepEqual(pathForms('./src/a.ts'), { relative: 'src/a.ts' })
  assert.deepEqual(pathForms('src/a.ts', 'relative/root'), { relative: 'src/a.ts' })
  assert.deepEqual(pathForms('C:/a.ts'), { absolute: 'C:/a.ts' })
})
test('跨盘不生成伪相对路径；Windows 同盘大小写与 POSIX 根目录', () => {
  assert.deepEqual(pathForms('D:/other/a', 'C:/work'), { absolute: 'D:/other/a' })
  assert.deepEqual(pathForms('c:/WORK/资料/a', 'C:/work'), { absolute: 'c:/WORK/资料/a', relative: '资料/a' })
  assert.deepEqual(pathForms('/etc/a', '/'), { absolute: '/etc/a', relative: 'etc/a' })
})
test('Windows .. 不越过盘符根，根目录工作区仍产生正确相对路径', () => {
  assert.deepEqual(pathForms('../../../a.ts', 'C:/work'), { absolute: 'C:/a.ts', relative: '../a.ts' })
  assert.deepEqual(pathForms('C:/../../a.ts', 'C:/'), { absolute: 'C:/a.ts', relative: 'a.ts' })
})
test('仅按 messageId 取已加载已完成回答，忽略推理、工具和图片', () => {
  const nodes = [{ kind: 'assistant', messageId: 'a', blocks: [{ kind: 'text', text: '[x](src/a)' }, { kind: 'reasoning', text: '[secret](src/b)' }, { kind: 'text', text: '正文' }] }]
  assert.equal(completedMarkdown(nodes, 'a'), '[x](src/a)\n\n正文')
  assert.equal(completedMarkdown(nodes, 'unloaded'), undefined)
  assert.equal(completedMarkdown([{ ...nodes[0], interrupted: true }], 'a'), undefined)
  assert.equal(completedMarkdown([{ ...nodes[0], messageId: undefined }], 'a'), undefined)
})
