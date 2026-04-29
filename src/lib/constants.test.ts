import { describe, expect, it } from "vitest";
import {
  CONTEXT_WINDOWS,
  MODEL_PRESETS,
  getModelDisplayName,
  getModelQuantizationLabel,
  getModelSelection,
  getModelThinkingMode,
  isVlmModel,
} from "@/lib/constants";

describe("constants", () => {
  it("includes Gemma 4 E2B in curated presets and excludes Qwen2.5 0.5B", () => {
    expect(MODEL_PRESETS.map((preset) => preset.id)).toContain("onnx-community/gemma-4-E2B-it-ONNX");
    expect(MODEL_PRESETS.map((preset) => preset.id)).not.toContain("onnx-community/Qwen2.5-0.5B-Instruct");
  });

  it("recognizes Gemma 4 E2B as a vision model with optional thinking", () => {
    const modelId = "onnx-community/gemma-4-E2B-it-ONNX";

    expect(isVlmModel(modelId)).toBe(true);
    expect(getModelThinkingMode(modelId)).toBe("optional");
    expect(getModelDisplayName(modelId)).toBe("Gemma 4 E2B");
    expect(getModelQuantizationLabel(modelId, true)).toBe("q4f16");
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
    expect(CONTEXT_WINDOWS[selection.id]).toBe(1024);
  });
});
