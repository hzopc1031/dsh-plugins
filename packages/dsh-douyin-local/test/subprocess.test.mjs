import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runHotlist, runIndexCache } from '../runner.js';

const exec = promisify(execFile);
const python = process.env.DYC_INTEGRATION_PYTHON;

test('real subprocess works with Unicode and spaced project paths', { skip: !python, timeout: 90000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh 测试 '));
  try {
    await exec(python, ['-m', 'venv', path.join(root, '.venv')], { timeout: 60000 });
    await writeFile(path.join(root, 'local_cli.py'), `import json, os, sys\nassert 'DYC_SYNTHETIC_SECRET' not in os.environ\nif sys.argv[1] == 'hotlist':\n print(json.dumps({'ok':True,'data':{'complete':True,'fetched_at':'2026-01-08','items':[{'position':1,'word':'合成话题','hot_value':None}]}},ensure_ascii=False))\nelse:\n assert sys.argv[2:] == ['--keyword=测试词','--end-date','2026-01-07']\n rows=[{'keyword':'测试词','date':f'2026-01-0{i}','search_index':i} for i in range(1,8)]\n print(json.dumps({'ok':True,'data':{'keyword':'测试词','start_date':'2026-01-01','end_date':'2026-01-07','fetched_at':'2026-01-08','rows':rows}},ensure_ascii=False))\n`, 'utf8');
    const config = { projectPath: root };
    process.env.DYC_SYNTHETIC_SECRET = 'must-not-inherit';
    assert.match(await runHotlist(config), /合成话题/);
    assert.match(await runIndexCache(config, '测试词', '2026-01-07'), /2026-01-07：7/);
  } finally {
    delete process.env.DYC_SYNTHETIC_SECRET;
    await rm(root, { recursive: true, force: true });
  }
});
