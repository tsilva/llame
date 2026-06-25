import { describe, expect, it } from "vitest";
import {
  inferAvailableOnnxDtypesForBaseName,
  inferAvailableCausalLmArtifactsFromSiblingPaths,
  selectOnnxDtypeForBaseName,
  selectCausalLmLoadArtifact,
} from "@/lib/modelArtifacts";

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

  it("prefers fp32 artifacts for GPT-2 family models when fp16 is available", () => {
    expect(selectCausalLmLoadArtifact("Xenova/distilgpt2", "webgpu", [
      { modelFileName: null, dtypes: ["fp16", "fp32"] },
      { modelFileName: "decoder_model_merged", dtypes: ["fp16", "fp32"] },
    ])).toEqual({
      modelFileName: null,
      dtype: "fp32",
    });
  });

  it("returns null when no candidate artifact has a usable dtype", () => {
    expect(selectCausalLmLoadArtifact("owner/model", "webgpu", [
      { modelFileName: null, dtypes: [] },
      { modelFileName: "decoder_model_merged", dtypes: [] },
    ])).toBeNull();
  });

  it("infers LFM-style model artifact dtypes from Hub sibling paths", () => {
    const artifacts = inferAvailableCausalLmArtifactsFromSiblingPaths([
      ".gitattributes",
      "config.json",
      "onnx/model.onnx",
      "onnx/model.onnx_data",
      "onnx/model_fp16.onnx",
      "onnx/model_fp16.onnx_data",
      "onnx/model_q4.onnx",
      "onnx/model_q4.onnx_data",
      "onnx/model_q4f16.onnx",
      "onnx/model_q4f16.onnx_data",
      "onnx/model_quantized.onnx",
      "onnx/model_quantized.onnx_data",
      "tokenizer.json",
    ]);

    expect(artifacts).toEqual([
      { modelFileName: null, dtypes: ["fp32", "fp16", "q4", "q4f16", "q8"] },
      { modelFileName: "decoder_model_merged", dtypes: [] },
    ]);
    expect(selectCausalLmLoadArtifact("onnx-community/LFM2.5-350M-ONNX", "webgpu", artifacts)).toEqual({
      modelFileName: null,
      dtype: "fp16",
    });
  });

  it("infers SmolLM model artifact dtypes from Hub sibling paths", () => {
    const artifacts = inferAvailableCausalLmArtifactsFromSiblingPaths([
      "onnx/model.onnx",
      "onnx/model_bnb4.onnx",
      "onnx/model_fp16.onnx",
      "onnx/model_int8.onnx",
      "onnx/model_q4.onnx",
      "onnx/model_q4f16.onnx",
      "onnx/model_quantized.onnx",
      "onnx/model_uint8.onnx",
    ]);

    expect(artifacts).toEqual([
      { modelFileName: null, dtypes: ["fp32", "bnb4", "fp16", "int8", "q4", "q4f16", "q8", "uint8"] },
      { modelFileName: "decoder_model_merged", dtypes: [] },
    ]);
    expect(selectCausalLmLoadArtifact("HuggingFaceTB/SmolLM3-3B-ONNX", "webgpu", artifacts)).toEqual({
      modelFileName: null,
      dtype: "q4f16",
    });
  });

  it("selects component dtypes for Qwen3.5 dropdown vision presets", () => {
    const officialQwenPaths = [
      "onnx/decoder_model_merged.onnx",
      "onnx/decoder_model_merged_fp16.onnx",
      "onnx/decoder_model_merged_q4.onnx",
      "onnx/decoder_model_merged_q4f16.onnx",
      "onnx/decoder_model_merged_quantized.onnx",
      "onnx/embed_tokens.onnx",
      "onnx/embed_tokens_fp16.onnx",
      "onnx/embed_tokens_q4.onnx",
      "onnx/embed_tokens_q4f16.onnx",
      "onnx/embed_tokens_quantized.onnx",
      "onnx/vision_encoder.onnx",
      "onnx/vision_encoder_fp16.onnx",
      "onnx/vision_encoder_q4.onnx",
      "onnx/vision_encoder_q4f16.onnx",
      "onnx/vision_encoder_quantized.onnx",
    ];
    const uncensoredQwenPaths = [
      "onnx/decoder_model_merged_q4f16.onnx",
      "onnx/embed_tokens_fp16.onnx",
      "onnx/vision_encoder_fp16.onnx",
    ];

    for (const paths of [officialQwenPaths, uncensoredQwenPaths]) {
      expect(selectOnnxDtypeForBaseName(paths, "embed_tokens", "fp16")).toBe("fp16");
      expect(selectOnnxDtypeForBaseName(paths, "vision_encoder", "fp16")).toBe("fp16");
      expect(selectOnnxDtypeForBaseName(paths, "decoder_model_merged", "q4f16")).toBe("q4f16");
    }
  });

  it("recognizes Gemma 4 component artifacts used by the dropdown preset", () => {
    const gemmaPaths = [
      "onnx/audio_encoder_q4f16.onnx",
      "onnx/decoder_model_merged_q4f16.onnx",
      "onnx/embed_tokens_q4f16.onnx",
      "onnx/vision_encoder_q4f16.onnx",
    ];

    expect(inferAvailableOnnxDtypesForBaseName(gemmaPaths, "audio_encoder")).toEqual(["q4f16"]);
    expect(selectOnnxDtypeForBaseName(gemmaPaths, "decoder_model_merged", "q4f16")).toBe("q4f16");
    expect(selectOnnxDtypeForBaseName(gemmaPaths, "embed_tokens", "q4f16")).toBe("q4f16");
    expect(selectOnnxDtypeForBaseName(gemmaPaths, "vision_encoder", "q4f16")).toBe("q4f16");
  });
});
