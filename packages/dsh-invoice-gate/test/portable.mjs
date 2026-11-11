import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import promises from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'

const childHooks = new WeakMap()
export function childHook(t, script, writerOnly = false) {
  let scripts = childHooks.get(t)
  if (!scripts) {
    scripts = []
    childHooks.set(t, scripts)
    const spawn = childProcess.spawn
    t.mock.method(childProcess, 'spawn', (command, args, options) => {
      const injected = [...args], index = injected.indexOf('--eval') + 1
      assert.ok(index > 0)
      for (const hook of scripts) if (!hook.writerOnly || injected[index].includes('request.files')) injected[index] = hook.script + ';\n' + injected[index]
      return spawn(command, injected, options)
    })
  }
  const hook = { script, writerOnly }
  scripts.push(hook)
  return { mock: { restore() { scripts.splice(scripts.indexOf(hook), 1) } } }
}

export function withoutFdPaths(t) {
  const mocks = []
  for (const object of [fs, promises]) for (const name of ['realpath', 'readlink', 'open', 'realpathSync', 'readlinkSync', 'openSync']) {
    if (typeof object[name] !== 'function') continue
    const original = object[name]
    mocks.push(t.mock.method(object, name, function (path, ...args) {
      if (/^\/(?:proc\/self\/fd|dev\/fd)(?:\/|$)/.test(String(path))) throw Object.assign(new Error('fd paths unavailable'), { code: 'ENOENT' })
      return original.call(this, path, ...args)
    }))
  }
  syncBuiltinESMExports()
  t.after(() => { for (const mock of mocks) mock.mock.restore(); syncBuiltinESMExports() })
  assert.throws(() => fs.realpathSync('/proc/self/fd/0'), /unavailable/)
  assert.throws(() => fs.realpathSync('/dev/fd/0'), /unavailable/)
  childHook(t, `(() => {
    const fs = require('node:fs')
    for (const name of ['realpathSync', 'readlinkSync', 'openSync']) {
      const original = fs[name]
      fs[name] = (path, ...args) => {
        if (/^\\/(?:proc\\/self\\/fd|dev\\/fd)(?:\\/|$)/.test(String(path))) throw Object.assign(new Error('fd paths unavailable'), { code: 'ENOENT' })
        return original(path, ...args)
      }
    }
    require('node:assert/strict').throws(() => fs.realpathSync('/proc/self/fd/3'))
    require('node:assert/strict').throws(() => fs.realpathSync('/dev/fd/3'))
  })()`)
}
