import { describe, expect, it } from "vitest";
import { pickDtypeForModel } from "@/lib/modelDtype";

describe("pickDtypeForModel", () => {
  it("uses q4 for wasm models", () => {
    expect(pickDtypeForModel("onnx-community/Qwen2.5-1.5B-Instruct", "wasm")).toBe("q4");
  });

  it("keeps fp16 for small WebGPU models", () => {
    expect(pickDtypeForModel("onnx-community/Qwen3-0.6B-ONNX", "webgpu")).toBe("fp16");
  });

  it("keeps q4f16 for non-Qwen larger WebGPU models", () => {
    expect(pickDtypeForModel("onnx-community/Llama-3.2-1B-Instruct-ONNX", "webgpu")).toBe("q4f16");
  });

  it("falls back larger Qwen2 family models to q4 on WebGPU", () => {
    expect(pickDtypeForModel("onnx-community/Qwen2.5-1.5B-Instruct", "webgpu")).toBe("q4");
    expect(pickDtypeForModel("onnx-community/Qwen2-7B-Instruct", "webgpu")).toBe("q4");
  });
});
