import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {createPortal} from 'react-dom'
const require=createRequire(import.meta.url)

// Execute the exact shipped rc.5 component regions in memory. The monolithic
// ESM entry also imports unrelated Markdown/highlighter packages absent in this
// borrowed dependency tree. No component is reimplemented or vendored here.
// CSS modules become class maps: this harness proves behavior, never appearance.
export function primitivesFixture(){
  const source=readFileSync(require.resolve('@deepseek-ai/dsh-client-ui-primitives'),'utf8')
  const regions=['icons/shared-artwork','icons/index','Button','Pill','SegmentedTabs','Tag','Checkbox','Input',
    'overlay-top-margin','keyboard-composition','focus','useModalLayer','ShortcutKeys','MenuSurface','Menu','Modal','settings-form/fields']
  const parts=regions.map(name=>{
    const marker='//#region lib/types/'+name+'.js'
    const start=source.indexOf(marker),end=source.indexOf('//#endregion',start)
    if(start<0||end<0)throw Error('rc.5 component region missing: '+name)
    return source.slice(start,end)
  })
  const css={}
  for(const [,name] of source.matchAll(/import (\w+(?:\$\d+)?) from "[^"]+\.css"/g))
    css[name]=new Proxy({},{get:(_,key)=>'official-'+name+'-'+String(key)})
  const scope={...React,...jsxRuntime,...css,createPortal,clsx:(...values)=>values.filter(Boolean).join(' '),
    window,document,navigator,Node,Element,HTMLElement,HTMLIFrameElement,getComputedStyle,
    setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame,cancelAnimationFrame,console}
  return vm.runInNewContext(parts.join('\n')+'\n;({Button,Input,Modal,Menu,SegmentedTabs,Pill,Tag,Checkbox,SettingsValueField,IconChevronDownOutlineRegular,IconBranchOutlineRegular,IconPlusOutlineRegular,IconSettingsOutlineMedium,IconSearchOutlineRegular,IconClockOutlineRegular})',scope)
}

export function domGlobals(dom){
  // React DOM was imported before the per-test document, so its legacy change
  // detector asks for these IE names on focus. Adapt them to jsdom listeners.
  dom.window.HTMLElement.prototype.attachEvent=function(name,listener){this.addEventListener(name.slice(2),listener)}
  dom.window.HTMLElement.prototype.detachEvent=function(name,listener){this.removeEventListener(name.slice(2),listener)}
  return Object.fromEntries(['window','document','navigator','Node','Element','HTMLElement','HTMLIFrameElement',
    'MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,key==='window'?dom.window:
    typeof dom.window[key]==='function'&&['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]]))
}
