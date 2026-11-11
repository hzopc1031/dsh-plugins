import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root=fileURLToPath(new URL('../',import.meta.url))
const {name}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'))
await build({
  absWorkingDir:root,entryPoints:['src/client.tsx'],outfile:'lib/client.js',bundle:true,
  platform:'browser',format:'cjs',target:'es2023',jsx:'automatic',
  external:['react','react/jsx-runtime','@deepseek-ai/cordis','@deepseek-ai/dsh-client-ui-primitives'],
  banner:{js:'window.__ModuleLoader__.load({id:'+JSON.stringify(name)+',factory:(require)=>{var module={exports:{}};var exports=module.exports;'},
  footer:{js:'return module.exports;}});'},legalComments:'inline',
})
