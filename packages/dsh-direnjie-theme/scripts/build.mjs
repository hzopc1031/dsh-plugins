import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
// Original AI illustration (no film stills), inlined so the client bundle needs no network or file access.
const art=(await readFile('assets/direnjie.webp')).toString('base64')
const css=(await readFile('src/theme.css','utf8')).replaceAll('__ART__',`data:image/webp;base64,${art}`)
await build({entryPoints:['src/client.ts'],outfile:'lib/client.js',bundle:true,format:'cjs',platform:'browser',target:'es2022',define:{THEME_CSS:JSON.stringify(css)},banner:{js:'window.__ModuleLoader__.load({id:"dsh-direnjie-theme",factory:(require)=>{const module={exports:{}};const exports=module.exports;'},footer:{js:'return module.exports;}});'}})
