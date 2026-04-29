import { describe, expect, it } from "vitest";
import { selectCausalLmLoadArtifact } from "@/lib/modelArtifacts";

describe("selectCausalLmLoadArtifact", () => {
  it("keeps the preferred dtype when the default model artifact has it", () => {
    expect(selectCausalLmLoadArtifact("onnx-community/Qwen3-0.6B-ONNX", "webgpu", [
      { modelFileName: null, dtypes: ["fp16", "q4"] },
      { modelFileName: "decoder_model_merged", dtypes: ["fp32"] },
    ])).toEqual({
      modelFileName: null,
      dtype: "fp16",
    });
  });

  it("falls back to older decoder-only exports when default model artifacts are missing", () => {
    expect(selectCausalLmLoadArtifact("openai-community/gpt2", "webgpu", [
      { modelFileName: null, dtypes: [] },
      { modelFileName: "decoder_model_merged", dtypes: ["fp32"] },
    ])).toEqual({
      modelFileName: "decoder_model_merged",
      dtype: "fp32",
    });
  });

  it("returns null when no candidate artifact has a usable dtype", () => {
    expect(selectCausalLmLoadArtifact("owner/model", "webgpu", [
      { modelFileName: null, dtypes: [] },
      { modelFileName: "decoder_model_merged", dtypes: [] },
    ])).toBeNull();
  });
});
