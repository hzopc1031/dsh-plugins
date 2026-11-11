/** Character bigram Dice similarity works for English and Chinese without a tokenizer dependency. */
export function similarity(a, b) {
    const grams = (s) => {
        const chars = [...s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3000)];
        return new Set(chars.slice(1).map((c, i) => chars[i] + c));
    };
    const x = grams(a), y = grams(b);
    return x.size && y.size ? 2 * [...x].filter(c => y.has(c)).length / (x.size + y.size) : 0;
}
export function duplicateOf(item, peers) {
    return peers.filter(p => p.kind === 'issue' && p.number < item.number).find(p => similarity(p.title, item.title) >= 0.86 ||
        similarity(p.title, item.title) >= 0.55 && item.body.length > 80 && p.body.length > 80 && similarity(p.body, item.body) >= 0.9)?.number;
}
export function rules(item, peers = []) {
    if (item.kind === 'issue') {
        const duplicate = duplicateOf(item, peers);
        const repro = /(?:steps to reproduce|reproduction|复现步骤|重现步骤)[\s\S]{0,120}(?:\d[.)、]|\n[-*]|\x60|https?:)|(?:1[.)、].+\n[\s\S]*2[.)、])|复现[：:].{10}/i.test(item.body);
        const version = /(?:version|版本)[^\n]{0,60}\d|\bv?\d+\.\d+(?:\.\d+)?/i.test(item.body);
        const log = /\x60{3}[^\x60]*(?:error|exception|stack|trace|错误)|(?:error:|exception:|报错[：:]|日志[：:])\s*\S+/i.test(item.body);
        const evidence = [duplicate ? '疑似重复 #' + duplicate + '（相似度启发式，需人工核对）' : '',
            repro ? '有复现步骤' : '缺复现步骤', version ? '有版本信息' : '缺版本信息', log ? '有日志/报错' : '缺日志/报错',
            /^#{1,4}\s+/m.test(item.body) ? '有模板分段（未验证仓库特定模板）' : '缺 issue 模板关键分段（通用启发式）',
            item.locations?.length ? '关键词粗略定位：' + item.locations.join(', ') : '未定位（没有代码级复现证明）',
            ...(item.notes ?? [])].filter(Boolean);
        return { kind: 'issue', evidence };
    }
    const files = item.files ?? [], notes = item.notes ?? [];
    const suspicious = files.filter(f => /(^|\/)(?:package\.json|[^/]*lock[^/]*|[^/]*\.(?:lock|exe|dll|so|dylib|bin|wasm)|Dockerfile|Makefile|[^/]*\.(?:sh|ps1|bat|cmd))$|^\.github\/workflows\/|(^|\/)(?:scripts|permissions?)\/|(?:requirements|pyproject|Cargo|go\.(?:mod|sum)|pom\.xml|composer\.json|Gemfile|Pipfile|build\.gradle|setup\.py)/i.test(f.path));
    const testFiles = files.filter(f => /(?:^|\/)(?:tests?|__tests__)\/|[._-](?:test|spec)\.|test_[^/]+|_test\./i.test(f.path));
    const code = files.some(f => /\.(?:[cm]?[jt]sx?|py|rs|go|java|c|cpp|h|cs|rb)$/.test(f.path) && !testFiles.includes(f));
    const failed = item.ci?.filter(c => c.state === 'fail') ?? [], pending = item.ci?.filter(c => c.state === 'pending') ?? [];
    const large = (item.changedFiles ?? files.length) > 30 || (item.additions ?? 0) + (item.deletions ?? 0) > 1000;
    const linked = item.linked ?? [];
    const match = linked.some(i => similarity(item.title + ' ' + item.body.slice(0, 500), i.title + ' ' + i.body.slice(0, 500)) > 0.45);
    const evidence = [
        '改了 ' + (item.changedFiles ?? files.length) + ' 个文件，新增 ' + (item.additions ?? 0) + ' / 删除 ' + (item.deletions ?? 0) + ' 行',
        testFiles.length ? '有测试改动：' + testFiles.length + ' 个文件' : code ? '有代码改动但没加测试' : '未见测试改动（可能仅文档/配置）',
        ...failed.map(c => 'CI 失败: ' + c.name), ...pending.map(c => 'CI 未完成: ' + c.name),
        !item.ci?.length ? 'CI/check 状态未知' : '',
        ...suspicious.map(f => '可疑/敏感改动：' + f.path + (f.patch && /postinstall|preinstall|chmod|permissions:|curl|wget|exec\(/i.test(f.patch) ? '（含安装/执行/权限线索）' : '')),
        large ? '改动规模超过 30 文件或 1000 行' : '',
        item.draft ? '草稿 PR' : '',
        linked.length ? '关联 issue：' + linked.map(i => '#' + i.number).join(', ') + (match ? '；文本有对应线索，未验证实际修复' : '；文本对应性不足，需核对实际修复') : '未定位同仓库关联 issue（Fixes #n 等）',
        ...notes,
    ].filter(Boolean);
    return { kind: 'pr', evidence: evidence.slice(0, 40) };
}
