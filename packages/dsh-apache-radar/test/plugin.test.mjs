import assert from 'node:assert/strict'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { apply, Config, inject, name } from '../index.js'
import { pluginContext } from './helpers.mjs'

const fakeAgent = cwd => {
  const restrictions = new Set()
  return { session: { header: { cwd } }, restrictions, ctx: { tools: { restrict: filter => {
    restrictions.add(filter)
    return () => restrictions.delete(filter)
  } } } }
}

test('bundle exports prefixed typed tools, commands and honest help; unload disposes registrations', async () => {
  assert.equal(name, 'apache-radar')
  assert.deepEqual(inject, ['commands', 'tools', 'agents'])
  assert.equal(typeof Config, 'function')
  const host = pluginContext()
  apply(host.ctx)
  assert.equal(host.command.name, 'apache-radar')
  assert.deepEqual([...host.tools.keys()], ['refresh', 'counts', 'watch', 'brief', 'open', 'lookup', 'security'].map(a => `apache_radar_${a}`))
  for (const tool of host.tools.values()) {
    assert.equal(tool.output.schema.type, 'string')
    assert.deepEqual(tool.output.render({}, 'summary'), [{ type: 'text', text: 'summary' }])
  }
  for (const rawInput of ['', ' help ']) {
    const result = await host.command.handler({ rawInput })
    assert.equal(result.kind, 'success')
    for (const phrase of ['本地', '多来源', 'URL', 'Asia/Singapore', 'Kafka / Hadoop / Flink', 'reporter.apache.org', '无需模型 API key', 'GitHub Releases 不作为权威来源', '退休口径也并列', 'refresh', 'brief', 'lookup']) assert.ok(result.text.includes(phrase))
  }
  assert.equal((await host.command.handler({ rawInput: 'unknown' })).kind, 'error')
  assert.equal((await host.command.handler({ rawInput: 'watch add' })).kind, 'error')
  assert.equal((await host.command.handler({ rawInput: 'counts ../escape' })).kind, 'error')
  assert.equal((await host.command.handler({ rawInput: 'counts' })).kind, 'error')
  await assert.rejects(host.tools.get('apache_radar_lookup').execute({}, {}), /query/)
  await assert.rejects(host.tools.get('apache_radar_watch').execute({ operation: 'invent' }, {}))
  host.dispose()
  assert.equal(host.tools.size, 0)
  assert.equal(host.command, undefined)
  assert.equal(host.guard, undefined)
  assert.equal(host.events.size, 0)
})

test('scoped restrict hides tools without a valid cwd, guard and executors reject escapes, later cwd changes lift only own restriction', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'radar-tools-'))
  const agent = fakeAgent(undefined)
  const host = pluginContext([agent])
  try {
    apply(host.ctx)
    const filter = [...agent.restrictions][0]
    assert.deepEqual(filter.deny, [...host.tools.keys()])
    assert.match(host.guard({ name: 'apache_radar_brief', agent }), /路径/)
    assert.equal(host.guard({ name: 'other_tool', agent }), undefined)
    const watch = host.tools.get('apache_radar_watch')
    await assert.rejects(watch.execute({}, { agent }), /当前目录/)
    agent.session.header.cwd = directory + '/missing/..'
    await assert.rejects(watch.execute({}, { agent }), /当前目录/)
    agent.session.header.cwd = directory
    await host.events.get('agent/pre-step')({ agent }, async () => 'next')
    assert.equal(agent.restrictions.size, 0)
    assert.equal(host.guard({ name: watch.name, agent }), undefined)
    assert.deepEqual(JSON.parse(await watch.execute({}, { agent })).watchList, ['kafka', 'hadoop', 'flink'])
    await assert.rejects(watch.execute({ directory: '/tmp' }, { agent }), /额外参数/)
    const alias = join(directory, 'alias')
    await symlink(directory, alias)
    agent.session.header.cwd = alias
    await assert.rejects(watch.execute({}, { agent }), /symlink/)
    agent.session.header.cwd = undefined
    host.events.get('agent/created')({ agent })
    assert.equal(agent.restrictions.size, 1)
    host.events.get('agent/disposed')({ agent })
    assert.equal(agent.restrictions.size, 0)
  } finally { host.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test('tools and commands persist watch edits, serialize shared-directory operations and return paths with explicit Markdown opt-in', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'radar-command-'))
  const agent = fakeAgent(directory)
  const host = pluginContext()
  try {
    apply(host.ctx)
    const tool = host.tools.get('apache_radar_watch')
    await Promise.all(['spark', 'beam'].map(project => tool.execute({ operation: 'add', project }, { agent })))
    const listed = JSON.parse(await tool.execute({}, { agent }))
    assert.deepEqual(listed.watchList, ['kafka', 'hadoop', 'flink', 'spark', 'beam'])
    const removed = await host.command.handler({ rawInput: 'watch remove spark', agent })
    assert.equal(removed.kind, 'success')
    assert.match(removed.text, /关注项目：kafka \/ hadoop \/ flink \/ beam/)
    assert.deepEqual(JSON.parse(await tool.execute({}, { agent })).watchList, ['kafka', 'hadoop', 'flink', 'beam'])
    const opened = await host.command.handler({ rawInput: 'open', agent })
    assert.equal(opened.kind, 'error')
    assert.match(opened.text, /尚无本地周报/)
  } finally { host.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test('effective workingDirectory service takes precedence over immutable initial cwd and scoped restrictions follow it', async () => {
  const initial = await mkdtemp(join(tmpdir(), 'radar-initial-'))
  const current = await mkdtemp(join(tmpdir(), 'radar-current-'))
  const agent = fakeAgent(initial)
  let effective = current
  const host = pluginContext([agent])
  host.ctx.get = name => name === 'workingDirectory' ? { get: session => {
    assert.equal(session, agent.session)
    return effective
  } } : undefined
  try {
    apply(host.ctx)
    const watch = host.tools.get('apache_radar_watch')
    const listed = JSON.parse(await watch.execute({ operation: 'add', project: 'spark' }, { agent }))
    assert.ok(listed.path.startsWith(current + '/'))
    assert.equal(agent.session.header.cwd, initial)
    effective = '/tmp/../escape'
    assert.match(host.guard({ name: watch.name, agent }), /路径逃逸/)
    await host.events.get('agent/pre-step')({ agent }, async () => undefined)
    assert.equal(agent.restrictions.size, 1)
    effective = initial
    await host.events.get('agent/pre-step')({ agent }, async () => undefined)
    assert.equal(agent.restrictions.size, 0)
    assert.deepEqual(JSON.parse(await watch.execute({}, { agent })).watchList, ['kafka', 'hadoop', 'flink'])
  } finally {
    host.dispose()
    await rm(initial, { recursive: true, force: true })
    await rm(current, { recursive: true, force: true })
  }
})

test('detect never writes settings; apply/clear use owning host config entry and preserve other fields', async () => {
  const { systemProxy, createSystemProxy } = await import('../lib/system-proxy.js')
  const originalDetect=systemProxy.detect,originalClear=systemProxy.clear
  const mock=createSystemProxy({platform:'win32',query:async()=> ' AutoConfigURL    REG_SZ    http://pac.example/a\n ProxyEnable    REG_DWORD    0x0',fetchPac:async()=>"function FindProxyForURL(){return 'PROXY user:secret@proxy:8080'}",resolve:async()=>null})
  Object.assign(systemProxy,mock)
  const host=pluginContext(),fiber={},entry={fiber,options:{id:'my-radar'}},writes=[]
  let handler,current={watchList:['kafka'],timeoutSeconds:45}
  host.ctx.fiber=fiber
  const editor={entries:()=>[entry],edit:async(e,change)=>{assert.equal(e,entry);current=change(current);writes.push({...current})}}
  host.ctx.get=name=>name==='configEditor'?editor:undefined
  host.ctx.inject=(_names,setup)=>setup({get:()=>({fetch:{register:route=>{handler=route.fetch;return()=>{}}}}),effect:setup=>setup()})
  try{
    apply(host.ctx)
    const request=action=>handler(new Request('http://localhost/api/apache-radar/dashboard',{method:'POST',body:JSON.stringify({action})}))
    const result=await (await request('detect-proxy')).json()
    assert.equal(result.proxy,'http://proxy:8080/');assert.equal(writes.length,0)
    assert.equal((await request('apply-proxy')).status,200)
    assert.deepEqual(writes[0],{watchList:['kafka'],timeoutSeconds:45,httpsProxy:'http://proxy:8080/'})
    assert.equal((await request('clear-proxy')).status,200)
    assert.deepEqual(writes[1],{watchList:['kafka'],timeoutSeconds:45,httpsProxy:''})
  }finally{systemProxy.detect=originalDetect;systemProxy.clear=originalClear;host.dispose()}
})
