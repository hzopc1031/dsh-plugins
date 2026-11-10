import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {JSDOM} from 'jsdom'
import vm from 'node:vm'
const bundle=await readFile('lib/client.js','utf8')
function setup(){
 const dom=new JSDOM('<body><main class="mP3x-q_mainPanel">聊天</main></body>',{url:'http://localhost'})
 const {window}=dom;let api;let plays=0,pauses=0;let revoked=[]
 window.HTMLMediaElement.prototype.load=function(){}
 window.HTMLMediaElement.prototype.pause=function(){pauses++}
 window.HTMLMediaElement.prototype.play=function(){plays++;return Promise.reject(new Error('blocked'))}
 window.URL.createObjectURL=()=> 'blob:test';window.URL.revokeObjectURL=url=>revoked.push(url)
 window.__ModuleLoader__={load:({id,factory})=>{assert.equal(id,'dsh-direnjie-theme');api=factory(()=>{throw Error('unexpected runtime dependency')})}}
 vm.runInNewContext(bundle,{window,document:window.document,console})
 return {dom,window,api,get plays(){return plays},get pauses(){return pauses},revoked}
}
const boot={enabled:true,musicUrl:'/music/token',volume:.35,loop:true,autoplay:false}
test('actual client artifact: defaults, controls, selection, cleanup and reload',()=>{
 const s=setup();const doc=s.window.document
 const cleanup=s.api.mount(doc,boot,'body[data-direnjie]{color:green}')
 assert.equal(s.plays,0);assert.equal(doc.querySelector('summary').textContent,'神探狄仁杰 · 乐');assert.ok(doc.querySelector('audio').controls);assert.equal(doc.querySelector('audio').loop,true)
 assert.equal(doc.querySelector('audio').volume,.35);assert.equal(doc.querySelector('details').open,false)
 const input=doc.querySelector('input');Object.defineProperty(input,'files',{value:[new s.window.File(['x'],'test.wav')]});input.dispatchEvent(new s.window.Event('change'))
 assert.equal(doc.querySelector('audio').getAttribute('src'),'blob:test')
 cleanup();assert.deepEqual(s.revoked,['blob:test']);assert.equal(doc.querySelector('details'),null);assert.equal(doc.querySelector('style'),null);assert.equal(doc.body.hasAttribute('data-direnjie'),false)
 s.api.mount(doc,boot,'')();assert.equal(doc.querySelector('details'),null);s.dom.window.close()
})
test('disabled has no effects or playback',()=>{
 const s=setup();s.api.mount(s.window.document,{...boot,enabled:false},'')();assert.equal(s.window.document.querySelector('style'),null);assert.equal(s.plays,0);s.dom.window.close()
})
test('autoplay rejection and error are visible',async()=>{
 const s=setup();const cleanup=s.api.mount(s.window.document,{...boot,autoplay:true},'');await Promise.resolve();assert.equal(s.plays,1);assert.match(s.window.document.querySelector('[role=status]').textContent,/手动/)
 s.window.document.querySelector('audio').dispatchEvent(new s.window.Event('error'));assert.match(s.window.document.querySelector('[role=status]').textContent,/无法/);cleanup();s.dom.window.close()
})
test('plugin apply uses theme layer and registers reversible effects',()=>{
 const s=setup();const cleanup=[];let removed=false;let count=0
 s.window.__DSH_DIRENJIE__=boot
 const ctx={theme:{overrideTokens:(name,tokens)=>{assert.equal(name,'dsh-direnjie-theme');assert.ok(tokens['--dsw-alias-bg-base'].dark);count++;return ()=>removed=true}},effect:fn=>cleanup.push(fn())}
 s.api.apply(ctx);assert.equal(count,1);assert.ok(s.window.document.querySelector('style').textContent.includes('data:image/webp;base64,'))
 cleanup.reverse().forEach(fn=>fn());assert.equal(removed,true);assert.equal(s.window.document.querySelector('style'),null);s.dom.window.close()
})
