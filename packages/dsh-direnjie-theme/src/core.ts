export interface Options { enabled: boolean; musicPath: string; volume: number; loop: boolean; autoplay: boolean }
export const defaults: Readonly<Options> = Object.freeze({enabled:true,musicPath:'',volume:0.35,loop:true,autoplay:false})
export interface Boot extends Omit<Options,'musicPath'> { musicUrl: string }
export function bootScript(value: Boot): string {
 return `window.__DSH_DIRENJIE__=${JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')};`
}
export function byteRange(header: string | undefined, size: number): [number,number] | null {
 if (!header) return [0,size-1]
 const m = /^bytes=(\d*)-(\d*)$/.exec(header)
 if (!m || (!m[1] && !m[2])) return null
 const start = m[1] ? Number(m[1]) : Math.max(0,size-Number(m[2]))
 const end = m[1] ? (m[2] ? Math.min(size-1,Number(m[2])) : size-1) : size-1
 return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start>=0 && start<=end && start<size ? [start,end] : null
}
