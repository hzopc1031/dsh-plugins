import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,writeFile,rm,truncate} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {serveMusic,MAX_AUDIO_BYTES} from '../lib/music.js'
test('HTTP full/range/HEAD/errors and fixed file selection',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'direnjie-test-')); const path=join(dir,'原创测试.wav')
 await writeFile(path,Buffer.from('0123456789'))
 let chosen=path
 const server=createServer((req,res)=>void serveMusic(chosen,req,res)); await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const url=`http://127.0.0.1:${server.address().port}/music`
 try {
  let r=await fetch(url+'?path=other'); assert.equal(r.status,200); assert.equal(await r.text(),'0123456789'); assert.equal(r.headers.get('cache-control'),'no-store')
  r=await fetch(url,{headers:{Range:'bytes=2-4'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 2-4/10');assert.equal(await r.text(),'234')
  r=await fetch(url,{headers:{Range:'bytes=-3'}});assert.equal(await r.text(),'789')
  r=await fetch(url,{method:'HEAD'});assert.equal(r.headers.get('content-length'),'10');assert.equal(await r.text(),'')
  r=await fetch(url,{headers:{Range:'bytes=20-'}});assert.equal(r.status,416)
  r=await fetch(url,{method:'POST'});assert.equal(r.status,405)
  chosen=join(dir,'missing.mp3'); assert.equal((await fetch(url)).status,404)
  chosen=join(dir,'bad.exe'); await writeFile(chosen,'bad');assert.equal((await fetch(url)).status,404)
  chosen='relative.mp3';assert.equal((await fetch(url)).status,404)
  chosen=path;await truncate(path,MAX_AUDIO_BYTES+1);assert.equal((await fetch(url)).status,413)
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
})
