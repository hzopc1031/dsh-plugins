import { open } from 'node:fs/promises'
import { extname, isAbsolute } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { pipeline } from 'node:stream/promises'
import { byteRange } from './core.js'
const mime: Record<string,string> = {'.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.flac':'audio/flac'}
export const MAX_AUDIO_BYTES = 128*1024*1024
/** No URL parameters are used to select the file. */
export async function serveMusic(path: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
 res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff')
 if (!['GET','HEAD'].includes(req.method ?? '')) {res.writeHead(405,{Allow:'GET, HEAD'}).end(); return}
 const type=mime[extname(path).toLowerCase()]
 if (!isAbsolute(path) || path.startsWith('\\\\') || !type) {res.writeHead(404).end(); return}
 let file: Awaited<ReturnType<typeof open>> | undefined
 try {
  file=await open(path,'r'); const stat=await file.stat()
  if (!stat.isFile() || !stat.size || stat.size>MAX_AUDIO_BYTES) {res.writeHead(413).end(); return}
  const range=byteRange(req.headers.range,stat.size)
  if (!range) {res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end(); return}
  const [start,end]=range
  res.setHeader('Content-Type',type); res.setHeader('Accept-Ranges','bytes'); res.setHeader('Content-Length',end-start+1)
  if (req.headers.range) res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`)
  res.writeHead(req.headers.range ? 206 : 200)
  if (req.method==='HEAD') {res.end(); return}
  await pipeline(file.createReadStream({start,end,autoClose:false}),res)
 } catch { if (!res.headersSent) res.writeHead(404).end(); else res.destroy() }
 finally {await file?.close()}
}
