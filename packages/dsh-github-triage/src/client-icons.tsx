import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import type { ComponentType } from 'react'
type Icon=ComponentType<{size?:number;className?:string}>
function resolve(name:string):Icon {
  try{const found=(primitives as unknown as Record<string,unknown>)[name];if(typeof found==='function')return found as Icon}catch{}
  return ()=>null
}
export const Branch=resolve('IconBranchOutlineRegular')
export const Plus=resolve('IconPlusOutlineRegular')
export const Settings=resolve('IconSettingsOutlineMedium')
export const Search=resolve('IconSearchOutlineRegular')
export const Clock=resolve('IconClockOutlineRegular')
export const Check=resolve('IconCheckOutlineRegular')
export const ChevronDown=resolve('IconChevronDownOutlineRegular')
