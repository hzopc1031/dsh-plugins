import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { renderResult, runHotlist, runIndexCache, runCommentSummary, openDesktop } from '../runner.js';

const data = { ok: true, data: { complete: true, fetched_at: '2026-01-01', items: [{ position: 1, word: '合成话题', hot_value: null }] } };
test('uses fixed arguments, no shell and preserves missing heat', async () => {
  const root = path.resolve('/tmp/example');
  let calls = 0;
  const result = await runHotlist({ projectPath: root }, async (exe, args, options) => {
    calls++;
    assert.equal(exe, path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'));
    assert.deepEqual(args, [path.join(root, 'local_cli.py'), 'hotlist']);
    assert.equal(options.shell, undefined);
    assert.equal(options.env.PYTHONIOENCODING, 'utf-8');
    assert.equal(options.env.DSH_HOME, undefined);
    return { stdout: JSON.stringify(data) };
  });
  assert.equal(calls, 1);
  assert.match(result, /合成话题（热度：—）/);
});
test('index cache passes fixed argv and preserves distinction from counts', async () => {
  const root = path.resolve('/tmp/example');
  const rows = Array.from({length: 7}, (_, i) => ({ keyword: '测试', date: `2026-01-0${i + 1}`, search_index: i }));
  const text = await runIndexCache({ projectPath: root }, '测试', '2026-01-07', async (_exe, args) => {
    assert.deepEqual(args.slice(1), ['index-cache', '--keyword=测试', '--end-date', '2026-01-07']);
    return { stdout: JSON.stringify({ ok: true, data: { keyword: '测试', start_date: '2026-01-01', end_date: '2026-01-07', fetched_at: '2026-01-08', rows } }) };
  });
  assert.match(text, /本地缓存/);
  assert.match(text, /不等于实际搜索次数/);
  await assert.rejects(runIndexCache({ projectPath: root }, '测试', '2026-01-07', async () => { const e = new Error('x'); e.stderr = '{"error":{"code":"cache_miss"}}'; throw e; }), /没有找到/);
});
test('index cache rejects invalid dates, duplicate days and negative values', async () => {
  const config = { projectPath: path.resolve('/tmp/example') };
  const rows = Array.from({ length: 7 }, (_, i) => ({ keyword: '测试', date: `2026-01-0${i + 1}`, search_index: i }));
  const value = { ok: true, data: { keyword: '测试', start_date: '2026-01-01', end_date: '2026-01-07', fetched_at: '2026-01-08', rows } };
  const run = async () => ({ stdout: JSON.stringify(value) });
  await assert.rejects(runIndexCache(config, '测试', '2026-02-30', run), /有效的截止日期/);
  value.data.rows[1].date = value.data.rows[0].date;
  await assert.rejects(runIndexCache(config, '测试', '2026-01-07', run), /缓存格式无效/);
  value.data.rows[1].date = '2026-01-02';
  value.data.rows[1].search_index = -1;
  await assert.rejects(runIndexCache(config, '测试', '2026-01-07', run), /缓存格式无效/);
});
test('rejects untrusted output and hides subprocess errors', async () => {
  assert.throws(() => renderResult(JSON.stringify({ ...data, data: { ...data.data, items: [{ position: 1, word: 'a\nb', hot_value: 1 }] } })));
  await assert.rejects(runHotlist({ projectPath: path.resolve('/tmp/example') }, async () => { throw new Error('private stderr'); }), error => !error.message.includes('private stderr'));
  await assert.rejects(runHotlist({ projectPath: 'relative' }), /绝对路径/);
  await assert.rejects(runHotlist({ projectPath: path.resolve('/tmp/example') }, async () => ({ stdout: 'private output' })), error => !error.message.includes('private output'));
});
test('forwards cancellation to child process', async () => {
  const controller = new AbortController();
  const root = path.resolve('/tmp/example');
  const promise = runHotlist({ projectPath: root }, async (_exe, _args, options) => {
    assert.equal(options.signal, controller.signal);
    controller.abort();
    throw new Error('aborted');
  }, controller.signal);
  await assert.rejects(promise, /已取消/);
});
test('comment summary only accepts a run id and fixed arguments', async () => {
  const root = path.resolve('/tmp/example');
  const runId = '20261114-120000-abcdef1234';
  const value = await runCommentSummary({ projectPath: root }, runId, async (_exe, args) => {
    assert.deepEqual(args.slice(1), ['comment-summary', '--run-id', runId]);
    return { stdout: JSON.stringify({ ok: true, data: { run_id: runId, summary: '合成评论' } }) };
  });
  assert.match(value, /合成评论/);
  await assert.rejects(runCommentSummary({ projectPath: root }, '../../other'), /运行编号/);
  await assert.rejects(runCommentSummary({ projectPath: root }, runId, async () => {
    const error = new Error('private detail');
    error.stderr = '{"error":{"code":"summary_unavailable"}}';
    throw error;
  }), /结果目录权限和本机依赖/);
});
test('desktop launch uses a fixed script and only reports process creation', async () => {
  const root = path.resolve('/tmp/example');
  const child = new EventEmitter();
  let unref = false;
  child.unref = () => { unref = true; };
  const promise = openDesktop({ projectPath: root }, (_exe, args, options) => {
    assert.deepEqual(args, [path.join(root, 'app.py')]);
    assert.equal(options.stdio, 'ignore');
    assert.equal(options.shell, undefined);
    queueMicrotask(() => child.emit('spawn'));
    return child;
  });
  assert.match(await promise, /进程/);
  assert.equal(unref, true);
});
