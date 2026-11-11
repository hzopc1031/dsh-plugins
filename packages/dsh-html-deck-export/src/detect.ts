import { readFile, realpath, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ancestors, hasClass, noteText, parseElements, type Element } from './html.js'
import { speakerNotes } from './notes.js'
import { confinedPath, PathEscapeError } from './paths.js'

export type DeckFormat = 'guizang' | 'hash' | 'query' | 'fixed-canvas' | 'generic'

export interface DeckSlide {
  /** One-based page number in DOM order. */
  index: number
  id?: string
  title?: string
  selector: string
  url: string
  notes?: string
  notesSource?: 'speaker-notes' | 'aside.notes' | 'data-notes'
}

export interface DetectedDeck {
  inputPath: string
  format: DeckFormat
  navigation: 'query' | 'hash' | 'dom'
  slides: DeckSlide[]
  designSize?: { width: number; height: number; source: 'attributes' | 'css' }
  runtimeNotes: boolean
  warnings: string[]
}

function ignored(node: Element): boolean {
  return [node, ...ancestors(node)].some(item =>
    ['template', 'noscript'].includes(item.tag) ||
    /^(?:overview|overview-grid|slide-overview)$/.test(item.attrs.id ?? '') ||
    ['overview', 'overview-grid', 'slide-overview', 'mini-slide', 'slide-clone', 'overview-clone', 'clone'].some(name => hasClass(item, name)) ||
    ['data-clone', 'data-slide-clone', 'data-overview', 'data-export-ignore'].some(name => name in item.attrs))
}

function matches(node: Element, selector: string): boolean {
  if (!/^(?:[\w-]+)?(?:[.#][\w-]+)*$/.test(selector)) return false
  const tag = /^[\w-]+/.exec(selector)?.[0]
  return (!tag || node.tag === tag) && [...selector.matchAll(/([.#])([\w-]+)/g)]
    .every(([, kind, value]) => kind === '#' ? node.attrs.id === value : hasClass(node, value!))
}

function designSize(nodes: Element[], slides: Element[], styles: string[]): DetectedDeck['designSize'] {
  const relevant = nodes.filter(node => slides.some(slide => slide === node || ancestors(slide).includes(node)))
  const declared = relevant.filter(node => 'data-export-width' in node.attrs || 'data-export-height' in node.attrs)
  const sizes: NonNullable<DetectedDeck['designSize']>[] = declared.map(node => {
    const width = Number(node.attrs['data-export-width'])
    const height = Number(node.attrs['data-export-height'])
    if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
      throw new Error('Invalid design size: data-export-width and data-export-height must both be positive integers')
    }
    return { width, height, source: 'attributes' }
  })
  if (!declared.length) {
    // shortcut: simple fixed-pixel rules only; computed CSS and overflow must be checked during capture.
    for (const node of relevant) {
      const widths = new Set<string>()
      const heights = new Set<string>()
      const blocks = styles.flatMap(css => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter(rule => rule[1]!.split(',').some(selector => matches(node, selector.trim()))).map(rule => rule[2]!))
      blocks.push(node.attrs.style ?? '')
      for (const block of blocks) {
        for (const property of block.matchAll(/(?:^|;)\s*(width|height)\s*:\s*([^;]+)/g)) {
          (property[1] === 'width' ? widths : heights).add(property[2]!.replace(/\s*!important\s*$/i, '').trim())
        }
      }
      if (widths.size === 1 && heights.size === 1) {
        const width = /^(\d+(?:\.\d+)?)px$/.exec([...widths][0]!)
        const height = /^(\d+(?:\.\d+)?)px$/.exec([...heights][0]!)
        if (width && height && Number(width[1]) > 0 && Number(height[1]) > 0) {
          sizes.push({ width: Number(width[1]), height: Number(height[1]), source: 'css' })
        }
      }
    }
  }
  if (sizes.some(size => size.width !== sizes[0]!.width || size.height !== sizes[0]!.height)) {
    throw new Error('Conflicting design sizes; declare one data-export-width/data-export-height canvas')
  }
  return sizes[0]
}

/** Read local markup/resources without executing scripts, launching a browser, or making network requests. */
export async function detectDeck(input: string, options: { resourceRoot?: string } = {}): Promise<DetectedDeck> {
  if (!input || /^[a-z][\w+.-]*:\/\//i.test(input)) throw new Error('Deck input must be a local HTML path or directory')
  const root = options.resourceRoot === undefined ? undefined : await realpath(options.resourceRoot)
  let inputPath = root === undefined ? await realpath(input) : await confinedPath(root, input)
  if ((await stat(inputPath)).isDirectory()) inputPath = root === undefined
    ? await realpath(join(inputPath, 'index.html')) : await confinedPath(root, join(inputPath, 'index.html'))
  if (!(await stat(inputPath)).isFile() || !/\.html?$/i.test(inputPath)) throw new Error('Deck input must be an HTML file (directories use index.html)')
  const html = await readFile(inputPath, 'utf8')
  const nodes = parseElements(html)
  const decks = nodes.filter(node => node.attrs.id === 'deck' && !ignored(node))
  if (decks.length > 1) throw new Error('Unsupported deck: multiple #deck containers')
  const deck = decks[0]
  const slides = nodes.filter(node => node.tag === 'section' && hasClass(node, 'slide') && !ignored(node) &&
    !ancestors(node).some(parent => parent.tag === 'section') && (!deck || node.parent === deck))
  if (!slides.length) throw new Error('Unsupported HTML: no deck contract found; expected top-level section.slide pages (direct children when #deck is present)')
  const guizang = nodes.some(node => node.tag === 'html' && node.attrs['data-medium'] === 'slide')
  const ids = slides.map(node => node.attrs['data-slide-id'])
  if (guizang && (!deck || ids.some(id => !id?.trim()) || new Set(ids).size !== ids.length)) {
    throw new Error('Invalid 歸藏 deck: require #deck and a unique data-slide-id on every slide')
  }
  const warnings: string[] = []
  const scripts: string[] = []
  const styles: string[] = []
  const links: string[] = []
  const baseUrl = pathToFileURL(inputPath)
  if (nodes.some(node => node.tag === 'base')) throw new Error('Unsupported HTML: <base> changes local resource resolution')
  for (const node of nodes.filter(node => !ignored(node))) {
    const script = node.tag === 'script' && (!node.attrs.type || /^(?:module|text\/javascript|application\/javascript)$/i.test(node.attrs.type))
    const stylesheet = node.tag === 'link' && (node.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('stylesheet')
    if (node.tag === 'a' && node.attrs.href) links.push(node.attrs.href)
    if (node.tag === 'style') styles.push(html.slice(node.start, node.end))
    if (!script && !stylesheet) continue
    const target = script ? scripts : styles
    const reference = node.attrs[script ? 'src' : 'href']
    if (!reference) {
      if (script) target.push(html.slice(node.start, node.end))
      continue
    }
    const url = new URL(reference, baseUrl)
    if (url.protocol !== 'file:') {
      warnings.push(`Static detection did not fetch ${url.protocol} ${script ? 'script' : 'stylesheet'}; runtime verification required`)
      continue
    }
    // Read only directly linked code/style files; imports and remote resources belong to capture preflight.
    if (!(script ? ['.js', '.mjs'] : ['.css']).includes(extname(url.pathname).toLowerCase())) {
      warnings.push('Static detection skipped a linked resource with an unsupported extension')
      continue
    }
    try {
      const path = root === undefined ? fileURLToPath(url) : await confinedPath(root, fileURLToPath(url))
      if (!(await stat(path)).isFile()) throw new Error('not a regular file')
      target.push(await readFile(path, 'utf8'))
    } catch (error) {
      if (error instanceof PathEscapeError) throw error
      warnings.push(`Cannot read linked ${script ? 'script' : 'stylesheet'} ${reference}: ${(error as NodeJS.ErrnoException).code ?? (error as Error).message}`)
    }
  }
  const code = scripts.join('\n')
  const hash = /(?:location|window\.location)\s*\.\s*hash/.test(code) &&
    (/#(?:\\)?\//.test(code) || links.some(link => /^#\/\d+/.test(link)))
  const query = /(?:\blocation\s*\.\s*search\b|new\s+URL\(\s*(?:window\.)?location\.href\s*\))/.test(code) &&
    /(?:\.get\s*\(\s*['"]slide['"]\s*\)|(?:[?&]|\[\?&\])slide=)/.test(code)
  if (hash && query && !guizang) throw new Error('Ambiguous deck navigation: both #/N and ?slide=N found')
  const size = designSize(nodes, slides, styles)
  const format: DeckFormat = guizang ? 'guizang' : query ? 'query' : hash ? 'hash' : size ? 'fixed-canvas' : 'generic'
  const navigation = guizang || query ? 'query' : hash ? 'hash' : 'dom'
  const extracted = speakerNotes(scripts)
  if (extracted.runtime) warnings.push('Speaker notes contain runtime JavaScript; extract window.__SPEAKER_NOTES__ during capture')
  return {
    inputPath, format, navigation, designSize: size, runtimeNotes: extracted.runtime, warnings,
    slides: slides.map((slide, i) => {
      const url = new URL(baseUrl)
      if (guizang) url.searchParams.set('mode', 'preview')
      if (navigation === 'query') url.searchParams.set('slide', String(i + 1))
      if (navigation === 'hash') url.hash = `/${i + 1}`
      const id = slide.attrs['data-slide-id']
      const result: DeckSlide = { index: i + 1, id, title: slide.attrs['data-title'], selector: slide.selector, url: url.href }
      const speaker = id === undefined ? undefined : extracted.notes.get(id)
      const asides = nodes.filter(node => node.tag === 'aside' && hasClass(node, 'notes') && !ignored(node) &&
        ancestors(node).find(parent => parent.tag === 'section' && hasClass(parent, 'slide')) === slide)
      if (speaker !== undefined) {
        result.notes = speaker
        result.notesSource = 'speaker-notes'
      } else if ('data-notes' in slide.attrs) {
        result.notes = slide.attrs['data-notes']!
        result.notesSource = 'data-notes'
      } else if (asides.length) {
        result.notes = asides.map(node => noteText(html.slice(node.start, node.end))).join('\n')
        result.notesSource = 'aside.notes'
      }
      return result
    }),
  }
}
