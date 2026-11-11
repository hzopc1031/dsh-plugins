import { build } from 'esbuild'
import assert from 'node:assert/strict'

const result = await build({
  entryPoints: ['src/client/index.tsx'],
  outfile: 'dist/client.js',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2023',
  external: ['react', 'zod'],
  metafile: true,
  banner: { js: 'window.__ModuleLoader__.load({id:"dsh-content-evidence",factory:(require)=>{const module={exports:{}};const exports=module.exports;' },
  footer: { js: 'return module.exports}});' },
})
assert.deepEqual(result.metafile.outputs['dist/client.js'].imports.map(item => item.path).sort(), ['react', 'zod'])
