import { mkdtemp, open, realpath, rename, rm, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, isAbsolute, join, relative } from 'node:path'
import type { DeckCapture, SlideCapture } from './adapters.js'

// Use 4.0.1's CJS entry to avoid its ESM metadata/declaration mismatch under NodeNext.
const PptxGenJS = createRequire(import.meta.url)('pptxgenjs') as typeof import('pptxgenjs').default

export interface ExportOptions {
  /** A plain filename within the existing export directory. */
  fileName?: string
  signal?: AbortSignal
}

export interface ReportPage extends Omit<SlideCapture, 'image'> {
  fontWarnings: string[]
  evidencePath?: string
}

export interface ExportReport {
  status: 'completed' | 'failed'
  error?: string
  inputPath: string
  detectedFormat: DeckCapture['deck']['format']
  pageCount: number
  viewport: DeckCapture['viewport']
  scale: DeckCapture['scale']
  format: DeckCapture['format']
  /** Null for PNG or when Chrome's JPEG default was used. */
  quality: number | null
  browserVersion: string
  networkMode: 'blocked' | 'allowed'
  warnings: string[]
  actualFontFamilies: string[]
  pages: ReportPage[]
  failedPages: ReportPage[]
  /** Successful captured image bytes; excludes failed-page evidence and OOXML overhead. */
  totalBytes: number
  /** Published PPTX bytes for this attempt; zero on failure, even if an older file exists. */
  pptxBytes: number
  captureElapsedMs: number
  elapsedMs: number
  pptxPath: string
}

async function syncedWrite(path: string, data: string | Uint8Array) {
  const file = await open(path, 'wx', 0o600)
  try { await file.writeFile(data); await file.sync() }
  finally { await file.close() }
}

/** Assemble only captured HTML images; a failed attempt preserves any previous PPTX. */
export async function exportCapturedDeck(capture: DeckCapture, directory: string, options: ExportOptions = {}) {
  const started = performance.now()
  const fileName = options.fileName ?? 'deck.pptx'
  if (typeof fileName !== 'string' || isAbsolute(fileName) || basename(fileName) !== fileName ||
      /[\\\x00-\x1f]/.test(fileName) || !/^.+\.pptx$/i.test(fileName)) {
    throw new Error('PPTX output must be a plain .pptx filename within the export directory')
  }
  options.signal?.throwIfAborted()
  const root = await realpath(directory)
  if (!(await stat(root)).isDirectory()) throw new Error('Export directory must be an existing directory')
  const pptxPath = join(root, fileName)
  const reportPath = join(root, 'export-report.json')
  const staging = await mkdtemp(join(root, '.html-deck-export-'))
  const stagedPptx = join(staging, 'deck.pptx')
  const stagedReport = join(staging, 'export-report.json')
  const pages: ReportPage[] = capture.pages.map(({ image: _image, ...page }) => ({
    ...page, fontWarnings: page.warnings.filter(warning => /font|字体/i.test(warning)),
  }))
  const report: ExportReport = {
    status: 'failed', inputPath: capture.deck.inputPath, detectedFormat: capture.deck.format,
    pageCount: capture.deck.slides.length, viewport: capture.viewport, scale: capture.scale,
    format: capture.format, quality: capture.quality ?? null, browserVersion: capture.browserVersion,
    networkMode: capture.allowNetwork ? 'allowed' : 'blocked', warnings: capture.deck.warnings,
    actualFontFamilies: [...new Set(pages.flatMap(page => page.actualFontFamilies))].sort(),
    pages, failedPages: pages.filter(page => page.status === 'failed'),
    totalBytes: pages.reduce((sum, page) => sum + page.bytes, 0), pptxBytes: 0,
    captureElapsedMs: capture.elapsedMs, elapsedMs: capture.elapsedMs, pptxPath,
  }
  let hasEvidence = false
  async function publishReport() {
    report.elapsedMs = capture.elapsedMs + Math.round(performance.now() - started)
    await syncedWrite(stagedReport, JSON.stringify(report, null, 2) + '\n')
    await rename(stagedReport, reportPath)
  }
  try {
    options.signal?.throwIfAborted()
    if (!pages.length || pages.length !== capture.deck.slides.length ||
        pages.some((page, i) => page.index !== i + 1 || page.id !== capture.deck.slides[i]?.id)) {
      throw new Error('Capture must contain every detected page in DOM order')
    }
    if (![capture.viewport.width, capture.viewport.height].every(n => Number.isSafeInteger(n) && n > 0) ||
        capture.viewport.width * 9 !== capture.viewport.height * 16 ||
        ![1, 2].includes(capture.scale) || !['png', 'jpeg'].includes(capture.format) ||
        (capture.quality !== undefined && (capture.format !== 'jpeg' || !Number.isInteger(capture.quality) || capture.quality < 1 || capture.quality > 100))) {
      throw new Error('Invalid capture viewport, scale, format or quality')
    }
    for (const [i, page] of capture.pages.entries()) {
      options.signal?.throwIfAborted()
      if (page.status === 'failed' && page.image?.byteLength) {
        const evidence = join(staging, `page-${i + 1}-failed.${capture.format}`)
        await syncedWrite(evidence, page.image)
        pages[i]!.evidencePath = relative(root, evidence)
        hasEvidence = true
      }
    }
    if (report.failedPages.length) throw new Error(`${report.failedPages.length} page(s) failed capture; refusing a partial PPTX`)
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_16x9'
    pptx.author = 'hzopc1031'
    for (const page of capture.pages) {
      options.signal?.throwIfAborted()
      if (page.status !== 'captured' || !(page.image instanceof Uint8Array) || !page.bytes || page.bytes !== page.image.byteLength) {
        throw new Error(`Page ${page.index} has no complete captured image`)
      }
      if (page.notes !== undefined && /[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/u.test(page.notes)) {
        throw new Error(`Page ${page.index} notes contain characters forbidden in XML`)
      }
      const slide = pptx.addSlide()
      slide.addImage({ data: `image/${capture.format};base64,${Buffer.from(page.image).toString('base64')}`, x: 0, y: 0, w: 10, h: 5.625 })
      if (page.notes !== undefined) slide.addNotes(page.notes)
    }
    const data = await pptx.write({ outputType: 'nodebuffer', compression: true })
    if (!(data instanceof Uint8Array)) throw new Error('PPTX assembly did not return bytes')
    options.signal?.throwIfAborted()
    await syncedWrite(stagedPptx, data)
    report.status = 'completed'
    report.pptxBytes = data.byteLength
    await publishReport()
    options.signal?.throwIfAborted()
    // Commit the PPTX last: no fallible work after this rename may turn success into failure.
    await rename(stagedPptx, pptxPath)
    return { pptxPath, reportPath, report }
  } catch (error) {
    report.status = 'failed'
    report.pptxBytes = 0
    report.error = error instanceof Error ? error.message : String(error)
    try { await rm(stagedReport, { force: true }); await publishReport() }
    catch (reportError) { throw new AggregateError([error, reportError], 'Export failed and its report could not be published') }
    throw new Error(`Export failed: ${report.error}. Report: ${reportPath}`, { cause: error })
  } finally {
    await rm(stagedPptx, { force: true }).catch(() => {})
    if (!hasEvidence) await rm(staging, { recursive: true, force: true }).catch(() => {})
  }
}
