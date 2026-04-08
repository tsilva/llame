import type { NextConfig } from "next";
import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const DEFAULT_SENTRY_ORG = "tsilva";
const DEFAULT_SENTRY_PROJECT = path.basename(process.cwd());

const getGitHash = () => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
};

const loadIgnoredEnvFile = (filename: string) => {
  const filePath = path.join(process.cwd(), filename);
  if (!existsSync(filePath)) {
    return;
  }

  const fileContents = readFileSync(filePath, "utf8");

  for (const line of fileContents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquotedValue = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = unquotedValue;
    }
  }
};

loadIgnoredEnvFile(".env.sentry-build-plugin");

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {},
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  env: {
    GIT_COMMIT_HASH: getGitHash(),
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG ?? DEFAULT_SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? DEFAULT_SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
