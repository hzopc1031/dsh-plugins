function stringValue(token: string): string {
  const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' }
  return token.slice(1, -1).replace(/\\(?:u\{([\da-fA-F]{1,6})\}|u([\da-fA-F]{4})|x([\da-fA-F]{2})|(\r?\n)|([^\r\n]))/g,
    (_match, codepoint: string, unicode: string, hex: string, newline: string, char: string) => {
      if (codepoint) return String.fromCodePoint(parseInt(codepoint, 16))
      if (unicode || hex) return String.fromCharCode(parseInt(unicode || hex, 16))
      if (newline) return ''
      if (/[ux1-9]/.test(char)) throw new Error('Unsupported string escape')
      return escapes[char] ?? char
    })
}

// Accept data literals only: never eval, import, or run user deck JavaScript.
function literal(source: string): unknown {
  const tokens = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\\r\n])*"|'(?:\\[\s\S]|[^'\\\r\n])*'|[{}\[\],:]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|[a-z_$][\w$]*/giy
  const json: string[] = []
  let depth = 0
  for (let token; (token = tokens.exec(source));) {
    const value = token[0]
    if (/^\s|^\//.test(value)) continue
    if (value === '{' || value === '[') depth++
    if (value === '}' || value === ']') {
      depth--
      if (json.at(-1) === ',') json.pop()
    }
    if (value.startsWith('"') || value.startsWith("'")) json.push(JSON.stringify(stringValue(value)))
    else if (/^[a-z_$]/i.test(value) && !['true', 'false', 'null'].includes(value)) {
      if (!/^\s*:/.test(source.slice(tokens.lastIndex))) throw new Error('Runtime expression in notes')
      json.push(JSON.stringify(value))
    } else json.push(value)
    if (depth === 0) {
      if (!/^\s*(?:;|$)/.test(source.slice(tokens.lastIndex))) throw new Error('Runtime expression after notes')
      return JSON.parse(json.join(''))
    }
  }
  throw new Error('Notes are not a static data literal')
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const lines = Object.entries(value).filter(([key]) => key !== 'id').flatMap(([, field]) =>
    typeof field === 'string' ? [field] : Array.isArray(field) ? field.filter(item => typeof item === 'string') : [])
  return lines.length ? lines.join('\n') : undefined
}

export function speakerNotes(scripts: string[]): { notes: Map<string, string>; runtime: boolean } {
  const notes = new Map<string, string>()
  let runtime = false
  for (const script of scripts) {
    const assignments = [...script.matchAll(/\bwindow\s*\.\s*__SPEAKER_NOTES__\s*=\s*/g)]
    const assignment = assignments.at(-1)
    if (!assignment) continue
    try {
      if (assignments.length !== 1) throw new Error('Multiple notes assignments require runtime extraction')
      let source = script.slice(assignment.index + assignment[0].length)
      const reference = /^([a-z_$][\w$]*)\s*;/i.exec(source)
      if (reference) {
        const declaration = new RegExp(`\\b(?:const|let|var)\\s+${reference[1]!.replace(/\$/g, '\\$')}\\s*=\\s*`).exec(script)
        if (!declaration) throw new Error('Runtime notes variable')
        source = script.slice(declaration.index + declaration[0].length)
      }
      const value = literal(source)
      const entries = Array.isArray(value) ? value.map(item => [item?.id, item]) : Object.entries(value as object)
      notes.clear()
      for (const [id, note] of entries) {
        const content = text(note)
        if (typeof id !== 'string' || content === undefined || notes.has(id)) throw new Error('Unresolved notes entry')
        notes.set(id, content)
      }
    } catch {
      notes.clear()
      runtime = true
    }
  }
  return { notes, runtime }
}
