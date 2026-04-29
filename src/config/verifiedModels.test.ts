import { describe, expect, it } from "vitest";
import {
  BROKEN_MODELS,
  getBrokenModel,
  getVerifiedModel,
  getVerifiedModelGenerationParams,
  isBrokenModel,
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
        id: "tsilva/unsloth_Qwen3.5-0.8B_uncensored",
        testedUrl: "https://llame.tsilva.eu/chat/tsilva/unsloth_Qwen3.5-0.8B_uncensored",
      },
      {
        id: "onnx-community/Qwen3.5-2B-ONNX",
        testedUrl: "https://llame.tsilva.eu/chat/onnx-community/Qwen3.5-2B-ONNX",
      },
      {
        id: "onnx-community/gemma-4-E2B-it-ONNX",
        testedUrl: "https://llame.tsilva.eu/chat/onnx-community/gemma-4-E2B-it-ONNX",
      },
      {
        id: "HuggingFaceTB/SmolLM3-3B-ONNX",
        testedUrl: "https://llame.tsilva.eu/chat/HuggingFaceTB/SmolLM3-3B-ONNX",
      },
      {
        id: "HuggingFaceTB/SmolLM2-135M-Instruct",
        testedUrl: "https://llame.tsilva.eu/chat/HuggingFaceTB/SmolLM2-135M-Instruct",
      },
      {
        id: "Xenova/distilgpt2",
        testedUrl: "https://llame.tsilva.eu/chat/Xenova/distilgpt2",
      },
    ];

    verifiedModels.forEach((model) => {
      expect(VERIFIED_MODELS.map((verifiedModel) => verifiedModel.id)).toContain(model.id);
      expect(isVerifiedModel(model.id)).toBe(true);
      expect(getVerifiedModel(model.id)).toMatchObject(model);
    });
  });

  it("does not verify unlisted models", () => {
    expect(isVerifiedModel("onnx-community/LFM2.5-350M-ONNX")).toBe(false);
    expect(getVerifiedModel("onnx-community/LFM2.5-350M-ONNX")).toBeNull();
  });

  it("has no currently broken models", () => {
    expect(BROKEN_MODELS).toEqual([]);
  });

  it("does not mark confirmed verified models as broken", () => {
    [
      "onnx-community/Qwen3.5-0.8B-ONNX",
      "tsilva/unsloth_Qwen3.5-0.8B_uncensored",
      "onnx-community/Qwen3.5-2B-ONNX",
      "onnx-community/gemma-4-E2B-it-ONNX",
      "HuggingFaceTB/SmolLM3-3B-ONNX",
    ].forEach((modelId) => {
      expect(isBrokenModel(modelId)).toBe(false);
      expect(getBrokenModel(modelId)).toBeNull();
    });
  });

  it("keeps verified and broken model lists disjoint", () => {
    const brokenIds = new Set(BROKEN_MODELS.map((model) => model.id));
    const overlap = VERIFIED_MODELS.filter((model) => brokenIds.has(model.id));

    expect(overlap).toEqual([]);
  });

  it("keeps base sampling settings for verified models without overrides", () => {
    const params = getVerifiedModelGenerationParams("onnx-community/Qwen3.5-0.8B-ONNX", {
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
      temperature: 0.2,
      top_p: 0.8,
      min_p: 0,
      top_k: 20,
      repetition_penalty: 1,
      do_sample: false,
      thinkingEnabled: true,
    });
  });
});
