export function observed(body,source,seq=0,current=true,role='user') { return {seq,time:1000+seq,role,body,source,current} }
export function workspace(items,seq=0,current=true) {
  const changes=items.map(i=>({action:i.action??'set',scope:i.scope??'.\0AGENTS.md',path:i.path??'AGENTS.md',digest:i.digest??'file-digest'}))
  const body='<system-reminder>\n'+items.map((i,index)=>{
    const c=changes[index]
    if(c.action==='remove') return `Instructions removed: ${c.path}\n\nThe previously loaded instructions from this file no longer apply.`
    if(c.action==='replace') return `Updated instructions from: ${c.path}\n\nThis file changed after it was loaded. Use the following content instead of the previously loaded instructions from this file.\n\n${i.body}`
    return `Instructions from: ${c.path}\n\n${i.body}`
  }).join('\n\n')+'\n</system-reminder>'
  return observed(body,{kind:'agent-instructions',form:'instructions',changes},seq,current)
}
export const skill=(body,seq=0,current=true)=>observed(body,{kind:'skill',form:'instructions'},seq,current)
export const runtime=(sections,seq=0,current=true)=>observed('Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\n\n'+sections.map(s=>s.text).join('\n\n'),{kind:'runtime-context',form:'snapshot',sections},seq,current)
