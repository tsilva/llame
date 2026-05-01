import { GenerationParams, ModelSelection } from "@/types";
import { getModelChatFormatType, getModelInteractionMode } from "@/lib/modelInteraction";

export const DEFAULT_MODEL = "onnx-community/Qwen3.5-0.8B-ONNX";
export const DEFAULT_MODEL_REVISION = "1c0849d8d3084bc7d6f8d00789d3f3cec0a6fda6";

export type ThinkingMode = "unsupported" | "optional" | "required";

export interface ModelPreset extends ModelSelection {
  id: string;
  label: string;
  thinkingMode: ThinkingMode;
  parameterCountLabel: string;
  quantizationLabel: string;
  downloadSizeLabel: string;
}

function normalizeModelId(modelId?: string | null) {
  if (typeof modelId !== "string") return DEFAULT_MODEL;

  const trimmedModelId = modelId.trim();
  return trimmedModelId.length > 0 ? trimmedModelId : DEFAULT_MODEL;
}

const BROWSER_MODEL_ALIASES: Record<string, string> = {
  "bigscience/bloom-560m": "Xenova/bloom-560m",
  "bigscience/bloomz-560m": "Xenova/bloomz-560m",
};

function resolveBrowserModelId(modelId?: string | null) {
  const normalizedModelId = normalizeModelId(modelId);
  return BROWSER_MODEL_ALIASES[normalizedModelId] ?? normalizedModelId;
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: "onnx-community/LFM2.5-350M-ONNX",
    revision: "2c07371c2e84776cad597f3d813b7d306d292aea",
    label: "LFM2.5-350M",
    thinkingMode: "unsupported",
    parameterCountLabel: "350M",
    quantizationLabel: "fp16",
    downloadSizeLabel: "692MB",
    supportsImages: false,
    recommendedDevice: "webgpu",
    supportTier: "curated",
    interactionMode: "chat",
    chatFormat: "chatml",
  },
  {
    id: "onnx-community/Qwen3.5-0.8B-ONNX",
    revision: "1c0849d8d3084bc7d6f8d00789d3f3cec0a6fda6",
    label: "Qwen3.5 0.8B",
    thinkingMode: "optional",
    parameterCountLabel: "0.8B",
    quantizationLabel: "q4+fp16",
    downloadSizeLabel: "850MB",
    supportsImages: true,
    recommendedDevice: "webgpu",
    supportTier: "curated",
    interactionMode: "chat",
    chatFormat: "chatml",
  },
  {
    id: "tsilva/unsloth_Qwen3.5-0.8B_uncensored",
    revision: "2333f32297e44073d7f7e5259034b4a24c166c67",
    label: "Qwen3.5 0.8B Uncensored",
    thinkingMode: "optional",
    parameterCountLabel: "0.8B",
    quantizationLabel: "q4+fp16",
    downloadSizeLabel: "1.1GB",
    supportsImages: true,
    recommendedDevice: "webgpu",
    supportTier: "curated",
    interactionMode: "chat",
    chatFormat: "chatml",
  },
  {
    id: "onnx-community/Qwen3.5-2B-ONNX",
    revision: "d8ddc1cfd46bdefa6771b3a82097f3610a5b3ee4",
    label: "Qwen3.5 2B",
    thinkingMode: "optional",
    parameterCountLabel: "2B",
    quantizationLabel: "q4+fp16",
    downloadSizeLabel: "2GB",
    supportsImages: true,
    recommendedDevice: "webgpu",
    supportTier: "curated",
    interactionMode: "chat",
    chatFormat: "chatml",
  },
  {
    id: "onnx-community/gemma-4-E2B-it-ONNX",
    revision: "ee1a73e8f4cb9aab6c7165231bf7e8e6331051cc",
    label: "Gemma 4 E2B",
    thinkingMode: "optional",
    parameterCountLabel: "2B",
    quantizationLabel: "q4f16",
    downloadSizeLabel: "3.4GB",
    supportsImages: true,
    recommendedDevice: "webgpu",
    supportTier: "curated",
    interactionMode: "chat",
    chatFormat: "gemma",
  },
  {
    id: "HuggingFaceTB/SmolLM3-3B-ONNX",
    revision: "af50613703fb6f10ffcb21b27ad48edcb8334232",
    label: "SmolLM3 3B",
    thinkingMode: "optional",
    parameterCountLabel: "3B",
    quantizationLabel: "q4/q4f16",
    downloadSizeLabel: "2.1GB",
    supportsImages: false,
    recommendedDevice: "webgpu",
    supportTier: "curated",
    interactionMode: "chat",
    chatFormat: "smollm",
  },
];

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "onnx-community/gemma-4-E2B-it-ONNX": "Gemma 4 E2B",
};

function parseModelParameterCountB(modelId?: string | null) {
  const normalizedModelId = normalizeModelId(modelId);
  const match = normalizedModelId.match(/(\d+(?:\.\d+)?)B/i);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function isVlmModel(modelId?: string | null) {
  return /Qwen(?:2(?:\.5)?|3(?:\.5)?)|gemma(?:3n|[-_]?4)|paligemma|smolvlm|idefics|llava|mistral3/i.test(normalizeModelId(modelId));
}

export function getModelPreset(modelId?: string | null) {
  const normalizedModelId = resolveBrowserModelId(modelId);
  return MODEL_PRESETS.find((preset) => preset.id === normalizedModelId);
}

export function getModelDisplayName(modelId?: string | null) {
  const normalizedModelId = resolveBrowserModelId(modelId);
  const preset = getModelPreset(normalizedModelId);
  if (preset) {
    return preset.label;
  }

  const override = DISPLAY_NAME_OVERRIDES[normalizedModelId];
  if (override) {
    return override;
  }

  const repoName = normalizedModelId.split("/").pop();
  return repoName?.replace(/-ONNX$/i, "") || normalizedModelId;
}

export function getModelSelection(modelId?: string | null, overrides?: Partial<ModelSelection>): ModelSelection {
  const requestedModelId = normalizeModelId(modelId);
  const normalizedModelId = resolveBrowserModelId(requestedModelId);
  const modelWasAliased = normalizedModelId !== requestedModelId;
  const preset = getModelPreset(normalizedModelId);
  const supportsImages = overrides?.supportsImages ?? preset?.supportsImages ?? isVlmModel(normalizedModelId);
  const revision = preset?.supportTier === "curated"
    ? preset.revision ?? overrides?.revision ?? null
    : modelWasAliased
      ? preset?.revision ?? null
      : overrides?.revision ?? preset?.revision ?? null;

  return {
    id: normalizedModelId,
    revision,
    supportsImages,
    recommendedDevice: overrides?.recommendedDevice ?? preset?.recommendedDevice ?? "webgpu",
    supportTier: overrides?.supportTier ?? preset?.supportTier ?? "experimental",
    interactionMode: overrides?.interactionMode ?? preset?.interactionMode ?? getModelInteractionMode({
      modelId: normalizedModelId,
      supportsImages,
    }),
    chatFormat: overrides?.chatFormat ?? preset?.chatFormat ?? getModelChatFormatType({
      modelId: normalizedModelId,
      supportsImages,
    }),
  };
}

export function getModelQuantizationLabel(modelId?: string | null, isVisionModel = isVlmModel(modelId)) {
  const normalizedModelId = resolveBrowserModelId(modelId);
  if (/gemma-4/i.test(normalizedModelId)) return "q4f16";
  if (isVisionModel) return "q4+fp16";

  const parameterCountB = parseModelParameterCountB(normalizedModelId);
  if (parameterCountB !== null && parameterCountB >= 1) return "q4/q4f16";

  return "q4/fp16";
}

export function formatDownloadSizeLabel(valueGb: number | null) {
  if (valueGb === null) return null;
  if (valueGb < 1) return `${Math.round(valueGb * 1024)}MB`;
  return `${valueGb.toFixed(valueGb >= 10 ? 0 : 1)}GB`;
}

export function getModelCardMeta(modelId?: string | null, options?: {
  parameterCountLabel?: string | null;
  downloadSizeLabel?: string | null;
  isVisionModel?: boolean;
}) {
  const normalizedModelId = resolveBrowserModelId(modelId);
  const preset = getModelPreset(normalizedModelId);

  return [
    options?.parameterCountLabel ?? preset?.parameterCountLabel ?? null,
    preset?.quantizationLabel ?? getModelQuantizationLabel(normalizedModelId, options?.isVisionModel),
    options?.downloadSizeLabel ?? preset?.downloadSizeLabel ?? null,
  ].filter((part): part is string => Boolean(part));
}

export function getModelThinkingMode(modelId?: string | null): ThinkingMode {
  const normalizedModelId = resolveBrowserModelId(modelId);
  const presetMode = getModelPreset(normalizedModelId)?.thinkingMode;
  if (presetMode) return presetMode;
  if (normalizedModelId.includes("Qwen3.5")) return "optional";
  if (/gemma-4/i.test(normalizedModelId)) return "optional";
  return "unsupported";
}

export function getEffectiveThinkingEnabled(modelId: string | null | undefined, preferred: boolean): boolean {
  const thinkingMode = getModelThinkingMode(modelId);
  if (thinkingMode === "required") return true;
  if (thinkingMode === "unsupported") return false;
  return preferred;
}

export function canToggleThinking(modelId: string | null | undefined): boolean {
  return getModelThinkingMode(modelId) === "optional";
}

export const CONTEXT_WINDOWS: Record<string, number> = {
  "openai-community/gpt2": 1024,
  "onnx-community/LFM2.5-350M-ONNX": 32768, // 32k context window
  "onnx-community/Qwen3.5-0.8B-ONNX": 32768, // 32k context window
  "tsilva/unsloth_Qwen3.5-0.8B_uncensored": 32768, // 32k context window
  "onnx-community/Qwen3.5-2B-ONNX": 32768, // 32k context window
  "onnx-community/Qwen2.5-0.5B-Instruct": 32768, // 32k context window
  "HuggingFaceTB/SmolLM3-3B-ONNX": 32768, // 32k context window
  "onnx-community/gemma-4-E2B-it-ONNX": 131072, // 128k context window
};

export const DEFAULT_PARAMS: GenerationParams = {
  max_new_tokens: 2048,
  temperature: 0.8,
  top_p: 0.95,
  min_p: 0.05,
  top_k: 40,
  repetition_penalty: 1.1,
  do_sample: true,
  thinkingEnabled: false,
};

export const COMPLETION_PARAMS: GenerationParams = {
  ...DEFAULT_PARAMS,
  max_new_tokens: 256,
  temperature: 0.7,
  top_p: 0.9,
  min_p: 0,
  top_k: 50,
  repetition_penalty: 1.0,
  do_sample: true,
  thinkingEnabled: false,
};

export function getDefaultParamsForModel(model: ModelSelection): GenerationParams {
  return model.interactionMode === "completion" ? COMPLETION_PARAMS : DEFAULT_PARAMS;
}

export const PARAM_RANGES = {
  max_new_tokens: { min: 16, max: 2048, step: 16 },
  temperature: { min: 0.0, max: 2.0, step: 0.05 },
  top_p: { min: 0.0, max: 1.0, step: 0.05 },
  min_p: { min: 0.0, max: 1.0, step: 0.01 },
  top_k: { min: 1, max: 200, step: 1 },
  repetition_penalty: { min: 1.0, max: 2.0, step: 0.05 },
};

export const SLIDER_CONFIGS: { label: string; key: keyof typeof PARAM_RANGES; samplingOnly?: boolean }[] = [
  { label: "Max tokens", key: "max_new_tokens" },
  { label: "Temperature", key: "temperature", samplingOnly: true },
  { label: "Top P", key: "top_p", samplingOnly: true },
  { label: "Min P", key: "min_p", samplingOnly: true },
  { label: "Top K", key: "top_k", samplingOnly: true },
  { label: "Repetition penalty", key: "repetition_penalty", samplingOnly: true },
];
