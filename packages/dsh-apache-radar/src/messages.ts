import { readFileSync } from 'node:fs'

const messages = (JSON.parse(readFileSync(new URL('../locale/zh.json', import.meta.url), 'utf8')) as {
  messages: Record<string, string>
}).messages

// CommandInvocation has no locale field; the MVP command and brief use Chinese.
export function message(key: string, values: Record<string, string | number> = {}): string {
  const template = messages[key]
  if (template === undefined) throw new Error(`Missing Apache Radar message: ${key}`)
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    if (values[name] === undefined) throw new Error(`Missing Apache Radar message value: ${key}.${name}`)
    return String(values[name])
  })
}
