import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import ts from 'typescript'

// shortcut: one client entry with shell-only imports; use a bundler if runtime imports become local.
const source = await readFile('src/client.tsx', 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  fileName: 'client.tsx',
})
const imports = [...outputText.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1])
assert.deepEqual([...new Set(imports)].sort(), ['@deepseek-ai/dsh-client-ui-primitives', 'react'])
await writeFile('lib/client.js', `window.__ModuleLoader__.load({ id: 'dsh-apache-radar', factory: require => {
const module = { exports: {} }; const exports = module.exports;
${outputText}
return module.exports;
} });\n`)
