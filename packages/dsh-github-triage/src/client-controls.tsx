import {useState,type AriaAttributes} from 'react'
import {Button,Menu,IconChevronDownOutlineRegular} from '@deepseek-ai/dsh-client-ui-primitives'

export const modeOptions=[['both','issues 与 PR'],['issues','仅 issues'],['prs','仅 PR']] as const
export const modeLabels={both:'issues 与 PR',issues:'仅 issues',prs:'仅 PR'} as const

// rc.5 and rc.1 export Menu, not Select. Keep selection state in the form;
// delegate placement, dismissal, keyboard walking and focus return to Menu.
export function Choice({label,value,options,onChange,id,disabled=false,...aria}:{
  label:string;value:string;options:readonly (readonly [string,string])[]
  onChange:(value:string)=>void;id?:string;disabled?:boolean
}&Pick<AriaAttributes,'aria-invalid'|'aria-describedby'>){
  const [open,setOpen]=useState(false)
  return <Menu open={open&&!disabled} portal minWidthFromAnchor autoFocus
    className="gt-choice" listClassName="gt-choice-menu" selectedId={value}
    items={options.map(([id,label])=>({id,label}))}
    onClose={()=>setOpen(false)} onSelect={next=>{onChange(next);setOpen(false)}}
    anchor={<Button id={id} variant="outline" disabled={disabled} aria-label={label}
      aria-haspopup="menu" aria-expanded={open&&!disabled} {...aria}
      onClick={()=>setOpen(v=>!v)}>
      <span>{options.find(([key])=>key===value)?.[1]??value}</span>
      <IconChevronDownOutlineRegular size={16}/>
    </Button>}/>
}
