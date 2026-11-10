import { dirname } from 'node:path'
import { createCaptureEngine, type CaptureOptions, type CaptureResult } from './capture.js'
import { detectDeck, type DeckSlide, type DetectedDeck } from './detect.js'

export interface DeckCaptureOptions extends CaptureOptions {
  /** Explicit asset boundary for decks with sibling assets; defaults to the HTML directory. */
  resourceRoot?: string
}

export interface SlideCapture extends CaptureResult {
  index: number
  id?: string
  title?: string
  notes?: string
  notesSource?: DeckSlide['notesSource']
  renderState?: {
    navigation: string
    slideBounds: { x: number; y: number; width: number; height: number }
    animatedElements: number
    unresolvedAnimatedElements: number
    chrome: { selector: string; display: string; visibility: string }[]
    preview?: { lowPower: boolean; backgroundCanvases: number; hiddenBackgroundCanvases: number; differences: string[] }
  }
}

export interface DeckCapture {
  deck: DetectedDeck
  viewport: { width: number; height: number }
  scale: 1 | 2
  format: 'png' | 'jpeg'
  quality?: number
  allowNetwork: boolean
  browserVersion: string
  pages: SlideCapture[]
  totalBytes: number
  elapsedMs: number
}

/** Capture every detected page in DOM order, retaining failed pages as evidence. Writes no files. */
export async function captureDeck(input: string, options: DeckCaptureOptions = {}): Promise<DeckCapture> {
  const started = performance.now()
  const deck = await detectDeck(input, { resourceRoot: options.resourceRoot })
  const engine = await createCaptureEngine(options.resourceRoot ?? dirname(deck.inputPath), options)
  const pages: SlideCapture[] = []
  try {
    for (const slide of deck.slides) {
      const metadata: Pick<SlideCapture, 'notes' | 'notesSource' | 'renderState'> = { notes: slide.notes, notesSource: slide.notesSource }
      const warnings: string[] = []
      const result = await engine.capture(slide.url, async page => {
        await page.evaluate(async ({ deck, slide }) => {
          const target = document.querySelector<HTMLElement>(slide.selector)
          if (!target || (slide.id !== undefined && target.dataset.slideId !== slide.id)) throw new Error('Runtime slide identity differs from detected markup')
          const runtime = window as typeof window & { __goTo?: (index: number, options: { skipAnim: boolean }) => unknown }
          if (deck.navigation === 'dom') {
            if (typeof runtime.__goTo === 'function') await runtime.__goTo(slide.index - 1, { skipAnim: true })
            else {
              for (const entry of deck.slides) {
                const node = document.querySelector<HTMLElement>(entry.selector)
                if (!node) throw new Error('Runtime slide missing')
                node.classList.toggle('is-active', entry.index === slide.index)
                node.classList.toggle('active', entry.index === slide.index)
                if (node !== target) node.style.setProperty('display', 'none', 'important')
              }
              target.hidden = false
              if (getComputedStyle(target).display === 'none') target.style.setProperty('display', 'block', 'important')
            }
          }
          if (deck.format === 'guizang' && !document.body.classList.contains('ppt-preview')) throw new Error('歸藏 preview mode did not initialize')
          if (deck.format === 'guizang') {
            document.querySelectorAll<HTMLElement>('.chrome,.chrome-min,.gz-chrome,.foot').forEach(node => { node.dataset.exportChrome = '' })
            // Swiss embeds this navigation hint in the slide rather than in #hint.
            target.querySelectorAll<HTMLElement>('.t-meta').forEach(node => {
              if (/^→\s*swipe\s*\/\s*arrow keys$/i.test(node.textContent?.trim() ?? '')) node.dataset.exportChrome = ''
            })
            // Preserve the original display rules beneath preview's chrome-hiding override.
            for (const style of document.querySelectorAll('style')) {
              for (const rule of Array.from(style.sheet?.cssRules ?? [])) {
                if (rule instanceof CSSStyleRule && rule.selectorText.includes('body.ppt-preview') &&
                    /#(?:nav|hint)\b/.test(rule.selectorText) && rule.style.display === 'none') {
                  rule.style.removeProperty('display')
                  rule.style.setProperty('visibility', 'hidden', 'important')
                }
              }
            }
          }
        }, { deck, slide })
        await page.addStyleTag({ content: `
          #nav, #hint,
          .progress-bar, .slide-number, .keyboard-hint, .notes-overlay, .overview,
          #overview, [data-export-chrome], [data-clone], [data-slide-clone], .slide-clone,
          .overview-clone, [data-export-ignore], aside.notes { visibility: hidden !important; }
          *, *::before, *::after { transition: none !important; }
        ` })
      }, async page => {
        const state = await page.evaluate(async ({ deck, slide }) => {
          const target = document.querySelector<HTMLElement>(slide.selector)!
          const runtime = window as typeof window & { __SPEAKER_NOTES__?: unknown; __lowPowerMode?: boolean; __currentSlideIndex?: number }
          if (deck.format === 'guizang' && runtime.__currentSlideIndex !== slide.index - 1) throw new Error('歸藏 preview opened the wrong page')
          const marker = document.querySelector('[data-wanghong-font-ready]')?.getAttribute('data-wanghong-font-ready')
          const handwritten = /HanziPen SC/i.test(getComputedStyle(target).fontFamily) ||
            Array.from(target.querySelectorAll('*')).some(node => /HanziPen SC/i.test(getComputedStyle(node).fontFamily))
          if (marker !== undefined || handwritten) {
            if (innerWidth !== 1920 || innerHeight !== 1080) throw new Error('王虹 requires a 1920×1080 viewport')
            if (marker !== undefined && marker !== 'true') throw new Error('Required 王虹 handwritten font is not ready')
            if (handwritten) {
              const embedded = Array.from(document.fonts).find(font => font.family.replace(/["']/g, '') === 'HanziPen SC' && font.status === 'loaded')
              if (!embedded) {
                try { await new FontFace('__deck_font_probe__', 'local("HanziPen SC")').load() }
                catch { throw new Error('Required 王虹 handwritten font HanziPen SC is unavailable') }
              }
            }
          }
          for (const animation of document.getAnimations()) {
            if (animation.effect?.getComputedTiming().iterations !== Infinity) {
              try { animation.finish() } catch { animation.cancel() }
            } else animation.pause()
          }
          // These are the inspected 歸藏 static-reveal targets, including Swiss recipe children.
          const animated = target.querySelectorAll<HTMLElement>(deck.format === 'guizang'
            ? '[data-anim],.row-fill,.tl-node,.stack-block,.bar-tower,.sub-card,.col,.vrule,.kpi-cell,.card-fill,.card-accent,.card-ink'
            : '[data-anim]')
          for (const node of animated) {
            node.style.setProperty('opacity', '1', 'important')
            node.style.setProperty('transform', 'none', 'important')
          }
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
          const rect = target.getBoundingClientRect()
          const css = getComputedStyle(target)
          if (!rect.width || !rect.height || rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight || css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0) {
            throw new Error('Requested slide is not visible after navigation')
          }
          if (deck.slides.some(entry => {
            if (entry.index === slide.index) return false
            const node = document.querySelector(entry.selector)
            if (!node) throw new Error('Runtime slide missing')
            const bounds = node.getBoundingClientRect()
            return bounds.width > 0 && bounds.height > 0 && bounds.right > 1 && bounds.bottom > 1 &&
              bounds.left < innerWidth - 1 && bounds.top < innerHeight - 1 && node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
          })) throw new Error('Multiple deck pages visible after navigation')
          const text = (value: unknown): string | undefined => {
            if (typeof value === 'string') return value
            if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
            const lines = Object.entries(value).filter(([key]) => key !== 'id').flatMap(([, field]) =>
              typeof field === 'string' ? [field] : Array.isArray(field) ? field.filter(item => typeof item === 'string') : [])
            return lines.length ? lines.join('\n') : undefined
          }
          const notes = runtime.__SPEAKER_NOTES__
          let content = slide.id === undefined ? undefined : text(Array.isArray(notes)
            ? notes.find(note => note?.id === slide.id) : notes && typeof notes === 'object' ? (notes as Record<string, unknown>)[slide.id] : undefined)
          let source: DeckSlide['notesSource'] = content === undefined ? undefined : 'speaker-notes'
          if (content === undefined && target.hasAttribute('data-notes')) {
            content = target.dataset.notes; source = 'data-notes'
          }
          if (content === undefined) {
            const asides = Array.from(target.querySelectorAll('aside.notes')).filter(node => node.closest('section.slide') === target)
            if (asides.length) {
              content = asides.map(node => {
                const clone = node.cloneNode(true) as HTMLElement
                clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'))
                clone.querySelectorAll('p,div,li').forEach(block => block.append('\n'))
                return clone.textContent?.trim() ?? ''
              }).join('\n')
              source = 'aside.notes'
            }
          }
          const chromeSelectors = ['#nav', '#hint', '.progress-bar', '.slide-number', '.keyboard-hint', '[data-export-chrome]']
          const chrome = chromeSelectors.flatMap(selector => Array.from(document.querySelectorAll(selector), node => ({
            selector, display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility,
          })))
          const backgrounds = Array.from(document.querySelectorAll('canvas.bg, canvas.ascii-bg, canvas[data-gz-effect]'))
          const hiddenBackgroundCanvases = backgrounds.filter(node => !node.getClientRects().length || getComputedStyle(node).visibility === 'hidden').length
          return {
            notes: content, notesSource: source,
            renderState: {
              navigation: deck.navigation === 'hash' ? location.hash : location.search || 'dom',
              slideBounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              animatedElements: animated.length, chrome,
              unresolvedAnimatedElements: Array.from(animated).filter(node => Number(getComputedStyle(node).opacity) !== 1 || getComputedStyle(node).transform !== 'none').length,
              preview: deck.format === 'guizang' ? {
                lowPower: Boolean(runtime.__lowPowerMode), backgroundCanvases: backgrounds.length, hiddenBackgroundCanvases,
                differences: [
                  'Preview disables page transitions; export forces entrance/pipeline elements to their fully visible static state.',
                  'Export hides navigation hints and named page header/footer chrome with visibility:hidden, preserving layout space.',
                  ...(runtime.__lowPowerMode ? ['Preview enables low-power rendering; animated WebGL/ASCII backgrounds may be hidden or frozen compared with live playback.'] : []),
                ],
              } : undefined,
            },
            clipped: rect.x < -1 || rect.y < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1 ||
              target.scrollWidth > target.clientWidth + 1 || target.scrollHeight > target.clientHeight + 1,
          }
        }, { deck, slide })
        metadata.notes = state.notes
        metadata.notesSource = state.notesSource
        metadata.renderState = state.renderState
        if (state.clipped) warnings.push('Slide content exceeds its canvas or viewport; content may be clipped')
        if (engine.viewport.width !== 1920 || engine.viewport.height !== 1080) warnings.push('Non-1920×1080 viewport: verify short-viewport layout and overflow')
        if (deck.designSize && (deck.designSize.width !== 1920 || deck.designSize.height !== 1080)) warnings.push(`Fixed design canvas ${deck.designSize.width}×${deck.designSize.height} preserved; viewport ${engine.viewport.width}×${engine.viewport.height}, verify margins and clipping`)
      })
      pages.push({ ...result, index: slide.index, id: slide.id, title: slide.title, ...metadata,
        warnings: [...deck.warnings, ...result.warnings, ...warnings] })
    }
    return {
      deck, viewport: engine.viewport, scale: engine.scale, format: engine.format, quality: engine.quality,
      allowNetwork: engine.allowNetwork, browserVersion: engine.browserVersion, pages,
      totalBytes: pages.reduce((sum, page) => sum + page.bytes, 0), elapsedMs: Math.round(performance.now() - started),
    }
  } finally { await engine.close() }
}
