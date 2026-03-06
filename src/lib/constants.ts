import { GenerationParams } from "@/types";

export const DEFAULT_MODEL = "onnx-community/Qwen3.5-0.8B-ONNX";

export const MODEL_PRESETS = [
  { id: "onnx-community/Qwen3.5-0.8B-ONNX", label: "Qwen3.5 0.8B (~850MB)" },
];

export const CONTEXT_WINDOWS: Record<string, number> = {
  "onnx-community/Qwen3.5-0.8B-ONNX": 32768, // 32k context window
};

export const DEFAULT_PARAMS: GenerationParams = {
  max_new_tokens: 2048,
  temperature: 0.7,
  top_p: 0.9,
  top_k: 50,
  repetition_penalty: 1.1,
  do_sample: true,
};

export const PARAM_RANGES = {
  max_new_tokens: { min: 16, max: 2048, step: 16 },
  temperature: { min: 0.0, max: 2.0, step: 0.05 },
  top_p: { min: 0.0, max: 1.0, step: 0.05 },
  top_k: { min: 1, max: 200, step: 1 },
  repetition_penalty: { min: 1.0, max: 2.0, step: 0.05 },
};
