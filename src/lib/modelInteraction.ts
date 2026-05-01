import { ModelChatFormatType, ModelInteractionMode } from "@/types";

interface ModelInteractionInput {
  modelId?: string | null;
  supportsImages?: boolean | null;
  isVisionModel?: boolean | null;
  tags?: string[] | null;
  pipelineTag?: string | null;
  modelType?: string | null;
  hasChatTemplate?: boolean | null;
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
  const interactionMode = getModelInteractionMode(input);
  if (interactionMode === "completion") return "completion";
  return input.hasChatTemplate ? "chat-template" : "fallback-chat";
}

export function getModelChatFormatLabel(format?: ModelChatFormatType | null) {
  if (format === "completion") return "Completion prompt";
  if (format === "fallback-chat") return "Fallback chat";
  return "Chat template";
}
