import { mkdtemp, open, realpath, rename, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, isAbsolute, join, relative } from 'node:path';
import { captureDeck } from './adapters.js';
// Use 4.0.1's CJS entry to avoid its ESM metadata/declaration mismatch under NodeNext.
const PptxGenJS = createRequire(import.meta.url)('pptxgenjs');
async function syncedWrite(path, data) {
    const file = await open(path, 'wx', 0o600);
    try {
        await file.writeFile(data);
        await file.sync();
    }
    finally {
        await file.close();
    }
}
const markdownText = (value) => value.replace(/([\\`*_{}\[\]<>()!#|])/g, '\\$1').replace(/[\r\n]+/g, ' ');
function formatReport(report, reportPath, markdownReportPath) {
    const lines = [
        '# HTML 演示稿导出报告', '',
        report.status === 'completed' ? `导出完成：共 ${report.pageCount} 页，图片版 PPTX。`
            : '导出失败：未生成本次 PPTX；已有 PPTX 不会被本次失败覆盖。',
        ...(report.error ? [`原因：${markdownText(report.error)}`] : []),
        `Chrome 沙箱：${report.sandboxMode === 'enabled' ? '保留（未添加 --no-sandbox）' : '沙箱启动失败，已重试一次并使用 --no-sandbox；仅处理可信本地 HTML'}。`,
        `PPTX：${markdownText(report.pptxPath)}`, '',
    ];
    for (const page of report.pages) {
        for (const warning of page.fontWarnings.filter(warning => warning.startsWith('字体回退：'))) {
            lines.push(`- 第 ${page.index} 页${markdownText(warning)}`);
        }
        if (page.status === 'failed')
            lines.push(`- 第 ${page.index} 页失败：${markdownText(page.error ?? '未提供原因')}；${page.evidencePath ? `证据截图（相对报告目录）：${markdownText(page.evidencePath)}` : '无截图（未能保存截图证据）'}。`);
    }
    lines.push('', `详细报告：${markdownText(reportPath)}`, `中文报告：${markdownText(markdownReportPath)}`);
    return lines.join('\n') + '\n';
}
/** Assemble only captured HTML images; a failed attempt preserves any previous PPTX. */
export async function exportCapturedDeck(capture, directory, options = {}) {
    const started = performance.now();
    const fileName = options.fileName ?? 'deck.pptx';
    if (typeof fileName !== 'string' || isAbsolute(fileName) || basename(fileName) !== fileName ||
        /[\\\x00-\x1f]/.test(fileName) || !/^.+\.pptx$/i.test(fileName)) {
        throw new Error('PPTX output must be a plain .pptx filename within the export directory');
    }
    options.signal?.throwIfAborted();
    const root = await realpath(directory);
    if (!(await stat(root)).isDirectory())
        throw new Error('Export directory must be an existing directory');
    const pptxPath = join(root, fileName);
    const reportPath = join(root, 'export-report.json');
    const markdownReportPath = join(root, 'export-report.md');
    const staging = await mkdtemp(join(root, '.html-deck-export-'));
    const stagedPptx = join(staging, 'deck.pptx');
    const stagedReport = join(staging, 'export-report.json');
    const stagedMarkdown = join(staging, 'export-report.md');
    const pages = capture.pages.map(({ image: _image, ...page }) => ({
        ...page, fontWarnings: page.warnings.filter(warning => /font|字体/i.test(warning)),
    }));
    const report = {
        status: 'failed', inputPath: capture.deck.inputPath, detectedFormat: capture.deck.format,
        pageCount: capture.deck.slides.length, viewport: capture.viewport, scale: capture.scale,
        format: capture.format, quality: capture.quality ?? null, browserVersion: capture.browserVersion,
        launchArgs: capture.launchArgs, sandboxMode: capture.sandboxMode, sandboxFallbackReason: capture.sandboxFallbackReason,
        networkMode: capture.allowNetwork ? 'allowed' : 'blocked', warnings: capture.deck.warnings,
        actualFontFamilies: [...new Set(pages.flatMap(page => page.actualFontFamilies))].sort(),
        pages, failedPages: pages.filter(page => page.status === 'failed'),
        totalBytes: pages.reduce((sum, page) => sum + page.bytes, 0), pptxBytes: 0,
        captureElapsedMs: capture.elapsedMs, elapsedMs: capture.elapsedMs, pptxPath,
    };
    let hasEvidence = false;
    async function publishReport() {
        report.elapsedMs = capture.elapsedMs + Math.round(performance.now() - started);
        await syncedWrite(stagedReport, JSON.stringify(report, null, 2) + '\n');
        await syncedWrite(stagedMarkdown, formatReport(report, reportPath, markdownReportPath));
        await rename(stagedReport, reportPath);
        await rename(stagedMarkdown, markdownReportPath);
        await options.onReport?.(report);
    }
    try {
        options.signal?.throwIfAborted();
        if (!pages.length || pages.length !== capture.deck.slides.length ||
            pages.some((page, i) => page.index !== i + 1 || page.id !== capture.deck.slides[i]?.id)) {
            throw new Error('Capture must contain every detected page in DOM order');
        }
        if (![capture.viewport.width, capture.viewport.height].every(n => Number.isSafeInteger(n) && n > 0) ||
            capture.viewport.width * 9 !== capture.viewport.height * 16 ||
            ![1, 2].includes(capture.scale) || !['png', 'jpeg'].includes(capture.format) ||
            (capture.quality !== undefined && (capture.format !== 'jpeg' || !Number.isInteger(capture.quality) || capture.quality < 1 || capture.quality > 100))) {
            throw new Error('Invalid capture viewport, scale, format or quality');
        }
        for (const [i, page] of capture.pages.entries()) {
            options.signal?.throwIfAborted();
            if (page.status === 'failed' && page.image?.byteLength) {
                const evidence = join(staging, `page-${i + 1}-failed.${capture.format}`);
                await syncedWrite(evidence, page.image);
                pages[i].evidencePath = relative(root, evidence);
                hasEvidence = true;
            }
        }
        if (report.failedPages.length)
            throw new Error(`${report.failedPages.length} page(s) failed capture; refusing a partial PPTX`);
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';
        pptx.author = 'hzopc1031';
        for (const page of capture.pages) {
            options.signal?.throwIfAborted();
            if (page.status !== 'captured' || !(page.image instanceof Uint8Array) || !page.bytes || page.bytes !== page.image.byteLength) {
                throw new Error(`Page ${page.index} has no complete captured image`);
            }
            if (page.notes !== undefined && /[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/u.test(page.notes)) {
                throw new Error(`Page ${page.index} notes contain characters forbidden in XML`);
            }
            const slide = pptx.addSlide();
            slide.addImage({ data: `image/${capture.format};base64,${Buffer.from(page.image).toString('base64')}`, x: 0, y: 0, w: 10, h: 5.625 });
            if (page.notes !== undefined)
                slide.addNotes(page.notes);
        }
        const data = await pptx.write({ outputType: 'nodebuffer', compression: true });
        if (!(data instanceof Uint8Array))
            throw new Error('PPTX assembly did not return bytes');
        options.signal?.throwIfAborted();
        await syncedWrite(stagedPptx, data);
        report.status = 'completed';
        report.pptxBytes = data.byteLength;
        await publishReport();
        options.signal?.throwIfAborted();
        // Commit the PPTX last: no fallible work after this rename may turn success into failure.
        await rename(stagedPptx, pptxPath);
        return { pptxPath, reportPath, markdownReportPath, summary: formatReport(report, reportPath, markdownReportPath), report };
    }
    catch (error) {
        report.status = 'failed';
        report.pptxBytes = 0;
        report.error = error instanceof Error ? error.message : String(error);
        try {
            await rm(stagedReport, { force: true });
            await rm(stagedMarkdown, { force: true });
            await publishReport();
        }
        catch (reportError) {
            throw new AggregateError([error, reportError], formatReport(report, reportPath, markdownReportPath) + `报告写入失败：${reportError.message}`);
        }
        throw new Error(formatReport(report, reportPath, markdownReportPath), { cause: error });
    }
    finally {
        await rm(stagedPptx, { force: true }).catch(() => { });
        await rm(stagedReport, { force: true }).catch(() => { });
        await rm(stagedMarkdown, { force: true }).catch(() => { });
        if (!hasEvidence)
            await rm(staging, { recursive: true, force: true }).catch(() => { });
    }
}
/** Capture and assemble with a confined, atomically replaced progress file. */
export async function exportDeck(input, directory, options = {}) {
    const root = await realpath(directory);
    if (!(await stat(root)).isDirectory())
        throw new Error('Export directory must be an existing directory');
    const progressPath = join(root, 'export-progress.json');
    const staging = await mkdtemp(join(root, '.html-deck-progress-'));
    const stagedProgress = join(staging, 'export-progress.json');
    const state = {
        inputPath: input, phase: 'launch', currentPage: 0, totalPages: null, lastError: null,
        reportPath: join(root, 'export-report.json'), markdownReportPath: join(root, 'export-report.md'),
        reportsWritten: false, pptxPath: null, failedPages: [],
    };
    let report;
    async function saveProgress() {
        await syncedWrite(stagedProgress, JSON.stringify(state, null, 2) + '\n');
        await rename(stagedProgress, progressPath);
    }
    function summary() {
        const fontFallbacks = report?.pages.reduce((sum, page) => sum + page.fontWarnings.filter(warning => warning.startsWith('字体回退：')).length, 0);
        return [
            state.phase === 'done' ? `导出完成：共 ${state.totalPages} 页，图片版 PPTX。`
                : `导出失败${options.signal?.aborted ? '（已取消）' : ''}：当前第 ${state.currentPage} 页 / 共 ${state.totalPages ?? '未知'} 页；未生成本次 PPTX。`,
            `字体回退警告：${fontFallbacks === undefined ? '未完成统计' : `${fontFallbacks} 条`}；失败页：${state.failedPages.length ? state.failedPages.map(page => page.index).join('、') : state.phase === 'done' ? '无' : '无已记录失败页'}。`,
            ...(state.lastError ? [`原因：${state.lastError}`] : []),
            ...state.failedPages.map(page => `第 ${page.index} 页失败：${page.error ?? '未提供原因'}；${page.evidencePath ? `证据截图：${join(root, page.evidencePath)}` : '无截图'}。`),
            ...(state.pptxPath ? [`PPTX：${state.pptxPath}`] : []),
            `进度：${progressPath}`,
            `${state.reportsWritten ? '详细报告' : '本次报告尚未生成，以下路径可能是上次报告'}：${state.reportPath}`,
            `中文报告：${state.markdownReportPath}`,
        ].join('\n');
    }
    try {
        await saveProgress();
        options.signal?.throwIfAborted();
        const capture = await captureDeck(input, { ...options, async onProgress(update) {
                state.inputPath = update.inputPath;
                state.phase = update.phase;
                state.currentPage = update.currentPage;
                state.totalPages = update.totalPages;
                state.lastError = update.error ?? state.lastError;
                await saveProgress();
            } });
        state.phase = 'assemble';
        await saveProgress();
        const result = await exportCapturedDeck(capture, root, { fileName: options.fileName, signal: options.signal,
            async onReport(published) {
                report = published;
                state.phase = published.status === 'completed' ? 'done' : 'failed';
                state.lastError = published.failedPages.at(-1)?.error ?? published.error ?? null;
                state.failedPages = published.failedPages.map(({ index, error, evidencePath }) => ({ index, error, evidencePath }));
                state.reportsWritten = true;
                state.pptxPath = published.status === 'completed' ? published.pptxPath : null;
                // shortcut: terminal sidecars precede PPTX commit; use a transaction manifest if crash consistency is required.
                await saveProgress();
            },
        });
        return { ...result, progressPath, summary: summary() };
    }
    catch (error) {
        state.phase = 'failed';
        state.pptxPath = null;
        state.lastError = report?.failedPages.at(-1)?.error ?? report?.error ?? (error instanceof Error ? error.message : String(error));
        try {
            await rm(stagedProgress, { force: true });
            await saveProgress();
        }
        catch (progressError) {
            throw new AggregateError([error, progressError], summary() + `\n进度写入失败：${progressError.message}`);
        }
        throw new Error(summary(), { cause: error });
    }
    finally {
        await rm(staging, { recursive: true, force: true }).catch(() => { });
    }
}
