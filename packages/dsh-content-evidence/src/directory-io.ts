import { constants, close, fstat, fsync, read, writeFile, type Stats } from 'node:fs'
import { mkdir, open, realpath, rename, rmdir, unlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { promisify, getSystemErrorName } from 'node:util'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { fileName, invalid } from './validation.js'

const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
const closeFd = promisify(close), statFd = promisify(fstat), syncFd = promisify(fsync)
const readFd = promisify(read), writeFd = promisify(writeFile)
interface Handle {
  fd: number
  stat(): Promise<Stats>
  close(): Promise<void>
  sync(): Promise<void>
  writeFile(bytes: string | Buffer): Promise<void>
  read(buffer: Buffer, offset: number, length: number, position: null): Promise<{ bytesRead: number }>
}

function unsupported(cause?: unknown): never {
  throw new RemoteError('content-evidence/export-unsupported', '此主机缺少安全目录句柄 I/O 支持；未写入导出文件。Windows 暂不支持。Safe export/material reading requires verified fd paths or the Linux/macOS native helper; no export files were written.', null, { cause })
}

type NativeFunction = (...args: (number | string)[]) => number
let native: ReturnType<typeof loadNative> | undefined
function loadNative() {
  try {
    // Use the hook-free prebuilt packages directly; the koffi umbrella has an install hook.
    const koffi = createRequire(import.meta.url)(`@koromix/koffi-${process.platform}-${process.arch}`) as {
      load(path: string): { func(prototype: string): NativeFunction }
      errno(): number
    }
    const libc = koffi.load(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6')
    const openat = libc.func('int openat(int dirfd, const char *path, int flags, ...)')
    const mkdirat = libc.func('int mkdirat(int dirfd, const char *path, unsigned int mode)')
    const renameat = libc.func('int renameat(int oldfd, const char *oldpath, int newfd, const char *newpath)')
    const unlinkat = libc.func('int unlinkat(int dirfd, const char *path, int flags)')
    const check = (result: number, syscall: string) => {
      if (result < 0) {
        const errno = koffi.errno(), code = getSystemErrorName(-errno)
        throw Object.assign(new Error(`${code}: ${syscall}`), { code, errno: -errno, syscall })
      }
      return result
    }
    return {
      open(fd: number, name: string, flags: number, mode: number) {
        // Darwin arm64 requires the variadic mode argument to use its variadic ABI.
        return check(openat(fd, name, flags | (process.platform === 'darwin' ? 0x1000000 : 0x80000), 'uint', mode), 'openat')
      },
      mkdir(fd: number, name: string) { check(mkdirat(fd, name, 0o700), 'mkdirat') },
      rename(fd: number, from: string, to: string) { check(renameat(fd, from, fd, to), 'renameat') },
      unlink(fd: number, name: string, directory: boolean) { check(unlinkat(fd, name, directory ? (process.platform === 'darwin' ? 0x80 : 0x200) : 0), 'unlinkat') },
    }
  } catch (cause) { unsupported(cause) }
}
export function nativeIO() { return native ??= loadNative() }

function nativeHandle(fd: number): Handle {
  return {
    fd, stat: () => statFd(fd), close: () => closeFd(fd), sync: () => syncFd(fd),
    writeFile: bytes => writeFd(fd, bytes),
    read: (buffer, offset, length, position) => readFd(fd, buffer, offset, length, position),
  }
}

export class Directory {
  private constructor(readonly handle: Handle, private readonly prefix?: string) {}

  static supported(): void {
    if (!['linux', 'darwin'].includes(process.platform) || !constants.O_DIRECTORY || !constants.O_NOFOLLOW) unsupported()
  }
  static async open(path: string): Promise<Directory> {
    Directory.supported()
    let directory = new Directory(await open('/', directoryFlags))
    try {
      for (const prefix of ['/proc/self/fd', '/dev/fd']) {
        let probe: Handle | undefined
        try {
          probe = await open(`${prefix}/${directory.handle.fd}/.`, directoryFlags)
          const pinned = await statFd(directory.handle.fd, { bigint: true }), stat = await statFd(probe.fd, { bigint: true })
          if (stat.dev === pinned.dev && stat.ino === pinned.ino) {
            await realpath(`${prefix}/${directory.handle.fd}`)
            directory = new Directory(directory.handle, prefix)
            break
          }
        } catch (error) {
          if (!['ENOENT', 'ENOTDIR', 'ELOOP', 'EACCES', 'ENOSYS', 'ENOTSUP'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
        } finally { await probe?.close() }
      }
      if (!directory.prefix) nativeIO()
      for (const part of path.split('/').filter(Boolean)) {
        const next = await directory.openDirectory(part)
        await directory.handle.close()
        directory = next
      }
      return directory
    } catch (error) { await directory.handle.close(); throw error }
  }

  private path(name: string): string { return `${this.prefix}/${this.handle.fd}/${name}` }
  async openFile(name: string, flags: number, mode = 0o600): Promise<Handle> {
    fileName(name)
    return this.prefix ? open(this.path(name), flags, mode) : nativeHandle(nativeIO().open(this.handle.fd, name, flags, mode))
  }
  async openDirectory(name: string): Promise<Directory> { return new Directory(await this.openFile(name, directoryFlags), this.prefix) }
  async mkdir(name: string): Promise<void> {
    fileName(name)
    if (this.prefix) await mkdir(this.path(name), { mode: 0o700 })
    else nativeIO().mkdir(this.handle.fd, name)
  }
  async rename(from: string, to: string): Promise<void> {
    fileName(from); fileName(to)
    if (this.prefix) await rename(this.path(from), this.path(to))
    else nativeIO().rename(this.handle.fd, from, to)
  }
  async unlink(name: string, directory = false): Promise<void> {
    fileName(name)
    try {
      if (this.prefix) {
        if (directory) await rmdir(this.path(name))
        else await unlink(this.path(name))
      } else nativeIO().unlink(this.handle.fd, name, directory)
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  async canonical(original: string): Promise<string> {
    if (this.prefix) return realpath(`${this.prefix}/${this.handle.fd}`)
    const path = await realpath(original)
    const check = await open(path, directoryFlags)
    try {
      const pinned = await statFd(this.handle.fd, { bigint: true }), current = await statFd(check.fd, { bigint: true })
      if (pinned.dev !== current.dev || pinned.ino !== current.ino) invalid('destination directory changed')
    } finally { await check.close() }
    return path
  }
}
