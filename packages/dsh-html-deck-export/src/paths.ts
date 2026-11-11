import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

export class PathEscapeError extends Error {}

export function isWithinRoot(root: string, path: string): boolean {
  const tail = relative(root, path)
  return tail !== '..' && !tail.startsWith('../') && !isAbsolute(tail)
}

export function assertWithinRoot(root: string, path: string): void {
  if (!isWithinRoot(root, path)) {
    throw new PathEscapeError('Path escapes allowed root: ' + path)
  }
}

/** Check both the requested path and its symlink target before any content read/write. */
export async function confinedPath(root: string, input: string): Promise<string> {
  if (!input || /^[a-z][\w+.-]*:/i.test(input) || /[\x00-\x1f]/.test(input)) {
    throw new Error('Expected a local path within the project root')
  }
  const path = resolve(root, input)
  assertWithinRoot(root, path)
  const canonical = await realpath(path)
  assertWithinRoot(root, canonical)
  return canonical
}
