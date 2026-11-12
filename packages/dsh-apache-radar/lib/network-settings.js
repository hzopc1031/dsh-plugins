// Vendored identically in apache-radar, advisory-impact and github-triage; keep these copies in sync.
import { createElement as h, useEffect, useState } from 'react';
export const networkHint = (code) => /TLS_KEY_TOO_SMALL|key too (?:small|weak)/i.test(code)
    ? '公司证书密钥过短；请在「网络 / 设置」核对 OSV / GitHub API 的证书校验选项。'
    : /CERT|SIGNATURE|ISSUER/.test(code) ? '证书校验失败；请在「网络 / 设置」配置公司 CA。'
        : '来源连接失败；请在「网络 / 设置」检查代理或运行诊断。';
export function NetworkSettings({ view, endpoint }) {
    const [state, setState] = useState({ writable: false });
    const [saving, setSaving] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
    const value = state.value ?? {}, disabled = !state.writable || saving;
    async function request(body) {
        if (!endpoint)
            throw new Error('宿主配置编辑服务不可用。');
        const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.error ?? '网络设置保存失败，请重试。');
        return result;
    }
    useEffect(() => {
        if (view === 'summary' || !endpoint)
            return;
        let active = true;
        void request({ action: 'read' }).then(result => { if (active)
            setState(result); }).catch(() => { if (active)
            setError('无法读取网络设置，请重新打开后重试。'); });
        return () => { active = false; };
    }, [endpoint, view]);
    async function write(value) {
        setSaving(true);
        setError('');
        setSaved(false);
        try {
            setState(await request({ action: 'save', value, revision: state.revision }));
            setSaved(true);
        }
        catch (error) {
            setError(error instanceof Error ? error.message : '网络设置保存失败，请重试。');
        }
        finally {
            setSaving(false);
        }
    }
    if (view === 'summary')
        return '网络设置';
    return h('section', { className: 'ns-settings', 'aria-label': '网络设置' }, h('style', null, `.ns-settings{font-size:12px;color:var(--dsw-alias-label-secondary)}.ns-settings form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}.ns-settings label{display:flex;flex-direction:column;gap:5px;min-width:0}.ns-settings input,.ns-settings select{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px;min-width:0;width:100%}.ns-settings .ns-toggle{flex-direction:row;align-items:flex-start;margin:10px 0}.ns-settings .ns-toggle input{width:16px;height:16px;flex-shrink:0;accent-color:var(--dsw-alias-state-business-primary)}.ns-settings button{font:inherit;padding:8px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;justify-self:start}.ns-settings :is(input,select,button):focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:3px}.ns-settings [role=alert]{color:var(--dsw-alias-state-error-primary)}.ns-settings .ns-status{display:block;margin-top:10px}.ns-settings button:disabled{opacity:.5}@container (max-width:600px){.ns-settings form{grid-template-columns:minmax(0,1fr)}}`), h('form', { key: JSON.stringify([value.systemProxy, value.timeoutSeconds, value.httpsProxy, value.noProxy, value.caBundlePath]), onSubmit: (event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const timeout = Number(fields.get('timeoutSeconds'));
            if (!Number.isFinite(timeout) || timeout < 10 || timeout > 120) {
                setError('请求超时须为 10–120 秒。');
                return;
            }
            void write(Object.fromEntries(['systemProxy', 'httpsProxy', 'noProxy', 'caBundlePath', 'timeoutSeconds'].map(key => [key, key === 'timeoutSeconds' ? timeout : String(fields.get(key) ?? '')])));
        } }, h('label', null, '系统代理', h('select', { name: 'systemProxy', defaultValue: String(value.systemProxy ?? 'auto'), disabled }, h('option', { value: 'auto' }, '自动检测（含 PAC）'), h('option', { value: 'off' }, '关闭自动检测'))), h('label', null, '请求超时（秒）', h('input', { name: 'timeoutSeconds', type: 'number', min: 10, max: 120, required: true, defaultValue: Number(value.timeoutSeconds ?? 30), disabled })), ...[['httpsProxy', 'HTTPS 代理', 'http://host:port'], ['noProxy', '绕过代理', 'localhost, .example.com'], ['caBundlePath', '公司 CA 证书路径', 'PEM 文件绝对路径']].map(([key, label, placeholder]) => h('label', { key }, label, h('input', { name: key, defaultValue: String(value[key] ?? ''), placeholder, disabled, autoComplete: 'off' }))), h('button', { type: 'submit', disabled }, saving ? '正在保存…' : '保存网络设置')), ...[['insecureSkipTlsVerifyHosts', '不安全：仅跳过 OSV / GitHub API 证书校验'], ['insecureSkipTlsVerify', '不安全：跳过所有来源的 TLS 证书校验']].map(([key, label]) => h('label', { key, className: 'ns-toggle' }, h('input', {
        name: key, type: 'checkbox', checked: value[key] === true, disabled,
        onChange: (event) => write({ [key]: event.target.checked }),
    }), label)), h('small', null, 'OSV / GitHub API：api.osv.dev / api.github.com。跳过校验会降低连接安全性。'), !state.writable && h('span', { className: 'ns-status' }, '网络配置暂不可编辑，请检查宿主配置权限。'), error ? h('span', { role: 'alert', className: 'ns-status' }, error) : saved && h('span', { role: 'status', className: 'ns-status' }, '网络设置已保存。'));
}
