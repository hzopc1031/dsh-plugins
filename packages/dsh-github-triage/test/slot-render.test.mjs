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
test('rc.5 actual renderer loads the header contribution and dialog adapter displays dashboard',async t=>{
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
  const context={require,window,document,navigator,...globals,console,setTimeout,clearTimeout,queueMicrotask,URL,AbortController}
  let factory
  window.__ModuleLoader__={load:row=>{factory=row.factory}}
  vm.runInNewContext(readFileSync(require.resolve('@deepseek-ai/dsh-client-ui-renderer/client'),'utf8'),context)
  const renderer=factory(require)
  // Shared primitives ships one monolithic artifact with development-only CSS and
  // Markdown dependencies absent here. This adapter tests our registration and
  // dialog content, not the official Modal implementation (tsc checks its props).
  const Modal=({open,children,title,onClose,closeLabel})=>open?React.createElement('div',{role:'dialog','aria-label':title},children,React.createElement('button',{'aria-label':closeLabel,onClick:onClose},'关闭')):null
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),context)
  const client=factory(name=>name==='@deepseek-ai/dsh-client-ui-primitives'?{Modal}:require(name))
  ctx=new Context()
  renderer.apply(ctx)
  const binding={key:'smoke-session',ctx,hooks:{},keyedHooks:{},props:{sessionId:'smoke-session'}}
  const observable={getSnapshot:()=>binding,subscribe:()=>()=>{}}
  ctx.slots.installScope('session',{current:observable,bindingSource:()=>observable,renderArea:(_binding,{children})=>React.createElement(React.Fragment,null,children)})
  ctx.provide('remote',{commands:{execute:async()=>({ok:true,value:{result:{kind:'success',text:JSON.stringify({ok:true,data:{repositories:[],reports:[],jobs:[],model:{enabled:true,provider:'',model:'',available:false,warning:'未配置模型'},defaults:{limit:20,fullMax:100}}})}}})}})
  client.apply(ctx)
  // Declare the same list/session shape as ui-conversation/apply.ts at rc.5.
  ctx.slots.register({name:'root',children:{'conversation.session.header.actions':{kind:'list',scope:'session'}}},props=>React.createElement('div',null,props.renderSlot('conversation.session.header.actions',{})))

  await act(async()=>{unmount=ctx.uiRenderer.mount(document.getElementById('app'))})
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='GitHub 哨兵')
  assert.ok(button,'real rc.5 renderer must materialize the contributed action')
  await act(async()=>{button.click();await Promise.resolve()})
  assert.ok(document.querySelector('[role="dialog"][aria-label="GitHub 哨兵"]'))
  assert.match(document.body.textContent,/未配置模型/);assert.match(document.body.textContent,/仓库列表（0）/)
  const close=document.querySelector('[aria-label="关闭 GitHub 哨兵面板"]');assert.ok(close)
  await act(async()=>close.click());assert.equal(document.querySelector('[role="dialog"]'),null)
})
