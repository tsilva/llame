import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";

export function registerReactRuleRegressions(rootRequire) {
test("actual React and accessibility rule options retain legacy callable matching", () => {
  const nextLintRequire = createRequire(rootRequire.resolve("eslint-config-next"));
  const { Linter } = rootRequire("eslint");
  const plugins = {
    react: nextLintRequire("eslint-plugin-react"),
    "jsx-a11y": nextLintRequire("eslint-plugin-jsx-a11y"),
  };
  function check(source, rule, options, count) {
    const messages = new Linter().verify(source, [{
      files: ["**/*.jsx"],
      languageOptions: { ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins,
      rules: { [rule]: options === undefined ? "error" : ["error", options] },
    }], { filename: join(process.cwd(), "dependency-rule-fixture.jsx") });
    assert.equal(messages.length, count, JSON.stringify(messages));
    for (const message of messages) {
      assert.equal(message.ruleId, rule);
      assert.equal(message.severity, 2);
      assert.equal(Boolean(message.fatal), false);
    }
  }
  const allow = { forbid: [{ propNamePattern: "data-*", allowedForPatterns: ["Safe*"] }] };
  check('<UnsafePanel data-secret="yes" />;', "react/forbid-component-props", allow, 1);
  check('<SafePanel data-secret="yes" />;', "react/forbid-component-props", allow, 0);
  check('<UnsafePanel title="ordinary" />;', "react/forbid-component-props", allow, 0);
  const forbid = { forbid: [{ propName: "style", disallowedForPatterns: ["Unsafe*"] }] };
  check('<UnsafePanel style={{}} />;', "react/forbid-component-props", forbid, 1);
  check('<SafePanel style={{}} />;', "react/forbid-component-props", forbid, 0);
  const controls = { controlComponents: ["Input*"], assert: "nesting" };
  check("<label>Name<InputField /></label>;", "jsx-a11y/label-has-associated-control", controls, 0);
  check("<label>Name<Other /></label>;", "jsx-a11y/label-has-associated-control", controls, 1);
  check("<label><InputField /></label>;", "jsx-a11y/label-has-associated-control", controls, 1);
  check('<label htmlFor="field">Name</label>;', "jsx-a11y/label-has-associated-control", undefined, 0);
});
}
