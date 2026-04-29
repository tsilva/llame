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
        id: "onnx-community/gemma-4-E2B-it-ONNX",
        testedUrl: "https://llame.tsilva.eu/chat/onnx-community/gemma-4-E2B-it-ONNX",
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
    expect(isVerifiedModel("onnx-community/Qwen3.5-2B-ONNX")).toBe(false);
    expect(getVerifiedModel("onnx-community/Qwen3.5-2B-ONNX")).toBeNull();
  });

  it("marks locally tested failing models as broken", () => {
    const brokenModels = [
      {
        id: "tsilva/unsloth_Qwen3.5-0.8B_uncensored",
        reason: "Loaded to 100% locally but never reached generation.",
      },
      {
        id: "onnx-community/Qwen3.5-2B-ONNX",
        reason: "Loads on WebGPU, but generation produced only special-token scaffold with no answer text.",
      },
      {
        id: "HuggingFaceTB/SmolLM3-3B-ONNX",
        reason: "Loads on WebGPU, but generation produced only special-token scaffold with no answer text.",
      },
    ];

    brokenModels.forEach((model) => {
      expect(BROKEN_MODELS.map((brokenModel) => brokenModel.id)).toContain(model.id);
      expect(isBrokenModel(model.id)).toBe(true);
      expect(getBrokenModel(model.id)).toMatchObject(model);
    });
  });

  it("does not mark verified models as broken", () => {
    expect(isBrokenModel("onnx-community/Qwen3.5-0.8B-ONNX")).toBe(false);
    expect(getBrokenModel("onnx-community/Qwen3.5-0.8B-ONNX")).toBeNull();
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
