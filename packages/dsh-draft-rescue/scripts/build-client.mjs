import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
const { name } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
await build({
  entryPoints: ['src/client.tsx'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', format: 'cjs', target: 'es2023', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-primitives'],
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
  legalComments: 'inline',
})
const upstreamLicense = (await readFile('LICENSE', 'utf8')).replace('Copyright (c) 2026 hzopc1031', 'Copyright (c) 2026 DeepSeek')
await writeFile('THIRD_PARTY_NOTICES.md', '# Third-party notice\n\nDraft decoding follows DeepSeek Harness dsh-v0.2.1-rc.5 and dsh-v0.2.2-rc.1 (MIT):\nhttps://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.1-rc.5\nhttps://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.2-rc.1\n\n' + upstreamLicense)
