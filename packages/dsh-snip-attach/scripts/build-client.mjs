import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
const { name } = JSON.parse(await readFile('package.json', 'utf8'))
await build({
  entryPoints: ['src/client.tsx'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', format: 'cjs', target: 'es2023', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/cordis'],
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' }, legalComments: 'inline',
})
