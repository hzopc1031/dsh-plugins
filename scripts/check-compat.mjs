import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
// Reuse semver already installed with the task-review development dependencies.
const semver = createRequire(new URL('../packages/dsh-task-review/package.json', import.meta.url))('semver')
const root = new URL('../packages/', import.meta.url)
const names = (await readdir(root)).filter(name => name.startsWith('dsh-')).sort()
assert.equal(names.length, 17)
let jsonCount = 0
for (const name of names) {
  const base = new URL(name + '/', root)
  const manifest = JSON.parse(await readFile(new URL('package.json', base), 'utf8')); jsonCount++
  assert.ok(semver.satisfies('0.2.2-rc.1', manifest.engines.dsh, { includePrerelease: true }), `${name}: ${manifest.engines.dsh}`)
  for (const file of await readdir(new URL('locale/', base))) if (file.endsWith('.json')) {
    JSON.parse(await readFile(new URL('locale/' + file, base), 'utf8')); jsonCount++
  }
}
for (const file of ['intranet-http.ts', 'system-proxy.ts', 'network-settings.ts']) {
  const copies = await Promise.all(['dsh-apache-radar', 'dsh-advisory-impact', 'dsh-github-triage'].map(name => readFile(new URL(name + '/src/' + file, root), 'utf8')))
  assert.equal(copies[0], copies[1], file); assert.equal(copies[0], copies[2], file)
}
console.log(`PASS: 17 engines admit DSH 0.2.2-rc.1; ${jsonCount} JSON files parse without BOM; 3 HTTP, 3 PAC and 3 network settings helper copies identical`)
