import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { ESLint } from "eslint";

const require = createRequire(import.meta.url);
const configRequire = createRequire(require.resolve("eslint-config-next"));
const pluginEntry = configRequire.resolve("@next/eslint-plugin-next");
const { getRootDirs } = require(join(dirname(pluginEntry), "utils/get-root-dirs.js"));

// Exercise the plugin's actual call site, rather than assuming glob libraries
// share semantics. Its only glob operation must preserve directory-only matches.
test("Next lint root-dir globs retain literal, brace, array and separator behavior", () => {
  const directory = mkdtempSync(join(tmpdir(), "llame-lint-globs-"));
  try {
    for (const name of ["alpha", "beta"]) mkdirSync(join(directory, name));
    writeFileSync(join(directory, "alpha.txt"), "file, not a project");
    // The two implementations return different path formatting; rule consumers
    // resolve filesystem paths. Compare the directories they actually discover.
    const roots = (rootDir) => getRootDirs({ cwd: directory, settings: { next: { rootDir } } }).map((directory) => resolve(directory)).sort();
    assert.deepEqual(getRootDirs({ cwd: directory, settings: {} }), [directory]);
    assert.deepEqual(roots(join(directory, "alpha")), [join(directory, "alpha")]);
    assert.deepEqual(roots(join(directory, "*")), [join(directory, "alpha"), join(directory, "beta")]);
    assert.deepEqual(roots(join(directory, "{alpha,beta}")), [join(directory, "alpha"), join(directory, "beta")]);
    assert.deepEqual(roots([join(directory, "alpha"), join(directory, "missing")]), [join(directory, "alpha")]);
    assert.deepEqual(roots(join(directory, "alpha").replaceAll("/", "\\")), [join(directory, "alpha")]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Next security lint rules remain enabled and detect synchronous scripts", async () => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText('export default function Fixture() { return <script src="https://example.com/script.js" />; }', { filePath: "src/components/DependencySecurityFixture.tsx" });
  assert.ok(result.messages.some((message) => message.ruleId === "@next/next/no-sync-scripts"));
});

test("browser inference graph excludes the unused Node runtime and its vulnerable archive tools", () => {
  const projects = JSON.parse(execFileSync("pnpm", ["list", "onnxruntime-node", "adm-zip", "sprintf-js", "braces", "--depth", "Infinity", "--lockfile-only", "--json"], { encoding: "utf8" }));
  for (const project of projects) {
    assert.equal(Object.keys(project.dependencies ?? {}).length, 0);
    assert.equal(Object.keys(project.devDependencies ?? {}).length, 0);
  }
});

test("Next internal-link lint still discovers pages through a configured project glob", async () => {
  const directory = mkdtempSync(join(tmpdir(), "llame-lint-pages-"));
  try {
    mkdirSync(join(directory, "app", "pages"), { recursive: true });
    writeFileSync(join(directory, "app", "pages", "about.js"), "export default function About() {};");
    const eslint = new ESLint({ overrideConfig: { settings: { next: { rootDir: join(directory, "*") } } } });
    const [result] = await eslint.lintText('export default function Fixture() { return <a href="/about">About</a>; }', { filePath: "src/components/DependencySecurityFixture.tsx" });
    assert.ok(result.messages.some((message) => message.ruleId === "@next/next/no-html-link-for-pages"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Transformers resolves the same shared Tensor runtime as its browser backend", () => {
  const transformersRequire = createRequire(require.resolve("@huggingface/transformers"));
  const webRequire = createRequire(transformersRequire.resolve("onnxruntime-web"));
  assert.equal(transformersRequire.resolve("onnxruntime-common"), webRequire.resolve("onnxruntime-common"));
});
