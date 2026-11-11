import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WorkspaceAnalyzer, FaceModelEmitter, writePackageArtifacts } from '@deepseek-ai/dsh-typert-generator'

const packageDir = fileURLToPath(new URL('../', import.meta.url))
await mkdir(join(packageDir, '.tmp'), { recursive: true })
const root = await mkdtemp(join(packageDir, '.tmp/typert-'))
try {
  // The host generator requires workspace layout with dependencies outside the contributing package.
  const staged = join(root, 'packages/dsh-content-evidence')
  await mkdir(staged, { recursive: true })
  for (const name of ['src', 'package.json', 'tsconfig.json']) {
    await cp(join(packageDir, name), join(staged, name), { recursive: true })
  }
  await symlink(join(packageDir, 'node_modules'), join(root, 'node_modules'), 'dir')
  const protocol = join(root, 'packages/typert-protocol')
  await mkdir(join(protocol, 'src'), { recursive: true })
  const protocolDir = join(packageDir, 'node_modules/@deepseek-ai/dsh-typert-protocol')
  await cp(join(protocolDir, 'package.json'), join(protocol, 'package.json'))
  for (const name of await readdir(join(protocolDir, 'lib/types'))) {
    if (name.endsWith('.d.ts')) await cp(join(protocolDir, 'lib/types', name), join(protocol, 'src', name.replace('.d.ts', '.ts')))
  }
  await writeFile(join(protocol, 'tsconfig.json'), JSON.stringify({ include: ['src/**/*.ts'] }))
  await writeFile(join(root, 'tsconfig.host.json'), JSON.stringify({
    extends: './packages/dsh-content-evidence/tsconfig.json', files: [], include: [],
    references: [{ path: './packages/dsh-content-evidence' }, { path: './packages/typert-protocol' }],
    compilerOptions: { paths: { '@deepseek-ai/dsh-typert-protocol': ['./packages/typert-protocol/src/index.ts'] } },
  }))
  const model = new WorkspaceAnalyzer({ root, faces: ['host'], packages: ['dsh-content-evidence'] }).analyze()
  assert.equal(model.faces.length, 1, 'Expected one Host face')
  const artifact = new FaceModelEmitter(model.faces[0]).emit('dsh-content-evidence')
  assert.ok(artifact.remote, 'Remote contribution missing')
  writePackageArtifacts(packageDir, [{ ...artifact, packageRoot: 'packages/dsh-content-evidence' }])
} finally {
  await rm(root, { recursive: true, force: true })
}
