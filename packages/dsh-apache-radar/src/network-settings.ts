// Vendored identically in apache-radar, advisory-impact and github-triage; keep these copies in sync.
import { createElement as h, useState } from 'react'

export interface NetworkSettingsProps {
  view?: 'summary' | 'page'
  form?: {
    state: { value?: Record<string, unknown>; writable: boolean; revision?: number }
    mutate(ops: { op: 'set'; path: string[]; value: boolean }[], revision?: number): Promise<boolean>
  }
}
export function NetworkSettings({ view, form }: NetworkSettingsProps) {
  const [saving, setSaving] = useState(false), [error, setError] = useState('')
  if (view === 'summary') return '网络设置'
  return h('section', { 'aria-label': '网络设置' },
    h('label', null, h('input', {
      type: 'checkbox', checked: form?.state.value?.insecureSkipTlsVerifyHosts === true,
      disabled: !form?.state.writable || saving,
      onChange: async (event: { target: { checked: boolean } }) => {
        const value = event.target.checked
        setSaving(true); setError('')
        try {
          if (!await form?.mutate([{ op: 'set', path: ['insecureSkipTlsVerifyHosts'], value }], form.state.revision)) throw new Error()
        } catch { setError('网络设置保存失败，请重试。') }
        finally { setSaving(false) }
      },
    }), '不安全：仅跳过 OSV / GitHub API 证书校验'),
    error && h('span', { role: 'alert' }, error))
}
