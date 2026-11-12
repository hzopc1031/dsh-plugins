import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useId } from 'react';
import { Input } from '@deepseek-ai/dsh-client-ui-primitives';
import { z } from 'zod';
import { repoName } from './types.js';
import { editableRepoSchema, changedFields, fieldErrors, scanSchema } from './ui-contract.js';
import { UiError } from './client-route.js';
function message(error) { return error instanceof Error ? error.message : '操作失败，请刷新重试。'; }
function Errors({ errors, name, id }) {
    const error = Object.entries(errors).filter(([key]) => key === name || key.startsWith(name + '.')).map(([, v]) => v).join('；');
    return error ? _jsx("span", { id: id, role: "alert", className: "gt-field-error", children: error }) : null;
}
export function RepoForm({ initial, call, onSaved, onCancel }) {
    const [form, setForm] = useState(() => ({
        repo: initial?.repo ?? '', mode: initial?.mode ?? 'both', business: initial?.business ?? '', businessFile: initial?.businessFile ?? '',
        localRepoPath: initial?.localRepoPath ?? '', localRef: initial?.localRef ?? '', rulesFile: initial?.rulesFile ?? '',
        limit: initial?.limit?.toString() ?? '', fullMax: initial?.fullMax?.toString() ?? '',
        schedule: initial?.schedule?.kind ?? 'none', time: initial?.schedule?.kind === 'daily' ? initial.schedule.time : '09:00',
        hours: initial?.schedule?.kind === 'every' ? String(initial.schedule.hours) : '6',
    }));
    const [errors, setErrors] = useState({}), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    const dirty = useRef(new Set());
    const id = useId(), fieldId = (key) => id + '-' + key;
    const invalid = (key) => Object.keys(errors).some(name => name === key || name.startsWith(key + '.'));
    const described = (key) => [fieldId(key) + '-hint', invalid(key) ? fieldId(key) + '-error' : ''].filter(Boolean).join(' ');
    const field = (key, value) => {
        dirty.current.add(['schedule', 'time', 'hours'].includes(key) ? 'schedule' : key);
        setForm(f => ({ ...f, [key]: value }));
    };
    function normalizeRepo() {
        const parsed = repoName.safeParse(form.repo);
        if (parsed.success) {
            setForm(f => ({ ...f, repo: parsed.data }));
            setErrors(e => { const next = { ...e }; delete next.repo; return next; });
        }
        else
            setErrors(e => ({ ...e, repo: parsed.error.issues[0].message }));
    }
    async function submit(e) {
        e.preventDefault();
        if (busy)
            return;
        setErrors({});
        setNotice('');
        try {
            const parsed = repoName.safeParse(form.repo);
            if (parsed.success)
                setForm(f => ({ ...f, repo: parsed.data }));
            const value = editableRepoSchema.parse({
                repo: parsed.success ? parsed.data : form.repo, mode: form.mode, business: form.business || undefined, businessFile: form.businessFile || undefined,
                localRepoPath: form.localRepoPath || undefined, localRef: form.localRef || undefined, rulesFile: form.rulesFile || undefined,
                limit: form.limit ? Number(form.limit) : undefined, fullMax: form.fullMax ? Number(form.fullMax) : undefined,
                schedule: form.schedule === 'daily' ? { kind: 'daily', time: form.time } : form.schedule === 'every' ? { kind: 'every', hours: Number(form.hours) } : undefined,
            });
            if (value.localRef && !value.localRepoPath) {
                setErrors({ localRef: '填写 ref 前请先配置本地代码路径' });
                return;
            }
            setBusy(true);
            await call(initial ? { action: 'patch', repo: initial.repo, patch: Object.fromEntries(Object.entries(changedFields(initial, value)).filter(([key]) => dirty.current.has(key))) } : { action: 'add', value });
            await onSaved();
        }
        catch (error) {
            if (error instanceof z.ZodError)
                setErrors(fieldErrors(error));
            else {
                if (error instanceof UiError)
                    setErrors(error.fields ?? {});
                setNotice(message(error));
            }
        }
        finally {
            setBusy(false);
        }
    }
    const text = (key, label, hint) => {
        const path = ['businessFile', 'localRepoPath', 'rulesFile'].includes(key);
        return _jsxs("div", { className: 'gt-form-field' + (path || key === 'repo' ? ' gt-field-wide' : ''), children: [_jsx("label", { htmlFor: fieldId(key), children: label }), _jsx(Input, { id: fieldId(key), className: "gt-input", "aria-label": label, "aria-invalid": invalid(key) || undefined, "aria-describedby": described(key), value: form[key], title: path ? form[key] : undefined, inputMode: key === 'limit' || key === 'fullMax' ? 'numeric' : undefined, "data-modal-autofocus": key === 'repo' ? true : undefined, disabled: busy || key === 'repo' && !!initial, onBlur: key === 'repo' ? normalizeRepo : undefined, onChange: e => field(key, e.target.value) }), _jsx("small", { id: fieldId(key) + '-hint', className: "gt-field-hint", children: hint }), _jsx(Errors, { errors: errors, name: key, id: fieldId(key) + '-error' }), path && form[key] && _jsx("code", { className: "gt-path-preview", "aria-label": label + '完整值', children: form[key] })] });
    };
    return _jsxs("form", { onSubmit: e => void submit(e), className: "gt-form", "aria-label": initial ? '编辑仓库' : '添加仓库', noValidate: true, children: [_jsxs("header", { className: "gt-form-head", children: [_jsx("h3", { children: initial ? '编辑仓库' : '添加仓库' }), _jsx("button", { type: "button", "aria-label": "\u5173\u95ED\u4ED3\u5E93\u8868\u5355", disabled: busy, onClick: onCancel, children: "\u5173\u95ED" })] }), _jsxs("div", { className: "gt-form-body", children: [_jsxs("fieldset", { className: "gt-form-section", disabled: busy, children: [_jsx("legend", { children: "\u4ED3\u5E93" }), _jsxs("div", { className: "gt-form-grid", children: [text('repo', 'GitHub 仓库（owner/repo）', '可粘贴 https://github.com/owner/repo、子页面或 Git SSH 地址；离开输入框后整理为 owner/repo。'), _jsxs("div", { className: "gt-form-field", children: [_jsx("label", { htmlFor: fieldId('mode'), children: "\u5206\u6790\u7C7B\u578B" }), _jsxs("select", { id: fieldId('mode'), className: "gt-input", "aria-label": "\u5206\u6790\u7C7B\u578B", "aria-invalid": invalid('mode') || undefined, "aria-describedby": described('mode'), value: form.mode, onChange: e => field('mode', e.target.value), children: [_jsx("option", { value: "both", children: "\u95EE\u9898\u4E0E\u4EE3\u7801\u6539\u52A8\uFF08\u4E24\u8005\uFF09" }), _jsx("option", { value: "issues", children: "\u4EC5 issues" }), _jsx("option", { value: "prs", children: "\u4EC5 PR" })] }), _jsx("small", { id: fieldId('mode') + '-hint', className: "gt-field-hint", children: "\u9009\u62E9\u8981\u8DDF\u8E2A\u7684\u5F85\u529E\u7C7B\u578B\u3002" }), _jsx(Errors, { errors: errors, name: "mode", id: fieldId('mode') + '-error' })] })] })] }), _jsxs("fieldset", { className: "gt-form-section", disabled: busy, children: [_jsx("legend", { children: "\u672C\u5730\u4EE3\u7801" }), _jsxs("div", { className: "gt-form-grid", children: [text('localRepoPath', '本地代码路径（可空，绝对路径）', '填写本机 Git 仓库根目录；只读取已提交代码，不读取未提交修改。'), text('localRef', '本地 ref（可空，默认 HEAD）', '分支或提交；需先填写本地代码路径。')] })] }), _jsxs("fieldset", { className: "gt-form-section", disabled: busy, children: [_jsx("legend", { children: "\u4E1A\u52A1\u8BF4\u660E" }), _jsxs("div", { className: "gt-form-grid", children: [_jsxs("div", { className: "gt-form-field gt-field-wide", children: [_jsx("label", { htmlFor: fieldId('business'), children: "\u4E1A\u52A1\u8BF4\u660E" }), _jsx("textarea", { id: fieldId('business'), className: "gt-input gt-textarea", "aria-label": "\u4E1A\u52A1\u8BF4\u660E", "aria-invalid": invalid('business') || undefined, "aria-describedby": described('business'), value: form.business, onChange: e => field('business', e.target.value), placeholder: "\u4EA7\u54C1\u505A\u4EC0\u4E48\u3001\u6838\u5FC3\u7528\u6237\u573A\u666F\u3001\u54EA\u4E9B\u95EE\u9898\u91CD\u8981\u3001\u54EA\u4E9B\u65B9\u5411\u6682\u4E0D\u9700\u8981" }), _jsx("small", { id: fieldId('business') + '-hint', className: "gt-field-hint", children: "\u4E0E\u4E1A\u52A1\u6587\u4EF6\u5185\u5BB9\u4E00\u540C\u7528\u4E8E\u5224\u65AD\uFF0C\u53EF\u62D6\u52A8\u4E0B\u8FB9\u7F18\u8C03\u6574\u9AD8\u5EA6\u3002" }), _jsx(Errors, { errors: errors, name: "business", id: fieldId('business') + '-error' })] }), text('businessFile', '业务说明文件（仓库相对路径或本机绝对路径）', '相对路径读取 GitHub 默认分支；本机文件只读，限 16KB。'), text('rulesFile', '只读规则文件（可空，本机绝对路径）', '可选本机 UTF-8 文件，限 16KB。')] })] }), _jsxs("fieldset", { className: "gt-form-section", disabled: busy, children: [_jsx("legend", { children: "\u5B9A\u65F6\u4E0E\u4E0A\u9650" }), _jsxs("div", { className: "gt-form-grid", children: [text('limit', '普通分析单次上限（1–100，空为继承）', '留空使用插件默认上限。'), text('fullMax', '全量单次上限（1–500，空为继承）', '全量分析会增加 GitHub 请求与模型费用。'), _jsxs("div", { className: "gt-form-field", children: [_jsx("label", { htmlFor: fieldId('schedule'), children: "\u5B9A\u65F6" }), _jsxs("select", { id: fieldId('schedule'), className: "gt-input", "aria-label": "\u5B9A\u65F6", "aria-invalid": invalid('schedule') || undefined, "aria-describedby": described('schedule'), value: form.schedule, onChange: e => field('schedule', e.target.value), children: [_jsx("option", { value: "none", children: "\u4E0D\u5B9A\u65F6" }), _jsx("option", { value: "daily", children: "\u6BCF\u5929 HH:MM" }), _jsx("option", { value: "every", children: "\u6BCF N \u5C0F\u65F6" })] }), _jsx("small", { id: fieldId('schedule') + '-hint', className: "gt-field-hint", children: "\u6309\u672C\u5730\u65F6\u95F4\u8FD0\u884C\uFF1B\u9700\u8981 DSH \u6301\u7EED\u8FD0\u884C\u3002" }), _jsx(Errors, { errors: errors, name: "schedule", id: fieldId('schedule') + '-error' })] }), form.schedule !== 'none' && _jsxs("div", { className: "gt-form-field", children: [_jsx("label", { htmlFor: fieldId('timing'), children: form.schedule === 'daily' ? '每天时间' : '间隔小时' }), _jsx(Input, { id: fieldId('timing'), className: "gt-input", "aria-label": form.schedule === 'daily' ? '每天时间' : '间隔小时', "aria-invalid": invalid('schedule') || undefined, "aria-describedby": described('schedule'), value: form.schedule === 'daily' ? form.time : form.hours, onChange: e => field(form.schedule === 'daily' ? 'time' : 'hours', e.target.value) })] })] })] }), _jsx("p", { className: "gt-field-hint", children: "\u4E1A\u52A1\u6587\u5B57\u3001\u89C4\u5219\u548C\u9009\u5B9A ref \u7684\u5DF2\u63D0\u4EA4\u4EE3\u7801\u7247\u6BB5\u4F1A\u4EA4\u7ED9\u6240\u9009\u6A21\u578B\u3002\u63D2\u4EF6\u4E0D\u4FEE\u6539 GitHub \u6216\u672C\u5730\u4EE3\u7801\u3002" })] }), _jsxs("footer", { className: "gt-form-footer", children: [_jsx(Errors, { errors: errors, name: "form" }), notice && _jsx("p", { role: "alert", className: "gt-field-error", children: notice }), _jsxs("div", { className: "gt-form-actions", children: [_jsx("button", { type: "button", disabled: busy, onClick: onCancel, children: "\u53D6\u6D88\u7F16\u8F91" }), _jsx("button", { type: "submit", className: "gt-primary", disabled: busy, children: busy ? '保存中…' : '保存仓库' })] })] })] });
}
export function ScanControl({ repo, job, defaults, call, onStarted, initialFull = false }) {
    const [full, setFull] = useState(initialFull), [since, setSince] = useState(''), [until, setUntil] = useState(''), [limit, setLimit] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const active = busy || job?.status === 'running' || job?.status === 'queued';
    async function start() {
        setError('');
        setBusy(true);
        try {
            const scan = scanSchema.parse({ full, ...full ? { since: since || undefined, until: until || undefined, max: limit ? Number(limit) : undefined } : { limit: limit ? Number(limit) : undefined } });
            await call({ action: 'start', repo: repo.repo, scan });
            await onStarted();
        }
        catch (e) {
            setError(e instanceof z.ZodError ? '请检查日期范围和上限（普通 1–100，全量 1–500）。' : message(e));
        }
        finally {
            setBusy(false);
        }
    }
    return _jsxs("div", { children: [_jsxs("div", { className: "gt-row", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: full, onChange: e => { setFull(e.target.checked); setLimit(''); } }), "\u5168\u91CF\uFF08\u542B\u5173\u95ED\u6761\u76EE\uFF09"] }), full && _jsxs(_Fragment, { children: [_jsxs("label", { children: ["\u5F00\u59CB\u65E5\u671F", _jsx("input", { className: "gt-input", "aria-label": '开始日期 ' + repo.repo, type: "date", value: since, onChange: e => setSince(e.target.value) })] }), _jsxs("label", { children: ["\u7ED3\u675F\u65E5\u671F", _jsx("input", { className: "gt-input", "aria-label": '结束日期 ' + repo.repo, type: "date", value: until, onChange: e => setUntil(e.target.value) })] })] }), _jsxs("label", { children: ["\u672C\u6B21\u4E0A\u9650", _jsx("input", { className: "gt-input gt-limit", "aria-label": '本次上限 ' + repo.repo, value: limit, placeholder: String(full ? (repo.fullMax ?? defaults.fullMax) : (repo.limit ?? defaults.limit)), onChange: e => setLimit(e.target.value) })] }), _jsx("button", { disabled: active, onClick: () => void start(), children: active ? '分析进行中…' : '立即分析' }), job && _jsxs("span", { role: "status", children: [({ queued: '排队中', running: '进行中', completed: '完成', failed: '失败' })[job.status], " ", job.message] })] }), full && _jsx("small", { children: "\u6309\u6700\u540E\u66F4\u65B0\u65F6\u95F4\u7B5B\u9009\uFF0C\u8FBE\u5230\u4E0A\u9650\u4F1A\u622A\u65AD\uFF1B\u5168\u91CF\u589E\u52A0 GitHub \u8BF7\u6C42\u4E0E\u6A21\u578B\u8D39\u7528\u3002" }), _jsx("p", { role: "alert", children: error })] });
}
