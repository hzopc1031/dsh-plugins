// Ported from dsh-advisory-impact (hzopc1031, MIT); official source semantics retained.
import type {
  Advisory, AdvisoryPage, OfficialVerdict, PinVerdict, ProjectVerdicts,
  SuppressionPage, VersionPin, VersionRange,
} from './types.js'

const VERSION = String.raw`\d+(?:\.\d+)+`
const NUMERIC = new RegExp(`^${VERSION}$`)
const INTERVAL = new RegExp(`^(?:from |at )?(${VERSION})\\s*(before|through|to|-)\\s*(${VERSION})$`, 'i')
const SINGLE = new RegExp(`^(${VERSION})$`)
const MISSING_PIN = '未填写运行版本，无法判断'

function compare(a: string, b: string): number {
  const left = a.split('.').map(BigInt)
  const right = b.split('.').map(BigInt)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i] ?? 0n
    const y = right[i] ?? 0n
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

function component(value: string): string {
  const name = value.toLowerCase().replace(/^apache\s+/, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  const aliases: Record<string, string> = {
    'kafka client': 'kafka clients', 'kafka connect api': 'kafka connect',
    'connect api': 'kafka connect', 'connect runtime': 'kafka connect',
    'native hdfs client': 'hadoop native hdfs', 'libhdfs native library': 'hadoop native hdfs',
    'hadoop hdfs native client': 'hadoop native hdfs',
  }
  return aliases[name] ?? name
}

function pinComponent(pin: VersionPin, project: string): string | null {
  const artifacts: Record<string, string> = {
    'org.apache.kafka:kafka-clients': 'kafka clients',
    'org.apache.kafka:kafka-streams': 'kafka streams',
    'org.apache.kafka:connect-api': 'kafka connect',
    'org.apache.kafka:connect-runtime': 'kafka connect',
    'org.apache.flink:flink-core': 'flink',
    'org.apache.hadoop:hadoop-common': 'hadoop',
  }
  const explicit = pin.component ? component(pin.component) : undefined
  if (!pin.maven) return explicit ?? project
  const mapped = artifacts[pin.maven]
  return mapped && (!explicit || explicit === mapped) ? mapped : null
}

function versionText(text: string, products: readonly string[]): { product: string; text: string } | null {
  const line = text.trim()
  for (const product of [...products].sort((a, b) => b.length - a.length)) {
    if (line.toLowerCase().startsWith(product.toLowerCase() + ' ')) {
      // Official Kafka fields sometimes name the corresponding Maven artifacts in parentheses.
      const rest = line.slice(product.length).trim().replace(/^\([^()]+\)\s*/, '').replace(/^:\s*/, '')
      return { product, text: rest }
    }
  }
  return products.length === 1 ? { product: products[0]!, text: line } : null
}

export function parseAffectedRanges(advisory: Advisory): VersionRange[] | null {
  if (!advisory.affectedText?.trim()) return null
  const ranges: VersionRange[] = []
  for (const line of advisory.affectedText.trim().split('\n')) {
    const field = versionText(line, advisory.products)
    if (!field) return null
    const parts = field.text.replace(/\.$/, '').split(/\s*,\s*/)
    let exclusive = false
    for (const part of parts) {
      const interval = part.match(INTERVAL)
      const single = part.match(SINGLE)
      if (!interval && !single || exclusive && single) return null
      const lower = interval?.[1] ?? single![1]!
      const upper = interval?.[3] ?? lower
      const upperInclusive = interval?.[2]?.toLowerCase() !== 'before'
      if (compare(lower, upper) > 0 || compare(lower, upper) === 0 && !upperInclusive) return null
      ranges.push({ product: field.product, lower, lowerInclusive: true, upper, upperInclusive })
      exclusive = !upperInclusive
    }
  }
  return ranges.length ? ranges : null
}

interface FixedVersions {
  versions: string[]
  from?: string
}

function fixedVersions(advisory: Advisory): FixedVersions | null {
  if (!advisory.fixedText) return { versions: [] }
  if (new Set(advisory.products.map(component)).size !== 1) return null
  const field = versionText(advisory.fixedText, advisory.products)
  if (!field) return null
  let text = field.text
  if (advisory.project === 'flink') {
    const recommendation = text.match(/\b(?:upgrade|update)\b.*?\bversion(?: to)? (.+?)(?:,? which\b.*|\.$)/i)
      ?? text.match(/^All users should upgrade to Flink (.+?) if their Flink instance\(s\) are exposed\.$/)
    if (!recommendation) return null
    text = recommendation[1]!
  }
  text = text.trim().replace(/\.$/, '')
  const later = /\s+(?:and later|or newer|onwards)$/i.test(text)
  text = text.replace(/\s+(?:and later|or newer|onwards)$/i, '')
  const versions = text.split(/\s*,\s*|\s+(?:and|or)\s+/i)
  return versions.every(v => NUMERIC.test(v)) ? { versions, ...(later ? { from: versions.at(-1)! } : {}) } : null
}

function matchPin(advisory: Advisory, pin: VersionPin, ranges: VersionRange[] | null, fixed: FixedVersions | null): PinVerdict {
  const result = (verdict: PinVerdict['verdict'], reason: string): PinVerdict => ({ pin: { ...pin }, verdict, reason })
  if (!pin.version.trim()) return result('unknown', MISSING_PIN)
  const version = pin.version.trim()
  if (!NUMERIC.test(version)) return result('unknown', '运行版本含预发布标记或不是明确的点分数字版本，无法判断')
  const target = pinComponent(pin, advisory.project)
  if (!target || !advisory.products.some(p => component(p) === target)) {
    return result('unknown', '公告组件/产品与运行版本 pin 不匹配，无法判断')
  }
  if (!ranges) return result('unknown', '官方受影响范围无法完整解析，无法判断')
  if (!fixed) return result('unknown', '官方修复版本表述无法明确解析，无法判断')
  const applicable = ranges.filter(r => component(r.product) === target)
  if (!applicable.length) return result('unknown', '公告未提供该组件的明确范围，无法判断')
  if (fixed.versions.some(v => compare(version, v) === 0)) return result('not_affected', '运行版本是官方列出的修复版本')
  if (fixed.from && compare(version, fixed.from) >= 0) return result('not_affected', '官方修复说明明确包含该版本及后续版本')
  if (applicable.some(r => compare(version, r.lower) >= 0 && (r.upperInclusive ? compare(version, r.upper) <= 0 : compare(version, r.upper) < 0))) {
    return result('affected', '运行版本位于官方受影响范围内；仍需核对公告限制条件')
  }
  if (applicable.length === 1) return result('not_affected', '运行版本位于官方受影响范围之外')
  // shortcut: multi-range gaps require a known major/minor branch; add explicit branch metadata before extrapolating to unseen branches.
  const branch = (v: string): string => v.split('.').slice(0, 2).map(BigInt).join('.')
  const sameBranch = applicable.filter(r => branch(r.upper) === branch(version))
  if (sameBranch.length && sameBranch.every(r => r.upperInclusive ? compare(version, r.upper) > 0 : compare(version, r.upper) >= 0)) {
    return result('not_affected', '运行版本晚于同一分支的官方受影响范围')
  }
  if (applicable.every(r => compare(version, r.lower) < 0)) return result('not_affected', '运行版本早于所有官方受影响范围')
  return result('unknown', '运行版本落在多分支范围的空隙或未明确覆盖的分支，无法判断')
}

function evaluateAdvisory(advisory: Advisory, pins: readonly VersionPin[], suppressionPage?: SuppressionPage): OfficialVerdict {
  const ranges = parseAffectedRanges(advisory)
  const fixed = fixedVersions(advisory)
  const suppressions = advisory.project === 'kafka' ? suppressionPage?.suppressions.filter(s => s.id === advisory.id) ?? [] : []
  const results = pins.map(pin => matchPin(advisory, pin, ranges, fixed))
  if (suppressions.length) {
    for (const result of results) {
      result.verdict = 'unknown'
      result.reason = '该 CVE 同时有 Kafka 官方 suppression，见单独抑制说明；不作官方受影响判定'
    }
  }
  const verdict = results.some(r => r.verdict === 'affected') ? 'affected'
    : !results.length || results.some(r => r.verdict === 'unknown') ? 'unknown' : 'not_affected'
  const reason = !results.length ? MISSING_PIN : results.length === 1 ? results[0]!.reason
    : verdict === 'affected' ? '至少一个运行版本受影响；逐项结果见 pins'
    : verdict === 'unknown' ? '存在无法判断的运行版本；逐项结果见 pins' : '所有已填写运行版本均不在官方受影响范围内'
  return { ...advisory, verdict, reason, ranges, fixedVersions: fixed?.versions ?? null, pins: results, suppressions }
}

/** Pure, offline evaluation. Missing suppression data is null, never a fabricated empty official section. */
export function evaluateProject(page: AdvisoryPage, pins: readonly VersionPin[] = [], suppressionPage?: SuppressionPage): ProjectVerdicts {
  const { advisories, ...metadata } = page
  return {
    ...metadata,
    advisories: advisories.map(a => evaluateAdvisory(a, pins, suppressionPage)),
    suppressions: page.project === 'kafka' && suppressionPage
      ? { ...suppressionPage, project: 'kafka', title: '扫描器报了，但官方说明不适用' } : null,
  }
}
