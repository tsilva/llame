import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";

function getContentSecurityPolicy() {
  const headers = vercelConfig.headers?.flatMap((entry) => entry.headers) ?? [];
  const csp = headers.find((header) => header.key.toLowerCase() === "content-security-policy");
  return csp?.value ?? "";
}

describe("security headers", () => {
  it("allows Hugging Face storage redirects used by browser ONNX models", () => {
    const csp = getContentSecurityPolicy();

    expect(csp).toContain("connect-src");
    expect(csp).toContain("https://huggingface.co");
    expect(csp).toContain("https://*.huggingface.co");
    expect(csp).toContain("https://hf.co");
    expect(csp).toContain("https://*.hf.co");
    expect(csp).toContain("https://*.aws.cdn.hf.co");
    expect(csp).toContain("https://*.xethub.hf.co");
  });
});
