import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer, { type Page } from 'puppeteer-core'

export interface CaptureOptions {
  viewport?: { width: number; height: number }
  scale?: 1 | 2
  format?: 'png' | 'jpeg'
  quality?: number
  allowNetwork?: boolean
  timeoutMs?: number
  stabilityMs?: number
  signal?: AbortSignal
}

export interface CaptureResult {
  url: string
  status: 'captured' | 'failed'
  /** Full viewport image, or best-effort failure evidence. Never a section crop. */
  image?: Uint8Array
  bytes: number
  error?: string
  warnings: string[]
  computedFontFamilies: string[]
  actualFontFamilies: string[]
  elapsedMs: number
}

export const CHROME_ARGS = [
  '--no-sandbox', '--disable-gpu', '--force-color-profile=srgb',
  '--disable-background-networking', '--disable-extensions', '--disable-sync',
]

/** One isolated browser per deck; adapters activate slides through prepare before readiness checks. */
export async function createCaptureEngine(directory: string, options: CaptureOptions = {}) {
  options = { ...options }
  const root = await realpath(directory)
  if (!(await stat(root)).isDirectory()) throw new Error('Capture root must be a deck directory')
  const viewport = { ...(options.viewport ?? { width: 1920, height: 1080 }) }
  const scale = options.scale ?? 2
  const format = options.format ?? 'png'
  const timeoutMs = options.timeoutMs ?? 15000
  const stabilityMs = options.stabilityMs ?? 150
  if (![viewport.width, viewport.height].every(n => Number.isSafeInteger(n) && n > 0) || viewport.width * 9 !== viewport.height * 16) {
    throw new Error('Capture viewport must have positive integer dimensions and a 16:9 ratio')
  }
  if (![1, 2].includes(scale) || !['png', 'jpeg'].includes(format)) throw new Error('Capture requires scale 1/2 and png/jpeg format')
  if (options.quality !== undefined && (format !== 'jpeg' || !Number.isInteger(options.quality) || options.quality < 1 || options.quality > 100)) {
    throw new Error('Quality must be an integer from 1 to 100 for jpeg only')
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(stabilityMs) || stabilityMs < 0 || stabilityMs >= timeoutMs) {
    throw new Error('Capture timeout must be positive and greater than the nonnegative stability wait')
  }
  const contained = (path: string) => {
    const tail = relative(root, path)
    return tail !== '..' && !tail.startsWith('../') && !isAbsolute(tail)
  }
  async function localFile(url: URL) {
    const path = fileURLToPath(url)
    if (!contained(path)) throw new Error(`Local resource escapes deck directory: ${url.href}`)
    const canonical = await realpath(path)
    if (!contained(canonical)) throw new Error(`Local resource symlink escapes deck directory: ${url.href}`)
    if (!(await stat(canonical)).isFile()) throw new Error(`Local resource is not a regular file: ${url.href}`)
    return canonical
  }
  options.signal?.throwIfAborted()
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
    defaultViewport: { ...viewport, deviceScaleFactor: scale }, timeout: timeoutMs,
    protocolTimeout: Math.max(timeoutMs, 5000),
    args: [...CHROME_ARGS, ...(!options.allowNetwork ? [
      // Block sockets outside request interception too, including WebSocket and loopback traffic.
      '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    ] : [])],
  })
  let closing: Promise<void> | undefined
  const close = () => closing ??= browser.close()
  const onAbort = () => { void close().catch(() => browser.process()?.kill('SIGKILL')) }
  options.signal?.addEventListener('abort', onAbort, { once: true })
  const dispose = async () => {
    options.signal?.removeEventListener('abort', onAbort)
    await close()
  }
  try {
    options.signal?.throwIfAborted()
    const browserVersion = await browser.version()
    return {
      root, viewport, scale, format, quality: options.quality,
      allowNetwork: options.allowNetwork ?? false, browserVersion, browserPid: browser.process()?.pid,
      close: dispose,
      async capture(input: string, prepare?: (page: Page) => Promise<void>, finalize?: (page: Page) => Promise<void>): Promise<CaptureResult> {
        options.signal?.throwIfAborted()
        if (closing) throw new Error('Capture engine is closed')
        const started = performance.now()
        const warnings = new Set<string>()
        const result: CaptureResult = {
          url: input, status: 'failed', bytes: 0, warnings: [], computedFontFamilies: [], actualFontFamilies: [], elapsedMs: 0,
        }
        let page: Page | undefined
        let timer: ReturnType<typeof setTimeout> | undefined
        let pathError: Error | undefined
        try {
          const url = /^[a-z][\w+.-]*:/i.test(input) ? new URL(input) : pathToFileURL(resolve(root, input))
          if (url.protocol !== 'file:') throw new Error('Capture entry must be a local file URL or path')
          await localFile(url)
          result.url = url.href
          page = await browser.newPage()
          const active = page
          active.setDefaultTimeout(timeoutMs)
          active.setDefaultNavigationTimeout(timeoutMs)
          await active.setRequestInterception(true)
          active.on('request', request => {
            void (async () => {
              const target = new URL(request.url())
              if (target.protocol === 'file:') {
                try {
                  const path = await localFile(target)
                  if (request.resourceType() === 'document') {
                    // Keep new execution contexts from bypassing the page's resource checks.
                    await request.respond({ status: 200, contentType: 'text/html',
                      headers: { 'Content-Security-Policy': "sandbox allow-scripts allow-same-origin; worker-src 'none'" },
                      body: await readFile(path) })
                  } else await request.continue()
                } catch (error) {
                  if ((error as NodeJS.ErrnoException).code === 'ENOENT' && request.resourceType() !== 'document') {
                    warnings.add(`Missing local resource: ${target.href}`)
                  } else pathError = error as Error
                  await request.abort('accessdenied')
                }
              } else if (['data:', 'blob:'].includes(target.protocol) || (options.allowNetwork && request.resourceType() !== 'document' && ['http:', 'https:'].includes(target.protocol))) {
                await request.continue()
              } else {
                warnings.add(`Blocked resource (network disabled or unsupported protocol): ${target.href}`)
                await request.abort('blockedbyclient')
              }
            })().catch(error => {
              if (!active.isClosed()) warnings.add(`Resource interception failed: ${(error as Error).message}`)
            })
          })
          active.on('requestfailed', request => warnings.add(`Resource failed: ${request.url()} (${request.failure()?.errorText ?? 'unknown error'})`))
          active.on('response', response => {
            if (response.status() >= 400) warnings.add(`Resource HTTP ${response.status()}: ${response.url()}`)
          })
          active.on('console', message => {
            if (['warning', 'error'].includes(message.type())) warnings.add(`Page ${message.type()}: ${message.text()}`)
          })
          active.on('pageerror', error => warnings.add(`Page script error: ${String(error)}`))
          const work = async () => {
            await active.goto(url.href, { waitUntil: 'load' })
            await prepare?.(active)
            await active.addStyleTag({ content: '#nav, #hint, [data-export-chrome] { visibility: hidden !important; }' })
            await active.evaluate(async () => {
              await document.fonts.ready
              await Promise.all(Array.from(document.images, image => {
                image.loading = 'eager'
                return image.decode().catch(() => { throw new Error(`Image not loaded: ${image.currentSrc || image.src}`) })
              }))
              // Two rAFs allow at least one paint, including a background canvas outside the slide.
              await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
            })
            await active.waitForNetworkIdle({ idleTime: stabilityMs })
            await finalize?.(active)
            await active.evaluate(async () => {
              await document.fonts.ready
              if (document.fonts.status !== 'loaded') throw new Error('Fonts are not ready')
              if (Array.from(document.images).some(image => !image.complete || image.naturalWidth === 0)) throw new Error('Image not loaded after stability wait')
            })
            const fontInfo = await active.evaluate(() => {
              const visible = Array.from(document.querySelectorAll('*')).filter(element => {
                const rect = element.getBoundingClientRect()
                return Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) &&
                  rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight &&
                  element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
              })
              const selector = (element: Element): string => element.parentElement
                ? `${selector(element.parentElement)} > :nth-child(${Array.from(element.parentElement.children).indexOf(element) + 1})` : 'html'
              return {
                families: [...new Set(visible.map(element => getComputedStyle(element).fontFamily))],
                selectors: visible.map(selector),
                errors: Array.from(document.fonts).filter(font => font.status === 'error').map(font => font.family),
                loaded: Array.from(document.fonts).filter(font => font.status === 'loaded').map(font => font.family.replace(/["']/g, '').toLowerCase()),
                overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
              }
            })
            result.computedFontFamilies = fontInfo.families
            for (const family of fontInfo.errors) warnings.add(`Font failed to load: ${family}`)
            if (fontInfo.overflow) warnings.add('Content exceeds viewport; fixed canvas or short viewport may clip content')
            const session = await active.createCDPSession()
            try {
              await session.send('DOM.enable')
              await session.send('CSS.enable')
              const { root: dom } = await session.send('DOM.getDocument', { depth: -1, pierce: true })
              const { nodeIds } = fontInfo.selectors.length
                ? await session.send('DOM.querySelectorAll', { nodeId: dom.nodeId, selector: fontInfo.selectors.join(',') }) : { nodeIds: [] }
              const fonts = await Promise.all(nodeIds.map(nodeId => session.send('CSS.getPlatformFontsForNode', { nodeId })))
              result.actualFontFamilies = [...new Set(fonts.flatMap(item => item.fonts.filter(font => font.glyphCount > 0).map(font => font.familyName)))].sort()
              for (const stack of fontInfo.families) {
                const primary = stack.split(',')[0]!.trim().replace(/["']/g, '')
                if (!/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-.+)$/i.test(primary) &&
                    !fontInfo.loaded.includes(primary.toLowerCase()) &&
                    !result.actualFontFamilies.some(family => family.toLowerCase() === primary.toLowerCase())) {
                  warnings.add(`Requested primary font not observed: ${primary}; rendered: ${result.actualFontFamilies.join(', ')}`)
                }
              }
              if (fontInfo.families.length && !result.actualFontFamilies.length) warnings.add('Could not determine actual rendered font families')
            } finally { await session.detach() }
            if (pathError) throw pathError
            result.image = await active.screenshot({ type: format, quality: options.quality, fullPage: false, captureBeyondViewport: false })
            if (pathError) throw pathError
            result.bytes = result.image.byteLength
            result.status = 'captured'
          }
          await Promise.race([work(), new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Capture timed out after ${timeoutMs}ms (navigation, fonts, images, paint or adapter)`)), timeoutMs)
          })])
        } catch (error) {
          result.error = pathError?.message ?? (error as Error).message
          if (page && !page.isClosed() && !options.signal?.aborted) {
            try { result.image = await page.screenshot({ type: format, quality: options.quality, fullPage: false, captureBeyondViewport: false }) } catch { /* Error text remains evidence if Chrome cannot capture. */ }
          }
          if (options.signal?.aborted) {
            await dispose()
            options.signal.throwIfAborted()
          }
        } finally {
          clearTimeout(timer)
          await page?.close().catch(() => {})
          result.warnings = [...warnings]
          result.elapsedMs = Math.round(performance.now() - started)
        }
        if (options.signal?.aborted) {
          await dispose()
          options.signal.throwIfAborted()
        }
        return result
      },
    }
  } catch (error) {
    await dispose()
    throw error
  }
}
