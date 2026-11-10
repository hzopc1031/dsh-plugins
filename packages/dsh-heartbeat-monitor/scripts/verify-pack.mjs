// Pack to a temp dir and check the exact file list: no tests, sources, secrets or temp files.
import { execFileSync } from 'node:child_process'
const out = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8', shell: process.platform === 'win32' }))
const files = out[0].files.map(f => f.path).sort()
const expected = ['CHANGELOG.md', 'LICENSE', 'README.md', 'cordis.patch.yml', 'icon.svg', 'index.d.ts', 'index.js',
  'lib/controller.d.ts', 'lib/controller.js', 'lib/core.d.ts', 'lib/core.js', 'lib/events.d.ts', 'lib/events.js',
  'lib/notify.d.ts', 'lib/notify.js', 'lib/plugin.d.ts', 'lib/plugin.js', 'locale/en.json', 'locale/zh.json', 'package.json'].sort()
const bad = files.filter(f => /(^|\/)(test|src|scripts|node_modules)\/|\.env|\.npmrc|\.tgz$|\.map$|token|secret/i.test(f))
if (JSON.stringify(files) !== JSON.stringify(expected) || bad.length) {
  console.error('unexpected pack contents', { files, bad })
  process.exit(1)
}
const pkg = JSON.parse(execFileSync('node', ['-p', 'JSON.stringify(require("./package.json"))'], { encoding: 'utf8' }))
const hooks = ['preinstall', 'install', 'postinstall', 'prepare'].filter(h => pkg.scripts?.[h])
if (hooks.length) { console.error('install scripts present:', hooks); process.exit(1) }
console.log(`verify-pack ok: ${files.length} files, ${out[0].size} bytes packed`)

