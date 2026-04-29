import { describe, expect, it } from "vitest";
import {
  getVerifiedModel,
  getVerifiedModelGenerationParams,
  isVerifiedModel,
  VERIFIED_MODELS,
} from "@/config/verifiedModels";

describe("verified model config", () => {
  it("marks personally tested models as verified", () => {
    const verifiedModels = [
      {
        id: "onnx-community/Qwen3.5-0.8B-ONNX",
        testedUrl: "https://llame.tsilva.eu/chat/onnx-community/Qwen3.5-0.8B-ONNX",
      },
      {
        id: "onnx-community/gemma-4-E2B-it-ONNX",
        testedUrl: "https://llame.tsilva.eu/chat/onnx-community/gemma-4-E2B-it-ONNX",
      },
      {
        id: "HuggingFaceTB/SmolLM2-135M-Instruct",
        testedUrl: "https://llame.tsilva.eu/chat/HuggingFaceTB/SmolLM2-135M-Instruct",
      },
    ];

    verifiedModels.forEach((model) => {
      expect(VERIFIED_MODELS.map((verifiedModel) => verifiedModel.id)).toContain(model.id);
      expect(isVerifiedModel(model.id)).toBe(true);
      expect(getVerifiedModel(model.id)).toMatchObject(model);
    });
  });

  it("does not verify unlisted models", () => {
    expect(isVerifiedModel("onnx-community/Qwen3.5-2B-ONNX")).toBe(false);
    expect(getVerifiedModel("onnx-community/Qwen3.5-2B-ONNX")).toBeNull();
  });

  it("loads sampling settings for verified models when configured", () => {
    const params = getVerifiedModelGenerationParams("tsilva/unsloth_Qwen3.5-0.8B_uncensored", {
      max_new_tokens: 512,
      temperature: 0.2,
      top_p: 0.8,
      min_p: 0,
      top_k: 20,
      repetition_penalty: 1,
      do_sample: false,
      thinkingEnabled: true,
    });

    expect(params).toMatchObject({
      max_new_tokens: 512,
      temperature: 0.8,
      top_p: 0.95,
      min_p: 0.05,
      top_k: 40,
      repetition_penalty: 1.1,
      do_sample: true,
      thinkingEnabled: true,
    });
  });
});
