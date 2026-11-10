import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { defaults, byteRange, bootScript } from '../lib/core.js'
import { Config, apply } from '../lib/plugin.js'
test('schema defaults and validation',()=>{
 assert.deepEqual(Config({}),defaults)
 for (const volume of [-1,1.1]) assert.throws(()=>Config({volume}))
 assert.throws(()=>Config({enabled:'yes'}))
 assert.throws(()=>apply({}, {...defaults,volume:NaN}),/finite/)
 assert.equal(defaults.autoplay,false)
})
test('byte ranges, suffixes and invalid requests',()=>{
 for (const [header,expected] of [[undefined,[0,99]],['bytes=0-9',[0,9]],['bytes=90-',[90,99]],['bytes=-10',[90,99]],['bytes=0-999',[0,99]],['bytes=100-',null],['bytes=9-2',null],['bytes=-0',null],['bytes=-',null],['bytes=0-1,3-4',null]]) assert.deepEqual(byteRange(header,100),expected)
})
test('boot JSON cannot escape script or expose disk path',()=>{
 const value={enabled:true,volume:.4,loop:true,autoplay:false,musicUrl:'</script><script>alert(1)</script>\u2028'}
 const script=bootScript(value); assert.ok(!script.includes('</script>'))
 const sandbox={window:{}};vm.runInNewContext(script,sandbox)
 assert.equal(sandbox.window.__DSH_DIRENJIE__.musicUrl,value.musicUrl)
 assert.ok(!script.includes('musicPath'))
})
