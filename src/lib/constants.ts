import { GenerationParams, ModelSelection } from "@/types";

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

export const MODEL_PRESETS = [
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
  },
] satisfies ModelPreset[];

function parseModelParameterCountB(modelId: string) {
  const match = modelId.match(/(\d+(?:\.\d+)?)B/i);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function isVlmModel(modelId: string) {
  return /Qwen(?:2(?:\.5)?|3(?:\.5)?)|gemma3n|paligemma|smolvlm|idefics|llava|mistral3/i.test(modelId);
}

export function getModelPreset(modelId: string) {
  return MODEL_PRESETS.find((preset) => preset.id === modelId);
}

export function getModelDisplayName(modelId: string) {
  const preset = getModelPreset(modelId);
  if (preset) {
    return preset.label;
  }

  const repoName = modelId.split("/").pop();
  return repoName?.replace(/-ONNX$/i, "") || modelId;
}

export function getModelSelection(modelId: string, overrides?: Partial<ModelSelection>): ModelSelection {
  const preset = getModelPreset(modelId);

  return {
    id: modelId,
    revision: overrides?.revision ?? preset?.revision ?? null,
    supportsImages: overrides?.supportsImages ?? preset?.supportsImages ?? isVlmModel(modelId),
    recommendedDevice: overrides?.recommendedDevice ?? preset?.recommendedDevice ?? "webgpu",
    supportTier: overrides?.supportTier ?? preset?.supportTier ?? "experimental",
  };
}

export function getModelQuantizationLabel(modelId: string, isVisionModel = isVlmModel(modelId)) {
  if (isVisionModel) return "q4+fp16";

  const parameterCountB = parseModelParameterCountB(modelId);
  if (parameterCountB !== null && parameterCountB >= 1) return "q4/q4f16";

  return "q4/fp16";
}

export function formatDownloadSizeLabel(valueGb: number | null) {
  if (valueGb === null) return null;
  if (valueGb < 1) return `${Math.round(valueGb * 1024)}MB`;
  return `${valueGb.toFixed(valueGb >= 10 ? 0 : 1)}GB`;
}

export function getModelCardMeta(modelId: string, options?: {
  parameterCountLabel?: string | null;
  downloadSizeLabel?: string | null;
  isVisionModel?: boolean;
}) {
  const preset = getModelPreset(modelId);

  return [
    options?.parameterCountLabel ?? preset?.parameterCountLabel ?? null,
    preset?.quantizationLabel ?? getModelQuantizationLabel(modelId, options?.isVisionModel),
    options?.downloadSizeLabel ?? preset?.downloadSizeLabel ?? null,
  ].filter((part): part is string => Boolean(part));
}

export function getModelThinkingMode(modelId: string): ThinkingMode {
  const presetMode = getModelPreset(modelId)?.thinkingMode;
  if (presetMode) return presetMode;
  if (modelId.includes("Qwen3.5")) return "optional";
  return "unsupported";
}

export function getEffectiveThinkingEnabled(modelId: string, preferred: boolean): boolean {
  const thinkingMode = getModelThinkingMode(modelId);
  if (thinkingMode === "required") return true;
  if (thinkingMode === "unsupported") return false;
  return preferred;
}

export function canToggleThinking(modelId: string): boolean {
  return getModelThinkingMode(modelId) === "optional";
}

export const CONTEXT_WINDOWS: Record<string, number> = {
  "onnx-community/Qwen3.5-0.8B-ONNX": 32768, // 32k context window
  "onnx-community/Qwen3.5-2B-ONNX": 32768, // 32k context window
  "HuggingFaceTB/SmolLM3-3B-ONNX": 32768, // 32k context window
};

export const DEFAULT_PARAMS: GenerationParams = {
  max_new_tokens: 2048,
  temperature: 0.7,
  top_p: 0.9,
  top_k: 50,
  repetition_penalty: 1.1,
  do_sample: true,
  thinkingEnabled: false,
};

export const PARAM_RANGES = {
  max_new_tokens: { min: 16, max: 2048, step: 16 },
  temperature: { min: 0.0, max: 2.0, step: 0.05 },
  top_p: { min: 0.0, max: 1.0, step: 0.05 },
  top_k: { min: 1, max: 200, step: 1 },
  repetition_penalty: { min: 1.0, max: 2.0, step: 0.05 },
};

export const SLIDER_CONFIGS: { label: string; key: keyof typeof PARAM_RANGES; samplingOnly?: boolean }[] = [
  { label: "Max tokens", key: "max_new_tokens" },
  { label: "Temperature", key: "temperature", samplingOnly: true },
  { label: "Top P", key: "top_p", samplingOnly: true },
  { label: "Top K", key: "top_k", samplingOnly: true },
  { label: "Repetition penalty", key: "repetition_penalty", samplingOnly: true },
];
