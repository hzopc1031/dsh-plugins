// Copy the checkout into an isolated test root, resolving packages from a real DSH install.
import { cp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const project = fileURLToPath(new URL('../', import.meta.url))
const host = path.resolve(process.argv[2])
const version = JSON.parse(await readFile(path.join(host, '@deepseek-ai/dsh/package.json'), 'utf8')).version
const root = path.join(project, '.tmp', `compat-${version}`)
await mkdir(root, { recursive: true })
for (const entry of ['src', 'lib', 'test', 'scripts', 'locale', 'index.js', 'package.json', 'tsconfig.json', 'cordis.patch.yml', 'icon.svg']) {
  await cp(path.join(project, entry), path.join(root, entry), { recursive: true })
}
try { await symlink(host, path.join(root, 'node_modules'), 'junction') } catch (e) { if (e.code !== 'EEXIST') throw e }
const pkg = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8'))
const inventory = {}
for (const name of Object.keys(pkg.devDependencies).filter(n => n.startsWith('@deepseek-ai/'))) {
  inventory[name] = JSON.parse(await readFile(path.join(host, name, 'package.json'), 'utf8')).version
}
await writeFile(path.join(root, 'host-inventory.json'), JSON.stringify({ host, version, inventory }, null, 2))
console.log(root)
console.log(inventory)
