// Original synthetic PE bytes. Never executes or loads any generated file.
export function fixture({ architecture = 'x64', imports = [], delay = [], legacyDelay = false, managed = false } = {}) {
  const plus = architecture !== 'x86', optSize = plus ? 240 : 224, opt = 0x98
  const normalBytes = imports.length ? (imports.length + 1) * 20 : 0
  const delayBytes = delay.length ? (delay.length + 1) * 32 : 0
  const strings = [...imports, ...delay].map(n => Buffer.from(n + '\0', 'latin1'))
  const rawSize = Math.ceil((normalBytes + delayBytes + strings.reduce((s, n) => s + n.length, 0) + 16) / 512) * 512
  const b = Buffer.alloc(512 + rawSize)
  b.writeUInt16LE(0x5a4d); b.writeUInt32LE(0x80, 0x3c); b.writeUInt32LE(0x4550, 0x80)
  b.writeUInt16LE(({ x86: 0x14c, x64: 0x8664, ARM64: 0xaa64 })[architecture], 0x84)
  b.writeUInt16LE(1, 0x86); b.writeUInt16LE(optSize, 0x94)
  b.writeUInt16LE(plus ? 0x20b : 0x10b, opt)
  if (plus) b.writeBigUInt64LE(0x140000000n, opt + 24)
  else b.writeUInt32LE(0x400000, opt + 28)
  b.writeUInt32LE(0x1000, opt + 32); b.writeUInt32LE(0x200, opt + 36)
  b.writeUInt32LE(0x1000 + Math.ceil(rawSize / 4096) * 4096, opt + 56)
  b.writeUInt32LE(512, opt + 60)
  const dir = opt + (plus ? 112 : 96)
  b.writeUInt32LE(16, dir - 4)
  const section = opt + optSize
  b.write('.rdata', section); b.writeUInt32LE(rawSize, section + 8); b.writeUInt32LE(0x1000, section + 12)
  b.writeUInt32LE(rawSize, section + 16); b.writeUInt32LE(512, section + 20)
  b.writeUInt32LE(0x40000040, section + 36)
  const dataDir = (i, offset, size) => { b.writeUInt32LE(0x1000 + offset, dir + i * 8); b.writeUInt32LE(size, dir + i * 8 + 4) }
  if (normalBytes) dataDir(1, 0, normalBytes)
  if (delayBytes) dataDir(13, normalBytes, delayBytes)
  if (managed) dataDir(14, 0, 72)
  let cursor = normalBytes + delayBytes
  for (let i = 0; i < strings.length; i++) {
    const isDelay = i >= imports.length, index = isDelay ? i - imports.length : i
    const descriptor = 512 + (isDelay ? normalBytes + index * 32 : index * 20)
    const rva = 0x1000 + cursor
    if (isDelay) b.writeUInt32LE(legacyDelay ? 0 : 1, descriptor)
    b.writeUInt32LE(rva + (isDelay && legacyDelay ? 0x400000 : 0), descriptor + (isDelay ? 4 : 12))
    strings[i].copy(b, 512 + cursor); cursor += strings[i].length
  }
  return b
}
