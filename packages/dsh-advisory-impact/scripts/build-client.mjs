import ts from 'typescript'
import { readFile, writeFile } from 'node:fs/promises'

const commonjs = async (name) =>
  ts.transpileModule(await readFile(`lib/${name}.js`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 }
  }).outputText
const model = await commonjs('panel-model'),
  client = await commonjs('client')
const css = await readFile('src/panel.css', 'utf8')
// DSH materializes this factory lazily; React must retain the host's identity.
await writeFile(
  'lib/client.js',
  `window.__ModuleLoader__.load({id:'dsh-advisory-impact',factory:(hostRequire)=>{
const PANEL_CSS=${JSON.stringify(css)};
const model={exports:{}};
((module,exports)=>{${model}\n})(model,model.exports);
const require=id=>id==='./panel-model.js'?model.exports:hostRequire(id);
const module={exports:{}};const exports=module.exports;
${client}
return module.exports;
}});\n`
)
