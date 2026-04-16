import { DEFAULT_PARAMS } from "@/lib/constants";
import { GenerationParams } from "@/types";

type VerifiedModelSamplingSettings = Partial<Pick<
  GenerationParams,
  "temperature" | "top_p" | "min_p" | "top_k" | "repetition_penalty" | "do_sample"
>>;

export interface VerifiedModel {
  id: string;
  testedUrl?: string;
  sampling?: VerifiedModelSamplingSettings;
}

export const VERIFIED_MODELS = [
  {
    id: "onnx-community/Qwen3.5-0.8B-ONNX",
    testedUrl: "https://llame.tsilva.eu/chat/onnx-community/Qwen3.5-0.8B-ONNX",
  },
  {
    id: "onnx-community/gemma-4-E2B-it-ONNX",
    testedUrl: "https://llame.tsilva.eu/chat/onnx-community/gemma-4-E2B-it-ONNX",
  },
  {
    id: "tsilva/unsloth_Qwen3.5-0.8B_uncensored",
    testedUrl: "https://llame.tsilva.eu/chat/tsilva/unsloth_Qwen3.5-0.8B_uncensored",
    sampling: {
      temperature: 0.8,
      top_k: 40,
      repetition_penalty: 1.1,
      top_p: 0.95,
      min_p: 0.05,
      do_sample: true,
    },
  },
] satisfies VerifiedModel[];

const VERIFIED_MODEL_IDS = new Set(VERIFIED_MODELS.map((model) => model.id));

export function getVerifiedModel(modelId?: string | null) {
  if (typeof modelId !== "string") return null;

  const normalizedModelId = modelId.trim();
  return VERIFIED_MODELS.find((model) => model.id === normalizedModelId) ?? null;
}

export function isVerifiedModel(modelId?: string | null) {
  if (typeof modelId !== "string") return false;

  return VERIFIED_MODEL_IDS.has(modelId.trim());
}

export function getVerifiedModelGenerationParams(
  modelId?: string | null,
  baseParams: GenerationParams = DEFAULT_PARAMS,
): GenerationParams {
  const verifiedModel = getVerifiedModel(modelId);
  if (!verifiedModel?.sampling) return baseParams;

  return {
    ...baseParams,
    ...verifiedModel.sampling,
  };
}
