import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { Boot } from './core.js'
import { tokens } from './tokens.js'
// Replaced with original SVG/CSS text at build time, with no network assets.
declare const THEME_CSS: string
declare global { interface Window { __DSH_DIRENJIE__?: Boot } }
export const name='dsh-direnjie-theme'
export const inject=['theme']
/** Kept separate for lifecycle tests without launching DSH. */
export function mount(doc: Document, boot: Boot, css: string): () => void {
 if (!boot.enabled) return () => {}
 const style=doc.createElement('style'); style.dataset.plugin=name; style.textContent=css; doc.head.append(style)
 const old=doc.body.getAttribute('data-direnjie'); doc.body.setAttribute('data-direnjie','')
 const panel=doc.createElement('details'); panel.id='direnjie-music'; panel.setAttribute('aria-label','长安听雨音乐播放器')
 const title=doc.createElement('summary'); title.textContent='长安听雨 · 乐'; panel.append(title)
 const audio=doc.createElement('audio'); audio.controls=true; audio.preload='none'; audio.volume=Math.min(1,Math.max(0,boot.volume)); audio.loop=boot.loop
 const status=doc.createElement('p'); status.setAttribute('role','status'); status.textContent=boot.musicUrl ? '本机音乐已配置，点击播放。' : '选择本机音频，或配置 musicPath 后重启。'
 const label=doc.createElement('label'); label.textContent='选择本机音频 '
 const input=doc.createElement('input'); input.type='file'; input.accept='.mp3,.wav,.ogg,.m4a,.flac,audio/*'; label.append(input)
 const win=doc.defaultView; let objectUrl: string | undefined; let disposed=false
 const release=(): void => { if (objectUrl) {win?.URL.revokeObjectURL(objectUrl); objectUrl=undefined} }
 const load=(url:string): void => {audio.pause(); audio.src=url; audio.load()}
 const select=(): void => {
  const file=input.files?.[0]; if (!file || !win) return
  release(); objectUrl=win.URL.createObjectURL(file); load(objectUrl); status.textContent='已选择本机音频，点击播放。'
 }
 const error=(): void => {status.textContent='无法读取或解码音频，请检查路径、格式，或选择其他本机文件。'}
 input.addEventListener('change',select); audio.addEventListener('error',error)
 panel.append(audio,label,status); doc.body.append(panel)
 if (boot.musicUrl) {
  load(boot.musicUrl)
  if (boot.autoplay) void audio.play().catch(()=>{if (!disposed) status.textContent='自动播放被阻止，请手动点击播放。'})
 }
 return () => {
  disposed=true; input.removeEventListener('change',select); audio.removeEventListener('error',error)
  audio.pause(); audio.removeAttribute('src'); audio.load(); release(); panel.remove(); style.remove()
  if (old===null) doc.body.removeAttribute('data-direnjie'); else doc.body.setAttribute('data-direnjie',old)
 }
}
export function apply(ctx: Context): void {
 const boot=window.__DSH_DIRENJIE__
 if (!boot?.enabled) return
 ctx.effect(()=>ctx.theme.overrideTokens(name,tokens))
 ctx.effect(()=>mount(document,boot,THEME_CSS))
}
