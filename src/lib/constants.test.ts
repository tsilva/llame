import { describe, expect, it } from "vitest";
import {
  CONTEXT_WINDOWS,
  getModelDisplayName,
  getModelQuantizationLabel,
  getModelThinkingMode,
  isVlmModel,
} from "@/lib/constants";

describe("constants", () => {
  it("recognizes Gemma 4 E2B as a vision model with optional thinking", () => {
    const modelId = "onnx-community/gemma-4-E2B-it-ONNX";

    expect(isVlmModel(modelId)).toBe(true);
    expect(getModelThinkingMode(modelId)).toBe("optional");
    expect(getModelDisplayName(modelId)).toBe("Gemma 4 E2B");
    expect(getModelQuantizationLabel(modelId, true)).toBe("q4f16");
    expect(CONTEXT_WINDOWS[modelId]).toBe(131072);
  });
});
