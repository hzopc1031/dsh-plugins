const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;
const packageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
export function object(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('需要 JSON 对象');
    return value;
}
export function string(value, label, max = 8000) {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))
        throw new Error(label + ' 无效');
    return value;
}
export function timestamp(value) {
    const v = string(value, '时间', 40);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v)
        throw new Error('时间必须为 ISO UTC');
    return v;
}
export function identifier(value) {
    const v = string(value, 'ID', 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v))
        throw new Error('ID 必须为 UUID v4');
    return v;
}
function plugin(value) {
    const p = object(value), name = string(p.name, '包名', 214), version = string(p.version, '精确版本', 100);
    if (!packageName.test(name) || !exactVersion.test(version))
        throw new Error('需要合法 npm 包名与精确 SemVer，不能用范围、tag 或 git 地址');
    return { name, version };
}
function environment(value) {
    const e = object(value);
    if (e.platform !== 'win32' || e.client !== 'official-desktop')
        throw new Error('仅支持 Windows 官方桌面 DSH');
    const version = string(e.version, '桌面版本', 100);
    if (!exactVersion.test(version))
        throw new Error('桌面版本必须精确');
    return { platform: 'win32', client: 'official-desktop', version, machine: string(e.machine, '机器标识', 200) };
}
function input(value) {
    const p = object(value);
    if (!Array.isArray(p.plugins) || p.plugins.length !== 2)
        throw new Error('首版必须且只能选择两个插件');
    const a = plugin(p.plugins[0]), b = plugin(p.plugins[1]);
    if (a.name === b.name)
        throw new Error('两个插件的包名必须不同');
    // Canonical identity makes an upgrade comparable even if selection order changes.
    const plugins = [a, b].sort((x, y) => x.name.localeCompare(y.name, 'en'));
    return { plugins, environment: environment(p.environment), workspace: string(p.workspace, '工作区标识', 500), configBaseline: string(p.configBaseline, '配置基线标识', 500) };
}
export const checks = [
    { id: 'input.tools', surface: 'input', kind: 'tools', instructions: '在输入框触发两个插件公开的工具入口；核对名称、归属及实际结果，记录重复注册错误或被覆盖的工具。没有相关入口则记 unsupported。' },
    { id: 'input.commands', surface: 'input', kind: 'commands', instructions: '在输入框发现并逐一执行目标插件命令；核对同名命令是否重复、消失或执行到另一插件。' },
    { id: 'input.shortcut', surface: 'input', kind: 'shortcut', instructions: '先聚焦输入框，再按目标插件快捷键；记录按键、焦点、预期归属及实际动作，检查抢占。' },
    { id: 'sidebar.panel', surface: 'sidebar', kind: 'panel', instructions: '在侧栏逐一打开两个插件面板，再互相切换；检查入口、内容、焦点及面板是否被覆盖。' },
    { id: 'sidebar.shortcut', surface: 'sidebar', kind: 'shortcut', instructions: '聚焦侧栏后按目标快捷键，记录是否抢占另一插件或输入框动作。' },
    { id: 'session-menu.commands', surface: 'session-menu', kind: 'commands', instructions: '打开同一会话的菜单，逐项触发目标插件入口；核对重复、缺失、归属错误及实际动作。' },
    { id: 'session-menu.shortcut', surface: 'session-menu', kind: 'shortcut', instructions: '打开会话菜单后按目标快捷键；核对焦点与动作归属，检查抢占。' },
    ...['input', 'sidebar', 'session-menu'].map(surface => ({
        id: surface + '.persistence', surface, kind: 'persistence',
        instructions: '记录此交互面的非敏感配置键与实际值；完全退出 DSH（含托盘）后重开，再检查配置和界面效果。填写 restart.before/after 与 fullyExited:true；不要记录凭据。'
    })),
];
export function createPlan(value, id, createdAt) {
    const data = input(value), [a, b] = data.plugins;
    const enabled = [['baseline', []], ['a', [a]], ['b', [b]], ['ab', [a, b]], ['ba', [b, a]]];
    const runs = enabled.map(([id, plugins]) => ({
        id, enabled: plugins,
        instructions: '保持同一工作区与配置基线；仅保留官方必需插件和回归台，排除其他第三方插件。手动核对精确版本及启用集，恢复配置基线。' +
            (id === 'baseline' ? '关闭两个目标插件，记录空白对照。' : '按 enabled 顺序启用目标插件，完全退出（含托盘）再重开；记录实际操作顺序。') +
            (id === 'ba' ? '此轮用于检查反向启用顺序；不能从安装顺序推断实际内部加载顺序。' : '')
    }));
    const plan = { ...data, id: identifier(id), createdAt: timestamp(createdAt), checks: structuredClone([...checks]), runs, steps: runs.flatMap(run => checks.map(check => ({ id: run.id + ':' + check.id, run: run.id, check: check.id }))) };
    return { schemaVersion: 1, plan, observations: [] };
}
function sameRefs(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
export function validateObservation(plan, value) {
    const o = object(value), stepId = string(o.stepId, '步骤 ID', 100), step = plan.steps.find(s => s.id === stepId);
    if (!step)
        throw new Error('步骤不存在');
    if (!['desktop-manual', 'headless', 'static'].includes(String(o.source)) || !['pass', 'fail', 'blocked', 'unsupported'].includes(String(o.outcome)))
        throw new Error('证据来源或结果无效');
    const source = o.source, outcome = o.outcome;
    if (!Array.isArray(o.enabled))
        throw new Error('必须记录实际启用的目标插件');
    const enabled = o.enabled.map(plugin);
    if (!sameRefs(enabled, plan.runs.find(r => r.id === step.run).enabled))
        throw new Error('实际目标插件、精确版本或启用顺序与该轮不符');
    const observation = { stepId, source, outcome, evidence: string(o.evidence, '操作与结果证据'), observer: string(o.observer, '记录人', 200), observedAt: timestamp(o.observedAt), enabled };
    if (source === 'desktop-manual') {
        observation.environment = environment(o.environment);
        if (JSON.stringify(observation.environment) !== JSON.stringify(plan.environment))
            throw new Error('桌面环境与计划不符，请新建计划');
        if (plan.checks.find(c => c.id === step.check).kind === 'persistence' && ['pass', 'fail'].includes(outcome)) {
            const restart = object(o.restart);
            if (restart.fullyExited !== true)
                throw new Error('必须确认完全退出含托盘后重启');
            const before = string(restart.before, '重启前配置'), after = string(restart.after, '重启后配置');
            if ((outcome === 'pass') !== (before === after))
                throw new Error('配置持久化结果与重启前后值不一致');
            observation.restart = { before, after, fullyExited: true };
        }
    }
    return observation;
}
export function record(study, value) {
    const observation = validateObservation(study.plan, value);
    const previous = study.observations.at(-1);
    if (Date.parse(observation.observedAt) < Date.parse(study.plan.createdAt) || (previous && observation.observedAt < previous.observedAt))
        throw new Error('记录时间不能早于计划或已有记录');
    return { schemaVersion: 1, plan: structuredClone(study.plan), observations: [...structuredClone(study.observations), observation] };
}
/** Reconstruct the plan from authoritative inputs; never trust imported checks or derived results. */
export function parseStudy(value) {
    const s = object(value), p = object(s.plan);
    if (s.schemaVersion !== 1 || !Array.isArray(s.observations) || s.observations.length > 20000)
        throw new Error('存档格式或大小无效');
    let study = createPlan(p, identifier(p.id), timestamp(p.createdAt));
    if (JSON.stringify(p) !== JSON.stringify(study.plan))
        throw new Error('计划结构损坏或不是本版生成的计划');
    let previous = study.plan.createdAt;
    for (const raw of s.observations) {
        const o = validateObservation(study.plan, raw);
        if (o.observedAt < previous)
            throw new Error('记录时间不能早于计划或已有记录');
        previous = o.observedAt;
        study.observations.push(o);
    }
    return study;
}
export function latest(study, stepId) { return study.observations.findLast(o => o.stepId === stepId); }
export function status(study, stepId) {
    if (!study.plan.steps.some(s => s.id === stepId))
        throw new Error('步骤不存在');
    const o = latest(study, stepId);
    if (!o)
        return 'pending-desktop';
    if (o.source !== 'desktop-manual')
        return 'non-desktop-only';
    if (o.outcome === 'unsupported')
        return 'unable-to-automate';
    if (o.outcome === 'blocked')
        return 'blocked';
    return o.outcome === 'pass' ? 'desktop-pass' : 'desktop-fail';
}
export function reduce(study, check, order = 'ab') {
    if (!study.plan.checks.some(c => c.id === check) || !['ab', 'ba'].includes(order))
        throw new Error('检查项或启用顺序无效');
    const states = Object.fromEntries(study.plan.runs.map(r => [r.id, status(study, r.id + ':' + check)]));
    const next = ['baseline', 'a', 'b', order].filter(r => !['desktop-pass', 'desktop-fail'].includes(states[r])).map(r => r + ':' + check);
    let verdict = 'awaiting-pair', minimal = null;
    if (states[order] === 'desktop-pass')
        verdict = 'pair-passes';
    else if (states[order] === 'desktop-fail') {
        if (states.baseline === 'desktop-fail') {
            verdict = 'environment-failure';
            minimal = [];
        }
        else if (states.baseline !== 'desktop-pass')
            verdict = 'needs-controls';
        else if (states.a === 'desktop-fail' || states.b === 'desktop-fail') {
            verdict = 'single-failure';
            minimal = [study.plan.plugins[states.a === 'desktop-fail' ? 0 : 1]];
        }
        else if (states.a === 'desktop-pass' && states.b === 'desktop-pass') {
            verdict = 'minimal-pair';
            minimal = structuredClone(study.plan.plugins);
        }
        else
            verdict = 'needs-controls';
    }
    const run = study.plan.runs.find(r => r.id === order);
    const target = minimal === null ? run.enabled : run.enabled.filter(p => minimal.some(m => m.name === p.name));
    const reproduction = [
        'Windows 官方桌面 DSH ' + study.plan.environment.version + ' / ' + study.plan.environment.machine,
        '工作区：' + study.plan.workspace + '；配置基线：' + study.plan.configBaseline,
        '关闭其他第三方插件（保留回归台），先做 baseline，再仅启用 A，再仅启用 B，每轮恢复基线。',
        '最小复现启用顺序：' + (target.map(p => p.name + '@' + p.version).join(' → ') || '不启用目标插件'),
        study.plan.checks.find(c => c.id === check).instructions,
        '每轮完全退出含托盘后重开；保存操作、焦点、实际结果与非敏感配置值。'
    ];
    return { check, order, verdict, minimal, next, reproduction };
}
export function compare(before, after) {
    const reasons = [], a = before.plan, b = after.plan;
    if (a.plugins.map(p => p.name).join() !== b.plugins.map(p => p.name).join())
        reasons.push('目标插件不同');
    for (const field of ['platform', 'client', 'version', 'machine'])
        if (a.environment[field] !== b.environment[field])
            reasons.push('桌面环境不同：' + field);
    if (a.workspace !== b.workspace || a.configBaseline !== b.configBaseline)
        reasons.push('工作区或配置基线不同');
    if (a.steps.map(s => s.id).join() !== b.steps.map(s => s.id).join())
        reasons.push('检查矩阵不同');
    const comparable = reasons.length === 0;
    const rows = a.steps.map(step => {
        const previous = status(before, step.id), current = b.steps.some(s => s.id === step.id) ? status(after, step.id) : 'pending-desktop';
        let change = 'inconclusive';
        if (comparable && ['desktop-pass', 'desktop-fail'].includes(previous) && ['desktop-pass', 'desktop-fail'].includes(current)) {
            change = previous === current ? 'unchanged' : previous === 'desktop-pass' ? 'regression' : 'fixed';
        }
        return { stepId: step.id, before: previous, after: current, change };
    });
    return { comparable, reasons, versions: { before: a.plugins, after: b.plugins }, rows };
}
export const labels = {
    'pending-desktop': '待桌面验证', 'unable-to-automate': '无法自动验证／当前不适用',
    'desktop-pass': '桌面人工记录通过', 'desktop-fail': '桌面人工记录失败', blocked: '桌面验证受阻',
    'non-desktop-only': '仅非桌面证据，待桌面验证'
};
const verdictLabels = {
    'awaiting-pair': '尚无组合失败证据', 'pair-passes': '该组合检查人工记录通过',
    'needs-controls': '补齐空白及单插件对照后再缩小', 'environment-failure': '空白对照也失败，不能归因目标插件',
    'single-failure': '单插件已能复现，不能认定为组合冲突', 'minimal-pair': '在所记录基线与启用顺序下，两插件是最小失败组合'
};
export function renderStudy(study) {
    const p = study.plan;
    const lines = ['# 桌面组合回归台', '计划：' + p.id, p.plugins.map(x => x.name + '@' + x.version).join(' + '),
        '仅 Windows 官方桌面；所有通过均为人工证据声明，回归台未自动检测原生桌面。',
        '环境：' + JSON.stringify(p.environment), '工作区：' + p.workspace + '；配置基线：' + p.configBaseline,
        '共 ' + p.steps.length + ' 步；待验证或不适用的项不会算通过。', '', '## 执行轮次'];
    for (const run of p.runs)
        lines.push(run.id + '：' + run.enabled.map(x => x.name + '@' + x.version).join(' → '), run.instructions);
    lines.push('', '## 检查动作');
    for (const c of p.checks)
        lines.push(c.id + '：' + c.instructions);
    lines.push('', '## 步骤状态');
    for (const s of p.steps)
        lines.push(s.id + '：' + labels[status(study, s.id)]);
    lines.push('', '## 缩小结果');
    for (const check of p.checks)
        for (const order of ['ab', 'ba']) {
            const r = reduce(study, check.id, order);
            lines.push(check.id + ' / ' + order + '：' + verdictLabels[r.verdict] + (r.next.length ? '；下一步 ' + r.next.join(', ') : ''));
            if (['minimal-pair', 'single-failure', 'environment-failure'].includes(r.verdict)) {
                lines.push('最小清单：' + (r.minimal?.map(x => x.name + '@' + x.version).join(', ') || '无目标插件'), ...r.reproduction);
            }
        }
    lines.push('', '## 证据历史（按录入顺序，状态使用每步最后一条）');
    for (const o of study.observations)
        lines.push(JSON.stringify(o));
    return lines.join('\n');
}
export function observationTemplate(study, stepId, now) {
    const step = study.plan.steps.find(s => s.id === stepId);
    if (!step)
        throw new Error('步骤不存在');
    return {
        stepId, source: 'desktop-manual', outcome: 'blocked', evidence: '请人工核对环境、精确版本、实际启用集与顺序，再填写操作和实际结果；默认仍为受阻。',
        observer: '请填写记录人', observedAt: timestamp(now), environment: structuredClone(study.plan.environment),
        enabled: structuredClone(study.plan.runs.find(r => r.id === step.run).enabled)
    };
}
