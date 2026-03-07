import { GenerationParams } from "@/types";

export const DEFAULT_MODEL = "onnx-community/Qwen3.5-0.8B-ONNX";

export const MODEL_PRESETS = [
  { id: "onnx-community/Qwen3.5-0.8B-ONNX", label: "Qwen3.5 0.8B (~850MB)" },
  { id: "onnx-community/Qwen3.5-2B-ONNX", label: "Qwen3.5 2B (~2GB)" },
  { id: "HuggingFaceTB/SmolLM3-3B-ONNX", label: "SmolLM3 3B (~2.1GB)" },
];

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
