import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../index.js';

test('registers an explicit command and agent tool', async () => {
  const commands = [], tools = [];
  const ctx = {
    effect(fn) { fn(); },
    commands: { register(definition) { commands.push(definition); } },
    tools: { register(definition) { tools.push(definition); } },
  };
  apply(ctx, {});
  assert.deepEqual(commands.map(c => c.name), ['douyin-hotlist', 'douyin-index-cache', 'douyin-comments', 'douyin-open']);
  assert.deepEqual(tools.map(t => t.name), ['douyin_local_hotlist', 'douyin_local_index_cache']);
  assert.match((await commands[0].handler({ rawInput: 'unexpected' })).text, /用法/);
  assert.match((await commands[0].handler({ rawInput: '' })).text, /绝对路径/);
  assert.match((await commands[1].handler({ rawInput: '词' })).text, /用法/);
});
