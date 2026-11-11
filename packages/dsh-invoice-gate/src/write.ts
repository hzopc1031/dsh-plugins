import childProcess from 'node:child_process'
import { constants } from 'node:fs'
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises'
import { basename, dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path'

type Identity = { dev: number; ino: number }

// Like the reader, pin each ancestor in a private cwd; never change the host cwd.
const confinedWriter = `
const fs = require('node:fs')
const path = require('node:path')
const same = (a, b) => a.dev === b.dev && a.ino === b.ino
let stage
try {
  const request = JSON.parse(fs.readFileSync(0, 'utf8'))
  const expectedParent = path.resolve(process.argv[1])
  const ancestors = []
  for (const part of process.argv[1].split(path.sep).filter(Boolean)) {
    const directory = fs.openSync(part, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW)
    try {
      const expected = fs.fstatSync(directory, { bigint: true })
      process.chdir(part)
      if (!same(expected, fs.statSync('.', { bigint: true }))) throw new Error('path-outside-project')
      ancestors.push([process.cwd(), expected])
    } finally { fs.closeSync(directory) }
  }
  const parent = process.cwd()
  const parentIdentity = { dev: BigInt(request.parentIdentity.dev), ino: BigInt(request.parentIdentity.ino) }
  if (parent !== expectedParent || !same(fs.statSync('.', { bigint: true }), parentIdentity)) throw new Error('path-outside-project')
  stage = fs.mkdtempSync('.invoice-gate-' + (request.status ? 'status-' : ''))
  for (const [name, content] of request.files) {
    if (name.startsWith('originals/') && !fs.existsSync(stage + '/originals')) fs.mkdirSync(stage + '/originals')
    fs.writeFileSync(stage + '/' + name, Buffer.from(content, 'base64'), { flag: 'wx', mode: 0o600 })
  }
  let existing
  try { existing = fs.lstatSync(request.target) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  if (request.status) {
    if (existing ? !existing.isFile() || !request.identity || !same(existing, request.identity) : request.identity) throw new Error('status-file-replaced')
  } else if (existing) throw new Error('export-directory-exists-use-new-directory')
  if (fs.realpathSync('.') !== parent) throw new Error('path-outside-project')
  for (const [name, expected] of ancestors) {
    const current = fs.lstatSync(name, { bigint: true })
    if (!current.isDirectory() || !same(expected, current)) throw new Error('path-outside-project')
  }
  const source = request.status ? stage + '/status.md' : stage
  const identity = fs.lstatSync(source)
  // shortcut: single-operator rename; add coordination before supporting concurrent writers.
  fs.renameSync(source, request.target)
  if (!request.status) stage = undefined
  fs.writeFileSync(1, JSON.stringify({ dev: identity.dev, ino: identity.ino }))
} catch (error) {
  fs.writeFileSync(1, JSON.stringify({ error: error.code === 'ELOOP' ? 'path-outside-project' : error.message }))
  process.exitCode = 1
} finally {
  if (stage) fs.rmSync(stage, { recursive: true, force: true })
}
`

export async function writeConfined(root: string, destination: string, files: [string, Buffer][], status = false, identity?: Identity, pinnedParent?: FileHandle): Promise<Identity> {
  const target = resolve(root, destination)
  const inside = (value: string) => { const rel = relative(root, value); return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel) }
  if (!destination || isAbsolute(destination) || destination.includes('\0') || destination.split(/[\\/]/).includes('..') || target === root || !inside(target)) throw new Error('path-outside-project')
  const parent = dirname(target)
  if (!(await lstat(parent)).isDirectory()) throw new Error('path-outside-project')
  const handle = pinnedParent ?? await open(parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
  try {
    const parentIdentity = await handle.stat({ bigint: true })
    const canonicalParent = await realpath(parent)
    if (!inside(canonicalParent)) throw new Error('path-outside-project')
    for (const [name] of files) if (!/^(?:originals\/\d+\.[a-z0-9]{1,10}|report\.(?:md|xlsx)|export-report\.json|status\.md)$/i.test(name)) throw new Error('invalid-export-file')
    const anchor = parse(root).root
    return await new Promise<Identity>((accept, reject) => {
      const child = childProcess.spawn(process.execPath, ['--input-type=commonjs', '--eval', confinedWriter, '--', relative(anchor, canonicalParent)], {
        cwd: anchor, stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, NODE_OPTIONS: '' },
      })
      const chunks: Buffer[] = []
      child.stdout!.on('data', (chunk: Buffer) => chunks.push(chunk))
      child.stdout!.on('error', reject)
      child.stdin!.on('error', reject)
      child.on('error', reject)
      child.on('close', code => {
        try {
          const result = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (code === 0) accept(result)
          else reject(new Error(result.error))
        } catch { reject(new Error('confined-write-failed')) }
      })
      child.stdin!.end(JSON.stringify({ target: basename(target), files: files.map(([name, bytes]) => [name, bytes.toString('base64')]), status, identity, parentIdentity: { dev: parentIdentity.dev.toString(), ino: parentIdentity.ino.toString() } }))
    })
  } finally { if (!pinnedParent) await handle.close() }
}
