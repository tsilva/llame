import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { registerLegacyRuleRegressions } from "./dependency-matcher-regressions.mjs";
import { registerReactRuleRegressions } from "./dependency-react-regressions.mjs";
import { registerGlobCancellationTests } from "./dependency-glob-cancellation.mjs";

const require = createRequire(resolve("package.json"));
const sentryRequire = createRequire(require.resolve("@sentry/nextjs/package.json"));
const { globFiles, createSentryBuildPluginManager } = sentryRequire("@sentry/bundler-plugin-core");
const coreRequire = createRequire(sentryRequire.resolve("@sentry/bundler-plugin-core"));
registerLegacyRuleRegressions(require);
registerReactRuleRegressions(require);
registerGlobCancellationTests(coreRequire("glob"));
const { getBuildPluginOptions } = require(join(
  dirname(require.resolve("@sentry/nextjs/package.json")),
  "build/cjs/config/getBuildPluginOptions.js",
));

function fixture() {
  const root = mkdtempSync(join(process.env.DEPENDENCY_TEST_TEMP_DIR || tmpdir(), "next-glob-"));
  const cwd = process.cwd();
  process.chdir(root);
  const dist = join(root, ".next");
  const paths = [
    "static/chunks/pages/home.js", "static/chunks/pages/home.js.map",
    "static/chunks/app/page.mjs", "static/chunks/app/page.mjs.map",
    "static/chunks/app/support.cjs", "static/chunks/app/support.cjs.map",
    "static/chunks/pages/skip.js", "static/chunks/pages/page_client-reference-manifest.js",
    "static/chunks/framework-1.js", "static/chunks/framework.2.js",
    "static/chunks/main-1.js", "static/chunks/polyfills-1.js",
    "static/chunks/webpack-1.js", "static/chunks/vendor-1.js",
    "static/css/site.css.map", "static/immutable/chunks/future.js.map",
    "static/not-source.map", "server/app/page.js", "server/app/page.js.map",
  ];
  for (const file of paths) {
    mkdirSync(dirname(join(dist, file)), { recursive: true });
    writeFileSync(join(dist, file), "fixture");
  }
  mkdirSync(join(dist, "static/directory.js.map"), { recursive: true });
  writeFileSync(join(root, "parent.js.map"), "preserve");
  const options = (buildTool, extra = {}) => getBuildPluginOptions({
    distDirAbsPath: dist,
    buildTool,
    sentryBuildOptions: {
      telemetry: false, silent: true,
      release: { create: false, finalize: false },
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      ...extra,
    },
  });
  return { root, dist, options, cleanup: () => { process.chdir(cwd); rmSync(root, { recursive: true, force: true }); } };
}

test("Sentry's generated Next webpack asset/ignore globs preserve exact file selection", async () => {
  const f = fixture();
  try {
    const narrow = f.options("webpack-client", { sourcemaps: {
      deleteSourcemapsAfterUpload: true, ignore: "**/skip.js",
    } });
    const select = async (options) => (await globFiles(options.sourcemaps.assets, {
      ignore: options.sourcemaps.ignore,
    })).filter((file) => /\.(js|mjs|cjs)$/.test(file)).sort();
    assert.deepEqual(await select(narrow), [
      "static/chunks/app/page.mjs", "static/chunks/app/support.cjs",
      "static/chunks/pages/home.js",
    ].map((file) => join(f.dist, file)).sort());

    const wide = f.options("webpack-client", {
      widenClientFileUpload: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true, ignore: "**/skip.js" },
    });
    assert.deepEqual(await select(wide), [
      "static/chunks/app/page.mjs", "static/chunks/app/support.cjs",
      "static/chunks/pages/home.js", "static/chunks/main-1.js",
      "static/chunks/vendor-1.js",
    ].map((file) => join(f.dist, file)).sort());
  } finally { f.cleanup(); }
});

test("Next's real post-compile manager deletes only generated static source-map selections", async () => {
  const f = fixture();
  try {
    const options = f.options("after-production-compile-turbopack");
    assert.deepEqual(options.sourcemaps.assets.sort(), [
      join(f.dist, "server"), join(f.dist, "static/chunks"),
      join(f.dist, "static/immutable/chunks"),
    ].sort());
    const expectedMaps = [
      "static/chunks/pages/home.js.map", "static/chunks/app/page.mjs.map",
      "static/chunks/app/support.cjs.map", "static/css/site.css.map",
      "static/immutable/chunks/future.js.map",
    ].map((file) => join(f.dist, file)).sort();
    assert.deepEqual((await globFiles(options.sourcemaps.filesToDeleteAfterUpload)).sort(), expectedMaps);
    const manager = createSentryBuildPluginManager(options, {
      buildTool: "turbopack", buildToolMajorVersion: "16",
    });
    // Exercise the installed manager's real selection and deletion. Never call
    // its upload, release or telemetry methods, and provide no service token.
    await manager.deleteArtifacts();
    for (const file of expectedMaps) assert.equal(existsSync(file), false, file);
    for (const file of [
      "static/chunks/pages/home.js", "static/chunks/app/page.mjs",
      "static/chunks/app/support.cjs", "static/not-source.map",
      "server/app/page.js.map", "static/directory.js.map",
    ]) assert.equal(existsSync(join(f.dist, file)), true, file);
    assert.equal(existsSync(join(f.root, "parent.js.map")), true);
  } finally { f.cleanup(); }
});

test("TypeScript ESLint's actual named minimatch dependency preserves default-project matching", () => {
  const nextLintRequire = createRequire(require.resolve("eslint-config-next"));
  const importRequire = createRequire(nextLintRequire.resolve("eslint-plugin-import"));
  const parserRequire = createRequire(importRequire.resolve("@typescript-eslint/parser"));
  const estreeRequire = createRequire(parserRequire.resolve("@typescript-eslint/typescript-estree"));
  const { minimatch } = estreeRequire("minimatch");
  assert.equal(estreeRequire("minimatch/package.json").version, "11.0.1");
  // useProgramFromProjectService uses this named API with dot: true.
  for (const [file, pattern, expected] of [
    [".hidden.ts", "**/*.ts", true],
    ["src/main.ts", "src/{main,other}.ts", true],
    ["src/unlisted.ts", "src/{main,other}.ts", false],
    ["src/main.ts", "src/!(*.test).ts", true],
    ["src/main.test.ts", "src/!(*.test).ts", false],
    ["src/main.ts", "!**/*.test.ts", true],
    ["src/main.test.ts", "!**/*.test.ts", false],
  ]) assert.equal(minimatch(file, pattern, { dot: true }), expected, file + " " + pattern);
});

test("Sentry's entire matcher graph resolves the exact approved fixed versions", () => {
  const coreRequire = createRequire(sentryRequire.resolve("@sentry/bundler-plugin-core"));
  const globRequire = createRequire(coreRequire.resolve("glob"));
  const matcherRequire = createRequire(globRequire.resolve("minimatch"));
  assert.equal(coreRequire("glob/package.json").version, "14.0.2");
  assert.equal(globRequire("minimatch/package.json").version, "11.0.1");
  assert.equal(globRequire("path-scurry/package.json").version, "3.0.0");
  assert.equal(matcherRequire("@isaacs/nonrecursive-glob-match/package.json").version, "1.0.1");
});
