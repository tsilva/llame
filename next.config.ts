import type { NextConfig } from "next";
import { execSync } from "child_process";

const getGitHash = () => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
};

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

export default nextConfig;
