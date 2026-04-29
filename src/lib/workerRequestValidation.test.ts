import { describe, expect, it } from "vitest";
import {
  isSupportedImageDataUrl,
  sanitizeGenerationParams,
  sanitizeWorkerMessages,
  validateModelSelection,
} from "@/lib/workerRequestValidation";

const PNG_DATA_URL = "data:image/png;base64,SGVsbG8=";

describe("validateModelSelection", () => {
  it("accepts Hugging Face model ids, pinned revisions, and WebGPU", () => {
    expect(validateModelSelection(
      "onnx-community/Qwen3.5-0.8B-ONNX",
      "1c0849d8d3084bc7d6f8d00789d3f3cec0a6fda6",
      "webgpu",
    )).toMatchObject({
      id: "onnx-community/Qwen3.5-0.8B-ONNX",
      revision: "1c0849d8d3084bc7d6f8d00789d3f3cec0a6fda6",
      device: "webgpu",
    });
  });

  it("rejects malformed model ids, revisions, and devices", () => {
    expect(() => validateModelSelection("../model", null, "webgpu")).toThrow("Invalid Hugging Face model id.");
    expect(() => validateModelSelection("owner/model", "bad revision", "webgpu")).toThrow("Invalid model revision.");
    expect(() => validateModelSelection("owner/model", null, "gpu")).toThrow("WebGPU is the only supported inference device.");
  });
});

describe("sanitizeGenerationParams", () => {
  it("clamps numeric generation params and defaults invalid booleans", () => {
    expect(sanitizeGenerationParams({
      max_new_tokens: 999_999,
      temperature: -1,
      top_p: Number.NaN,
      min_p: 2,
      top_k: 0,
      repetition_penalty: 9,
      do_sample: "yes",
      thinkingEnabled: "yes",
    })).toEqual({
      max_new_tokens: 2048,
      temperature: 0,
      top_p: 1,
      min_p: 1,
      top_k: 1,
      repetition_penalty: 2,
      do_sample: true,
      thinkingEnabled: false,
    });
  });
});

describe("sanitizeWorkerMessages", () => {
  it("keeps only worker-needed message fields and accepted image data URLs", () => {
    expect(sanitizeWorkerMessages([{
      id: "message-1",
      role: "user",
      content: "hello",
      images: [PNG_DATA_URL],
      debug: { modelInput: "secret" },
    }])).toEqual([{
      id: "message-1",
      role: "user",
      content: "hello",
      images: [PNG_DATA_URL],
    }]);
  });

  it("rejects invalid roles, oversized lists, and unsupported image payloads", () => {
    expect(() => sanitizeWorkerMessages([{ role: "tool", content: "" }])).toThrow("Invalid message role.");
    expect(() => sanitizeWorkerMessages(new Array(101).fill({ role: "user", content: "x" }))).toThrow("Invalid message list.");
    expect(() => sanitizeWorkerMessages([{ role: "user", content: "", images: ["https://example.com/x.png"] }])).toThrow("Unsupported image payload.");
  });
});

describe("isSupportedImageDataUrl", () => {
  it("accepts bounded raster data URLs and rejects SVG payloads", () => {
    expect(isSupportedImageDataUrl(PNG_DATA_URL)).toBe(true);
    expect(isSupportedImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
  });
});
