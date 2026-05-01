import { describe, expect, it } from "vitest";
import {
  CONTEXT_WINDOWS,
  COMPLETION_PARAMS,
  DEFAULT_PARAMS,
  MODEL_PRESETS,
  getDefaultParamsForModel,
  getModelCardMeta,
  getModelDisplayName,
  getModelSelection,
  getModelThinkingMode,
  isVlmModel,
} from "@/lib/constants";

describe("constants", () => {
  it("includes Gemma 4 E2B in curated presets and excludes Qwen2.5 0.5B", () => {
    expect(MODEL_PRESETS.map((preset) => preset.id)).toContain("onnx-community/gemma-4-E2B-it-ONNX");
    expect(MODEL_PRESETS.map((preset) => preset.id)).not.toContain("onnx-community/Qwen2.5-0.5B-Instruct");
  });

  it("includes LFM2.5 350M as a curated WebGPU chat preset", () => {
    const modelId = "onnx-community/LFM2.5-350M-ONNX";

    expect(getModelDisplayName(modelId)).toBe("LFM2.5-350M");
    expect(getModelCardMeta(modelId)).toEqual(["350M", "fp16", "692MB"]);
    expect(getModelThinkingMode(modelId)).toBe("unsupported");
    expect(MODEL_PRESETS.find((preset) => preset.id === modelId)).toMatchObject({
      revision: "2c07371c2e84776cad597f3d813b7d306d292aea",
      parameterCountLabel: "350M",
      downloadSizeLabel: "692MB",
      supportsImages: false,
      recommendedDevice: "webgpu",
      supportTier: "curated",
    });
    expect(getModelSelection(modelId)).toMatchObject({
      id: modelId,
      revision: "2c07371c2e84776cad597f3d813b7d306d292aea",
      interactionMode: "chat",
      chatFormat: "chat-template",
    });
    expect(CONTEXT_WINDOWS[modelId]).toBe(32768);
  });

  it("recognizes Gemma 4 E2B as a vision model with optional thinking", () => {
    const modelId = "onnx-community/gemma-4-E2B-it-ONNX";

    expect(isVlmModel(modelId)).toBe(true);
    expect(getModelThinkingMode(modelId)).toBe("optional");
    expect(getModelDisplayName(modelId)).toBe("Gemma 4 E2B");
    expect(getModelCardMeta(modelId)).toContain("q4f16");
    expect(MODEL_PRESETS.find((preset) => preset.id === modelId)?.downloadSizeLabel).toBe("3.4GB");
    expect(CONTEXT_WINDOWS[modelId]).toBe(131072);
  });

  it("prefers the curated preset revision over stale stored revisions", () => {
    const selection = getModelSelection("tsilva/unsloth_Qwen3.5-0.8B_uncensored", {
      revision: "stale-revision",
      supportsImages: true,
      recommendedDevice: "webgpu",
      supportTier: "curated",
    });

    expect(selection.revision).toBe("2333f32297e44073d7f7e5259034b4a24c166c67");
  });

  it("defaults GPT-2 route selections to completion mode", () => {
    const selection = getModelSelection("openai-community/gpt2");

    expect(selection.interactionMode).toBe("completion");
    expect(selection.chatFormat).toBe("completion");
    expect(CONTEXT_WINDOWS[selection.id]).toBe(1024);
  });

  it("maps upstream Bloom routes to browser-ready Bloom exports", () => {
    const selection = getModelSelection("bigscience/bloom-560m", {
      revision: "upstream-revision",
      interactionMode: "completion",
    });

    expect(selection).toMatchObject({
      id: "Xenova/bloom-560m",
      revision: null,
      interactionMode: "completion",
      chatFormat: "completion",
    });

    expect(getModelSelection("Xenova/bloom-560m")).toMatchObject({
      id: "Xenova/bloom-560m",
      interactionMode: "completion",
    });
  });

  it("uses completion generation defaults for completion models", () => {
    expect(getDefaultParamsForModel(getModelSelection("openai-community/gpt2"))).toEqual(COMPLETION_PARAMS);
    expect(getDefaultParamsForModel(getModelSelection("onnx-community/Qwen3.5-0.8B-ONNX"))).toEqual(DEFAULT_PARAMS);
  });
});
