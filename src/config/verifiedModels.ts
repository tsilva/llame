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

export interface BrokenModel {
  id: string;
  testedUrl?: string;
  reason: string;
}

export const VERIFIED_MODELS: VerifiedModel[] = [
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

export const BROKEN_MODELS: BrokenModel[] = [];

const VERIFIED_MODEL_IDS = new Set(VERIFIED_MODELS.map((model) => model.id));
const BROKEN_MODEL_IDS = new Set(BROKEN_MODELS.map((model) => model.id));

export function getVerifiedModel(modelId?: string | null) {
  if (typeof modelId !== "string") return null;

  const normalizedModelId = modelId.trim();
  return VERIFIED_MODELS.find((model) => model.id === normalizedModelId) ?? null;
}

export function isVerifiedModel(modelId?: string | null) {
  if (typeof modelId !== "string") return false;

  return VERIFIED_MODEL_IDS.has(modelId.trim());
}

export function getBrokenModel(modelId?: string | null) {
  if (typeof modelId !== "string") return null;

  const normalizedModelId = modelId.trim();
  return BROKEN_MODELS.find((model) => model.id === normalizedModelId) ?? null;
}

export function isBrokenModel(modelId?: string | null) {
  if (typeof modelId !== "string") return false;

  return BROKEN_MODEL_IDS.has(modelId.trim());
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
