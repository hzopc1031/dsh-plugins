import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
const { name } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const output = await build({
  entryPoints: ['src/client.tsx'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', format: 'cjs', target: 'es2023', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-primitives'],
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
  legalComments: 'inline', metafile: true,
})

// Keep every bundled third-party license beside the shipped factory.
const upstreamLicense = (await readFile('LICENSE', 'utf8')).replace('Copyright (c) 2026 hzopc1031', 'Copyright (c) 2026 DeepSeek')
const notices = new Map([['DeepSeek Harness', '## DeepSeek Harness dsh-v0.2.1-rc.5\n\nLocal-link grammar adapted from file-link.ts (MIT):\nhttps://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.1-rc.5\n\n' + upstreamLicense]])
for (const input of Object.keys(output.metafile.inputs)) {
  if (!input.startsWith('node_modules/')) continue
  let directory = path.dirname(path.resolve(input))
  while (directory !== path.dirname(directory)) {
    try {
      const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
      if (manifest.name) {
        if (!notices.has(manifest.name)) {
          let license
          for (const file of ['license', 'LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
            try { license = await readFile(path.join(directory, file), 'utf8'); break } catch {}
          }
          if (!license) throw new Error('Missing bundled dependency license: ' + manifest.name)
          notices.set(manifest.name, `## ${manifest.name}@${manifest.version}\n\n${license.trim()}\n`)
        }
        break
      }
    } catch (error) {
      if (error.message?.startsWith('Missing bundled')) throw error
    }
    directory = path.dirname(directory)
  }
}
await writeFile('THIRD_PARTY_NOTICES.md', '# Bundled third-party licenses\n\n' + [...notices.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, text]) => text).join('\n'))
