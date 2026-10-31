import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';

export function registerMinimatchRegressions(consumerRequire, {legacy = false} = {}) {
  const namespace = consumerRequire('minimatch');
  const match = namespace.minimatch;
  test('patched minimatch keeps normal glob, class, defaults, brace and named APIs', () => {
    assert.equal(typeof match, 'function');
    for (const [file, pattern, options, expected] of [
      ['src/page.ts', '**/*.ts', {}, true],
      ['src/page.js', '**/*.ts', {}, false],
      ['src/.page.ts', 'src/*.ts', {}, false],
      ['src/.page.ts', 'src/*.ts', {dot: true}, true],
      ['SRC/Page.TS', 'src/*.ts', {nocase: true}, true],
      ['src/page.ts', '*.{js,ts}', {matchBase: true}, true],
      ['src/page.ts', '+(src|app)/*.ts', {}, true],
      ['src/page.ts', '!src/*.js', {}, true],
    ]) {
      assert.equal(match(file, pattern, options), expected);
      assert.equal(new namespace.Minimatch(pattern, options).match(file), expected);
    }
    assert.equal(match.defaults({nocase: true})('SRC/A.TS', 'src/*.ts'), true);
    assert.deepEqual(match.braceExpand('src/{a,b}.ts'), ['src/a.ts', 'src/b.ts']);
    assert.deepEqual(match.match(['src/a.ts', 'src/a.js'], '**/*.ts'), ['src/a.ts']);
    assert.equal(match.filter('**/*.ts')('src/a.ts'), true);
    assert.equal(typeof match.escape, 'function');
    assert.equal(typeof match.unescape, 'function');
    assert.equal(namespace.makeRe, undefined, 'removed regex engine must not return');
  });
  test('globparts amplification stays bounded at optimizationLevel 2', () => {
    const source = `const assert=require('node:assert/strict'); const {Minimatch}=require(${JSON.stringify(consumerRequire.resolve('minimatch'))}); const pattern=Array(10).fill('**/../a/b').join('/')+'/leaf'; const m=new Minimatch('ordinary',{optimizationLevel:2,braceExpandMax:64}); assert.ok(m.firstPhasePreProcess([pattern.split('/')]).length<=64); new Minimatch(pattern,{optimizationLevel:2,braceExpandMax:64}).match('a/b/leaf'); new Minimatch(Array(12).fill('**/../c/d').join('/')+'/leaf',{optimizationLevel:2,braceExpandMax:128}).match('c/d/leaf');`;
    execFileSync(process.execPath, ['-e', source], {timeout: 3000, stdio: 'pipe'});
  });
  if (!legacy) return;
  test('legacy CommonJS and Babel default imports remain callable without __esModule confusion', () => {
    assert.equal(typeof namespace, 'function');
    assert.equal(namespace.minimatch, namespace);
    assert.equal(Object.hasOwn(namespace, '__esModule'), false);
    const babelDefault = namespace && namespace.__esModule ? namespace.default : namespace;
    assert.equal(babelDefault('src/a.ts', '**/*.ts'), true);
    assert.equal(new namespace.Minimatch('src/*.ts').match('src/a.ts'), true);
  });
  test('real ESM entry provides a default matcher alongside named exports', async () => {
    const root = path.dirname(consumerRequire.resolve('minimatch/package.json'));
    const esmMatcher = await import(pathToFileURL(path.join(root, 'dist/esm/index.js')));
    assert.equal(esmMatcher.default, esmMatcher.minimatch);
    assert.equal(esmMatcher.default('src/a.ts', '**/*.ts'), true);
    assert.equal(new esmMatcher.Minimatch('src/*.ts').match('src/a.ts'), true);
  });
}

export function registerLegacyRuleRegressions(rootRequire) {
  const nextRequire = createRequire(rootRequire.resolve('eslint-config-next'));
  const importRequire = createRequire(nextRequire.resolve('eslint-plugin-import'));
  const eslintRequire = createRequire(rootRequire.resolve('eslint'));
  registerMinimatchRegressions(importRequire, {legacy: true});
  test('actual eslintrc ESM override matching retains include and exclude behavior', async () => {
    const root = path.dirname(eslintRequire.resolve('@eslint/eslintrc/package.json'));
    const {Legacy} = await import(pathToFileURL(path.join(root, 'lib/index.js')));
    const matcher = Legacy.OverrideTester.create(['**/*.js'], ['**/private/**'], process.cwd());
    assert.equal(matcher.test(path.join(process.cwd(), 'src/a.js')), true);
    assert.equal(matcher.test(path.join(process.cwd(), 'src/private/a.js')), false);
    assert.equal(matcher.test(path.join(process.cwd(), 'src/a.ts')), false);
  });
  test('actual import/no-internal-modules preserves default, allow, forbid, unresolved and resolved paths', async () => {
    const {Linter} = rootRequire('eslint');
    const plugin = nextRequire('eslint-plugin-import');
    const root = await mkdtemp(path.join(tmpdir(), 'dependency-import-rule-'));
    try {
      await writeFile(path.join(root, 'package.json'), JSON.stringify({name: 'fixture-project', private: true}));
      const files = ['src/use.js', 'src/internal/private.js', 'node_modules/fixture-package/index.js', 'node_modules/fixture-package/internal/public.js', 'node_modules/fixture-package/internal/private.js'];
      for (const file of files) {await mkdir(path.dirname(path.join(root, file)), {recursive: true}); await writeFile(path.join(root, file), 'export default 1;\n');}
      await writeFile(path.join(root, 'node_modules/fixture-package/package.json'), JSON.stringify({name: 'fixture-package', main: 'index.js'}));
      const filename = path.join(root, 'src/use.js');
      const check = (specifier, options, count) => {
        const messages = new Linter({cwd: root}).verify(`import value from ${JSON.stringify(specifier)};`, [{languageOptions: {ecmaVersion: 2022, sourceType: 'module'}, plugins: {import: plugin}, rules: {'import/no-internal-modules': options === undefined ? 'error' : ['error', options]}}], {filename});
        assert.equal(messages.some(message => message.fatal), false);
        assert.equal(messages.length, count, JSON.stringify({specifier, options, messages}));
        for (const message of messages) {assert.equal(message.ruleId, 'import/no-internal-modules'); assert.equal(message.severity, 2);}
      };
      check('fixture-package', undefined, 0);
      check('fixture-package/internal/private', undefined, 1);
      check('not-installed/internal/private', undefined, 0);
      check('fixture-package/internal/public', {allow: ['fixture-package/internal/public']}, 0);
      check('fixture-package/internal/private', {allow: ['fixture-package/internal/public']}, 1);
      check('fixture-package/internal/private', {forbid: ['fixture-package/internal/**']}, 1);
      check('fixture-package/internal/public', {forbid: ['fixture-package/internal/private']}, 0);
      check('./internal/private.js', {allow: [root.replaceAll('\\', '/')+'/src/internal/*.js']}, 0);
      check('./internal/private.js', {forbid: [root.replaceAll('\\', '/')+'/src/internal/*.js']}, 1);
      check('fixture-package/internal/../internal/public', {allow: ['fixture-package/internal/public']}, 0);
    } finally {await rm(root, {recursive: true, force: true});}
  });
}
