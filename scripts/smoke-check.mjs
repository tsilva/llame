import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, "out");
const vercelConfigPath = path.join(repoRoot, "vercel.json");

if (!fs.existsSync(outDir)) {
  console.error("Static export is missing. Run `npm run build` before `npm run smoke`.");
  process.exit(1);
}

const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, "utf8"));
const headers = vercelConfig.headers?.[0]?.headers ?? [];
const headerKeys = new Set(headers.map((header) => header.key));
const requiredHeaders = [
  "Cross-Origin-Embedder-Policy",
  "Cross-Origin-Opener-Policy",
  "Content-Security-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "Permissions-Policy",
];

const missingHeaders = requiredHeaders.filter((key) => !headerKeys.has(key));
if (missingHeaders.length > 0) {
  console.error(`Missing required headers in vercel.json: ${missingHeaders.join(", ")}`);
  process.exit(1);
}

const indexHtml = path.join(outDir, "index.html");
if (!fs.existsSync(indexHtml)) {
  console.error("Missing out/index.html after build.");
  process.exit(1);
}

const html = fs.readFileSync(indexHtml, "utf8");
if (!html.includes("llame")) {
  console.error("Smoke check failed: built index.html does not contain app shell content.");
  process.exit(1);
}

console.log("Smoke check passed.");
