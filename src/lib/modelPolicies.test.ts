import { describe, expect, it } from "vitest";
import {
  getCompatibilityScoreAdjustment,
  getPreferredDtypePolicy,
  isModelExcludedFromBrowser,
} from "@/lib/modelPolicies";

describe("modelPolicies", () => {
  it("excludes task-specific and random checkpoints from the browser", () => {
    expect(isModelExcludedFromBrowser({ id: "onnx-community/granite-docling-258M-ONNX" })).toBe(true);
    expect(isModelExcludedFromBrowser({ id: "onnx-community/tiny-random-LlamaForCausalLM-ONNX" })).toBe(true);
    expect(isModelExcludedFromBrowser({ id: "onnx-community/Llama-3.2-1B-Instruct-ONNX" })).toBe(false);
  });

  it("applies the WebGPU dtype override for larger Qwen2 family models", () => {
    expect(getPreferredDtypePolicy({
      id: "onnx-community/Qwen2.5-1.5B-Instruct",
      parameterCountB: 1.5,
      isVisionModel: false,
    }, "webgpu")).toBe("q4");
  });

  it("applies stronger compatibility penalties on 8 GB WebGPU devices", () => {
    expect(getCompatibilityScoreAdjustment({
      id: "onnx-community/Qwen2.5-1.5B-Instruct",
      parameterCountB: 1.5,
      isVisionModel: false,
      device: "webgpu",
      deviceMemoryGb: 8,
    })).toBe(-28);

    expect(getCompatibilityScoreAdjustment({
      id: "onnx-community/Qwen2.5-1.5B-Instruct",
      parameterCountB: 1.5,
      isVisionModel: false,
      device: "webgpu",
      deviceMemoryGb: 16,
    })).toBe(-12);
  });
});
