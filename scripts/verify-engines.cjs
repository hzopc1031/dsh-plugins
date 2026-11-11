// Read-only verification against the semver bytes and compatibility evaluator shipped by DSH.
// Usage: node scripts/verify-engines.cjs [path/to/resources/app.asar]
// The rc.5 and rc.1 official plugin-compatibility.ts blobs are identical:
// 2e4ca5736a775aceadb0a2a10140af61f94ed2ac (see docs/engines-compatibility.md).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const archive = path.resolve(process.argv[2] || path.join(process.env.LOCALAPPDATA,
  'Programs/DeepSeek Harness/resources/app.asar'));
const fd = fs.openSync(archive, 'r');
try {
  const prefix = Buffer.alloc(16);
  fs.readSync(fd, prefix, 0, 16, 0);
  const bytes = Buffer.alloc(prefix.readUInt32LE(12));
  fs.readSync(fd, bytes, 0, bytes.length, 16);
  const tree = JSON.parse(bytes);
  const base = 8 + prefix.readUInt32LE(4);
  function read(filename) {
    let entry = tree;
    for (const segment of filename.split('/')) entry = entry.files[segment];
    if (entry.unpacked) return fs.readFileSync(archive + '.unpacked/' + filename, 'utf8');
    const content = Buffer.alloc(entry.size);
    fs.readSync(fd, content, 0, content.length, base + Number(entry.offset));
    return content.toString('utf8');
  }
  // Node outside Electron cannot require an ASAR path. Load the original CommonJS
  // semver modules in memory, resolving only relative modules inside that package.
  const cache = new Map();
  function runtimeRequire(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const localRequire = name => {
      if (!name.startsWith('.')) return createRequire(__filename)(name);
      let target = path.posix.normalize(path.posix.join(path.posix.dirname(filename), name));
      assert.ok(target.startsWith('dsh/node_modules/semver/'));
      if (!target.endsWith('.js')) target += '.js';
      return runtimeRequire(target);
    };
    vm.runInThisContext('(function(require,module,exports){\n' + read(filename) + '\n})',
      { filename: archive + '/' + filename })(localRequire, module, module.exports);
    return module.exports;
  }
  const semver = runtimeRequire('dsh/node_modules/semver/index.js');
  const appBoot = JSON.parse(read('dsh/node_modules/@deepseek-ai/dsh-app-boot/package.json'));
  const semverVersion = JSON.parse(read('dsh/node_modules/semver/package.json')).version;
  assert.equal(semverVersion, '7.8.5', 're-audit if the official semver version changes');
  const built = read('dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js');
  const start = built.indexOf('function objectOf$1(value, field)');
  const end = built.indexOf('function pluginCompatibilityWarning(', start);
  assert.ok(start >= 0 && end > start, 'compatibility region was not found');
  // The unused default-version reader contains ESM syntax; replace only its URL
  // literal so the unchanged evaluator can be called from this CommonJS script.
  const source = built.slice(start, end).replaceAll('import.meta.url', JSON.stringify(archive));
  assert.match(source, /semver\.satisfies\(runtimeVersion, range, \{ includePrerelease: true \}\)/);
  // All tested calls pass an explicit version, so getDshRuntimeVersion never reads files.
  const evaluate = vm.runInThisContext('(semver => {\n' + source + '\nreturn evaluatePluginCompatibility;})')(semver);
  const common = '>=0.2.1-rc.5 <0.3.0-0';
  const apache = '>=0.2.2-rc.1 <0.3.0-0';
  const versions = ['0.2.1-rc.5', '0.2.2-rc.1', '0.2.2', '0.2.9', '0.3.0-rc.1'];
  const root = path.resolve(__dirname, '..');
  const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  console.log(`Runtime: ${archive}; app-boot ${appBoot.version}; semver ${semverVersion}; includePrerelease=true`);
  console.log('| Package | engines.dsh | ' + versions.join(' | ') + ' |');
  console.log('| --- | --- | ' + versions.map(() => '---').join(' | ') + ' |');
  for (const dir of fs.readdirSync(path.join(root, 'packages')).sort()) {
    const pkg = readJson(path.join(root, 'packages', dir, 'package.json'));
    const lock = readJson(path.join(root, 'packages', dir, 'package-lock.json'));
    const isApache = dir === 'dsh-apache-radar';
    assert.equal(pkg.engines.dsh, isApache ? apache : common);
    assert.equal(lock.version, pkg.version); assert.equal(lock.packages[''].version, pkg.version);
    assert.deepEqual(lock.packages[''].engines, pkg.engines);
    assert.deepEqual(lock.packages[''].peerDependencies, pkg.peerDependencies);
    for (const [name, version] of [['@deepseek-ai/cordis', '4.1.0'], ['@deepseek-ai/schemastery', '3.19.0']]) {
      if (pkg.peerDependencies?.[name]) assert.equal(semver.satisfies(version, pkg.peerDependencies[name]), true, `${dir}: ${name}`);
    }
    const results = versions.map(version => evaluate(pkg, {}, version) === undefined);
    assert.deepEqual(results, [!isApache, true, true, true, false]);
    for (const version of ['0.2.3-alpha.0', '0.2.9-rc.1', '0.2.999-rc.1']) assert.equal(evaluate(pkg, {}, version), undefined);
    for (const version of ['0.2.1-rc.4', '0.3.0', '0.3.1', '1.0.0']) assert.notEqual(evaluate(pkg, {}, version), undefined);
    for (const [name, range] of Object.entries(pkg.peerDependencies || {})) {
      if (!name.startsWith('@deepseek-ai/dsh-')) continue;
      if (isApache) {
        assert.equal(range, apache, `${dir}: npm peer ${name}`);
        assert.equal(semver.satisfies(versions[0], range), false, `${dir}: npm peer ${name} accepts rc.5`);
      }
      for (const version of versions.slice(isApache ? 1 : 0, -1)) {
        assert.equal(semver.satisfies(version, range), true, `${dir}: npm peer ${name} rejects ${version}`);
      }
    }
    console.log(`| ${pkg.name}@${pkg.version} | ${pkg.engines.dsh} | ${results.map(r => r ? 'PASS' : 'REJECT').join(' | ')} |`);
  }
  const legacy = '>=0.2.1-rc.5 <0.3.0';
  assert.equal(semver.satisfies('0.2.2-rc.1', legacy), false);
  assert.equal(semver.satisfies('0.2.2-rc.1', legacy, { includePrerelease: true }), true);
  assert.equal(semver.satisfies('0.3.0-rc.1', legacy, { includePrerelease: true }), true);
  const apacheLegacy = '>=0.2.2-rc.1 <0.3.0';
  assert.equal(semver.satisfies('0.2.2-rc.1', apacheLegacy, { includePrerelease: true }), true);
  console.log('PASS: original-range regression, future 0.2.x prereleases, 0.3 boundary, lock metadata and standard npm peers');
} finally {
  fs.closeSync(fd);
}
