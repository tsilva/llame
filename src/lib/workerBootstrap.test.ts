import { describe, expect, it } from "vitest";

import { getOnnxWasmAssetBaseUrl, getOnnxWasmAssetPaths } from "./workerBootstrap";

describe("getOnnxWasmAssetBaseUrl", () => {
  it("prefers a same-origin base when the worker href is blob-backed", () => {
    expect(getOnnxWasmAssetBaseUrl({
      href: "blob:http://localhost:3001/7f5e38d1-0a58-4fd3-a95d-d8a3c62f4d60",
      origin: "http://localhost:3001",
    })).toBe("http://localhost:3001/onnxruntime/");
  });

  it("falls back to href when origin is unavailable", () => {
    expect(getOnnxWasmAssetBaseUrl({
      href: "http://localhost:3001/_next/static/chunks/worker.js",
      origin: "null",
    })).toBe("http://localhost:3001/onnxruntime/");
  });

  it("returns null when no valid base can be constructed", () => {
    expect(getOnnxWasmAssetBaseUrl({
      href: "blob:http://localhost:3001/7f5e38d1-0a58-4fd3-a95d-d8a3c62f4d60",
      origin: "null",
    })).toBeNull();
  });

  it("builds same-origin ONNX Runtime asset paths", () => {
    expect(getOnnxWasmAssetPaths({
      href: "blob:http://localhost:3001/7f5e38d1-0a58-4fd3-a95d-d8a3c62f4d60",
      origin: "http://localhost:3001",
    })).toEqual({
      mjs: "http://localhost:3001/onnxruntime/ort-wasm-simd-threaded.asyncify.mjs",
      wasm: "http://localhost:3001/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm",
    });
  });
});
