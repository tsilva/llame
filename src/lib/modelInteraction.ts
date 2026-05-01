import { ModelChatFormatType, ModelInteractionMode } from "@/types";

interface ModelInteractionInput {
  modelId?: string | null;
  supportsImages?: boolean | null;
  isVisionModel?: boolean | null;
  tags?: string[] | null;
  pipelineTag?: string | null;
  modelType?: string | null;
  hasChatTemplate?: boolean | null;
  chatTemplate?: string | null;
}

const CHAT_ID_PATTERN = /(?:^|[/_.-])(?:chat|instruct|instruction|it)(?:$|[/_.-])/i;
const COMPLETION_ID_PATTERN = /(?:^|[/_.-])(?:bloomz?|distilgpt2|gpt2|gpt-?neo|gpt-?j|gpt-?neox|opt)(?:$|[/_.-])/i;
const TEXT_GENERATION_MODEL_TYPES = new Set([
  "afmoe",
  "apertus",
  "arcee",
  "bloom",
  "codegen",
  "cohere",
  "cohere2",
  "ernie4_5",
  "exaone",
  "falcon",
  "falcon_h1",
  "gemma",
  "gemma2",
  "gemma4_text",
  "glm",
  "gpt2",
  "gpt_bigcode",
  "gpt_neo",
  "gpt_neox",
  "gpt_oss",
  "gptj",
  "granite",
  "granitemoehybrid",
  "helium",
  "hunyuan_v1_dense",
  "jais",
  "lfm2",
  "lfm2_moe",
  "llama",
  "llama4_text",
  "mbart",
  "mistral",
  "ministral",
  "ministral3",
  "mobilellm",
  "modernbert-decoder",
  "mpt",
  "nanochat",
  "olmo",
  "olmo2",
  "olmo3",
  "olmo_hybrid",
  "openelm",
  "opt",
  "phi",
  "phi3",
  "qwen2",
  "qwen2_moe",
  "qwen3",
  "qwen3_moe",
  "qwen3_next",
  "smollm3",
  "stablelm",
  "starcoder2",
  "trocr",
  "vaultgemma",
  "youtu",
]);

function hasConversationalTag(tags: string[]) {
  return tags.some((tag) => tag.toLowerCase() === "conversational");
}

function hasChatModelId(modelId: string) {
  return CHAT_ID_PATTERN.test(modelId);
}

function hasCompletionModelId(modelId: string) {
  return COMPLETION_ID_PATTERN.test(modelId);
}

export function getModelInteractionMode(input: ModelInteractionInput): ModelInteractionMode {
  const modelId = input.modelId?.trim() ?? "";
  const tags = input.tags ?? [];
  const modelType = input.modelType?.trim() ?? null;

  if (input.supportsImages || input.isVisionModel) return "chat";
  if (input.hasChatTemplate) return "chat";
  if (hasConversationalTag(tags)) return "chat";
  if (modelId && hasChatModelId(modelId)) return "chat";

  if (input.pipelineTag === "text-generation") return "completion";
  if (modelType && TEXT_GENERATION_MODEL_TYPES.has(modelType)) return "completion";
  if (modelId && hasCompletionModelId(modelId)) return "completion";

  return "chat";
}

export function getModelInteractionLabel(mode?: ModelInteractionMode | null) {
  return mode === "completion" ? "Completion" : "Chat";
}

export function getModelChatFormatType(input: ModelInteractionInput): ModelChatFormatType {
  const modelId = input.modelId?.trim() ?? "";
  const modelType = input.modelType?.trim() ?? "";
  const chatTemplate = input.chatTemplate ?? "";
  const interactionMode = getModelInteractionMode(input);

  if (interactionMode === "completion") return "completion";

  if (chatTemplate.includes("<|im_start|>") || chatTemplate.includes("<|im_end|>")) return "chatml";
  if (chatTemplate.includes("<start_of_turn>") || chatTemplate.includes("<end_of_turn>")) return "gemma";
  if (chatTemplate.includes("<|start_header_id|>") || chatTemplate.includes("<|end_header_id|>")) return "llama-3";
  if (chatTemplate.includes("[INST]") || chatTemplate.includes("[/INST]")) return "mistral-instruct";
  if (chatTemplate.includes("<<SYS>>") || chatTemplate.includes("<</SYS>>")) return "llama-2";
  if (chatTemplate.includes("<|user|>") || chatTemplate.includes("<|assistant|>")) return "phi";
  if (chatTemplate.includes("<|start_of_role|>") || chatTemplate.includes("<|end_of_role|>")) return "smollm";

  if (/qwen|lfm2/i.test(`${modelId} ${modelType}`)) return "chatml";
  if (/gemma/i.test(`${modelId} ${modelType}`)) return "gemma";
  if (/smollm/i.test(`${modelId} ${modelType}`)) return "smollm";
  if (/llama-?3|llama3|llama4/i.test(`${modelId} ${modelType}`)) return "llama-3";
  if (/mistral|ministral/i.test(`${modelId} ${modelType}`)) return "mistral-instruct";
  if (/\bphi/i.test(`${modelId} ${modelType}`)) return "phi";
  if (/llama/i.test(`${modelId} ${modelType}`)) return "llama-2";

  if (input.hasChatTemplate) return "custom-template";
  return "role-labels";
}

export function getModelChatFormatLabel(format?: ModelChatFormatType | null) {
  if (format === "chatml") return "ChatML";
  if (format === "gemma") return "Gemma";
  if (format === "llama-3") return "Llama 3";
  if (format === "llama-2") return "Llama 2";
  if (format === "mistral-instruct") return "Mistral Instruct";
  if (format === "phi") return "Phi";
  if (format === "smollm") return "SmolLM";
  if (format === "completion") return "Completion";
  if (format === "custom-template") return "Custom template";
  return "Role labels";
}
