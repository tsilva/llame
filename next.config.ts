import type { NextConfig } from "next";
import { execSync } from "child_process";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const DEFAULT_SENTRY_ORG = "tsilva";
const DEFAULT_SENTRY_PROJECT = path.basename(process.cwd());

const getGitHash = () => {
  const hostedCommitHash =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ??
    process.env.GITHUB_SHA?.trim();

  if (hostedCommitHash) {
    return hostedCommitHash.slice(0, 7);
  }

  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
};

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    resolveAlias: {
      sharp: {
        browser: "./src/lib/empty-browser-module.ts",
      },
      "onnxruntime-node": {
        browser: "./src/lib/empty-browser-module.ts",
      },
    },
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  env: {
    GIT_COMMIT_HASH: getGitHash(),
  },
};

const isHostedBuild = process.env.VERCEL === "1" && Boolean(process.env.VERCEL_DEPLOYMENT_ID);

export default withSentryConfig(nextConfig, {
  sourcemaps: { disable: !isHostedBuild },
  webpack: { disableSentryConfig: !isHostedBuild },
  useRunAfterProductionCompileHook: isHostedBuild ? undefined : false,
  authToken: isHostedBuild ? process.env.SENTRY_AUTH_TOKEN : undefined,
  org: process.env.SENTRY_ORG ?? DEFAULT_SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? DEFAULT_SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
