/** Actual rc.5 lazy-CJS renderer, with finite session and Modal DOM adapters. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import React,{act} from 'react'
import { Context } from '@deepseek-ai/cordis'
const require=createRequire(import.meta.url)
test('rc.5 actual renderer materializes sidebar, root page and header navigation without an agent',async t=>{
  const dom=new JSDOM('<main id="app"></main>',{url:'https://dsh.invalid'}),saved=new Map()
  const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
    HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,MutationObserver:dom.window.MutationObserver,
    getComputedStyle:dom.window.getComputedStyle,IS_REACT_ACT_ENVIRONMENT:true}
  for(const [key,value] of Object.entries(globals)){
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})
  }
  let ctx,unmount
  t.after(async()=>{
    await act(async()=>unmount?.());await ctx?.fiber.dispose();dom.window.close()
    for(const [key,value] of saved){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key]}
  })
  const context={require,window,document,navigator,...globals,console,setTimeout,clearTimeout,queueMicrotask,URL,AbortController,AbortSignal,
    fetch:async()=>Response.json({ok:true,value:{repositories:[],reports:[],jobs:[],model:{enabled:true,provider:'',model:'',available:false,warning:'未配置模型'},defaults:{limit:20,fullMax:100}}})}
  let factory
  window.__ModuleLoader__={load:row=>{factory=row.factory}}
  vm.runInNewContext(readFileSync(require.resolve('@deepseek-ai/dsh-client-ui-renderer/client'),'utf8'),context)
  const renderer=factory(require)
  // Shared primitives ships one monolithic artifact with development-only CSS and
  // Markdown dependencies absent here. This adapter tests our registration and
  // dialog content, not the official Modal implementation (tsc checks its props).
  const Modal=({open,children,title,onClose,closeLabel})=>open?React.createElement('div',{role:'dialog','aria-label':title},children,React.createElement('button',{'aria-label':closeLabel,onClick:onClose},'关闭')):null
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),context)
  const Input=({className,...props})=>React.createElement('span',{className},React.createElement('input',props))
  const client=factory(name=>name==='@deepseek-ai/dsh-client-ui-primitives'?{Modal,Input}:require(name))
  ctx=new Context()
  renderer.apply(ctx)
  ctx.slots.installLocale({getSnapshot:()=>({revision:0}),subscribe:()=>()=>{},bind:()=>key=>key})
  const binding={key:'smoke-session',ctx,hooks:{},keyedHooks:{},props:{sessionId:'smoke-session'}}
  const observable={getSnapshot:()=>binding,subscribe:()=>()=>{}}
  ctx.slots.installScope('session',{current:observable,bindingSource:()=>observable,renderArea:(_binding,{children})=>React.createElement(React.Fragment,null,children)})
  const navigation=[]
  ctx.provide('layout',{selectPanel:id=>navigation.push(id)})
  ctx.provide('remote',{commands:{execute:async()=>{throw Error('main page must never need an agent')}}})
  client.apply(ctx)
  // Real official registry; the fixture supplies the three owning shell seats.
  ctx.slots.register({name:'root',children:{'main':{kind:'keyed',scope:'root'},'sidebar.panellist':{kind:'list',scope:'root'},'conversation.session.header.actions':{kind:'list',scope:'session'}}},props=>React.createElement('div',null,
    props.renderSlot('sidebar.panellist',{size:18,active:true}),
    props.renderSlot('conversation.session.header.actions',{}),
    props.renderSlot('main',{}, {entryKey:'dsh-github-triage'})))

  await act(async()=>{unmount=ctx.uiRenderer.mount(document.getElementById('app'))})
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='GitHub 哨兵')
  assert.ok(button,'real rc.5 renderer must materialize the contributed action')
  assert.ok(ctx.slots.entriesOfSlot('sidebar.panellist').some(e=>e.options.id==='dsh-github-triage'))
  assert.ok(document.querySelector('.gt-page'));assert.equal(document.querySelectorAll('.gt-stat').length,6)
  assert.equal(document.querySelectorAll('style[data-github-triage]').length,1)
  await act(async()=>{button.click();await Promise.resolve()})
  assert.deepEqual(navigation,['dsh-github-triage']);assert.equal(document.querySelector('[role="dialog"]'),null)
  assert.match(document.body.textContent,/未配置模型/);assert.match(document.body.textContent,/仓库列表（0）/)
  await act(async()=>{unmount();unmount=undefined});await ctx.fiber.dispose()
  assert.equal(document.querySelector('style[data-github-triage]'),null)
})
