import { GenerationParams, ModelSelection } from "@/types";

export const DEFAULT_MODEL = "onnx-community/Qwen3.5-0.8B-ONNX";
export const DEFAULT_MODEL_REVISION = "1c0849d8d3084bc7d6f8d00789d3f3cec0a6fda6";
export const DEFAULT_WASM_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";
export const DEFAULT_WASM_MODEL_REVISION = "cc5cc01a65cc3ff17bdb73a7de33d879f62599b0";

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
    id: "onnx-community/Qwen2.5-0.5B-Instruct",
    revision: "cc5cc01a65cc3ff17bdb73a7de33d879f62599b0",
    label: "Qwen2.5 0.5B",
    thinkingMode: "unsupported",
    parameterCountLabel: "0.5B",
    quantizationLabel: "q4/fp16",
    downloadSizeLabel: "538MB",
    supportsImages: false,
    recommendedDevice: "wasm",
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

function parseModelParameterCountB(modelId?: string | null) {
  const normalizedModelId = normalizeModelId(modelId);
  const match = normalizedModelId.match(/(\d+(?:\.\d+)?)B/i);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function isVlmModel(modelId?: string | null) {
  return /Qwen(?:2(?:\.5)?|3(?:\.5)?)|gemma3n|paligemma|smolvlm|idefics|llava|mistral3/i.test(normalizeModelId(modelId));
}

export function getModelPreset(modelId?: string | null) {
  const normalizedModelId = normalizeModelId(modelId);
  return MODEL_PRESETS.find((preset) => preset.id === normalizedModelId);
}

export function getModelDisplayName(modelId?: string | null) {
  const normalizedModelId = normalizeModelId(modelId);
  const preset = getModelPreset(normalizedModelId);
  if (preset) {
    return preset.label;
  }

  const repoName = normalizedModelId.split("/").pop();
  return repoName?.replace(/-ONNX$/i, "") || normalizedModelId;
}

export function getModelSelection(modelId?: string | null, overrides?: Partial<ModelSelection>): ModelSelection {
  const normalizedModelId = normalizeModelId(modelId);
  const preset = getModelPreset(normalizedModelId);

  return {
    id: normalizedModelId,
    revision: overrides?.revision ?? preset?.revision ?? null,
    supportsImages: overrides?.supportsImages ?? preset?.supportsImages ?? isVlmModel(normalizedModelId),
    recommendedDevice: overrides?.recommendedDevice ?? preset?.recommendedDevice ?? "webgpu",
    supportTier: overrides?.supportTier ?? preset?.supportTier ?? "experimental",
  };
}

export function getDefaultModelSelectionForDevice(device: "webgpu" | "wasm") {
  return getModelSelection(device === "wasm" ? DEFAULT_WASM_MODEL : DEFAULT_MODEL);
}

export function getModelQuantizationLabel(modelId?: string | null, isVisionModel = isVlmModel(modelId)) {
  const normalizedModelId = normalizeModelId(modelId);
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
  const normalizedModelId = normalizeModelId(modelId);
  const preset = getModelPreset(normalizedModelId);

  return [
    options?.parameterCountLabel ?? preset?.parameterCountLabel ?? null,
    preset?.quantizationLabel ?? getModelQuantizationLabel(normalizedModelId, options?.isVisionModel),
    options?.downloadSizeLabel ?? preset?.downloadSizeLabel ?? null,
  ].filter((part): part is string => Boolean(part));
}

export function getModelThinkingMode(modelId?: string | null): ThinkingMode {
  const normalizedModelId = normalizeModelId(modelId);
  const presetMode = getModelPreset(normalizedModelId)?.thinkingMode;
  if (presetMode) return presetMode;
  if (normalizedModelId.includes("Qwen3.5")) return "optional";
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
  "onnx-community/Qwen3.5-0.8B-ONNX": 32768, // 32k context window
  "onnx-community/Qwen3.5-2B-ONNX": 32768, // 32k context window
  "onnx-community/Qwen2.5-0.5B-Instruct": 32768, // 32k context window
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
