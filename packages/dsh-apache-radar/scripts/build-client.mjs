import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import ts from 'typescript'

// shortcut: two fixed client modules; use a bundler if the client gains more local imports.
const source = await readFile('src/client.tsx', 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  fileName: 'client.tsx',
})
const imports = [...outputText.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1])
assert.deepEqual([...new Set(imports)].sort(), ['./network-settings.js', '@deepseek-ai/dsh-client-ui-primitives', 'react'])
const settings = ts.transpileModule(await readFile('lib/network-settings.js', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
}).outputText
await writeFile('lib/client.js', `window.__ModuleLoader__.load({ id: 'dsh-apache-radar', factory: hostRequire => {
const settings = { exports: {} };
((module, exports, require) => {${settings}\n})(settings, settings.exports, hostRequire);
const require = hostRequire;
const module = { exports: {} }; const exports = module.exports;
${outputText.replace('require("./network-settings.js")', 'settings.exports')}
return module.exports;
} });\n`)
