"use client";

import { getCompatibilityScoreAdjustment, isModelExcludedFromBrowser } from "@/lib/modelPolicies";
import { getModelInteractionMode } from "@/lib/modelInteraction";
import { InferenceDevice, ModelInteractionMode } from "@/types";

export interface HubModelApiEntry {
  id: string;
  sha?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  pipeline_tag?: string;
  lastModified?: string;
  createdAt?: string;
  usedStorage?: number;
  config?: {
    model_type?: string;
    tokenizer_config?: {
      chat_template?: string;
      chat_template_jinja?: string;
    };
  };
  siblings?: Array<{
    rfilename?: string;
  }>;
}

export interface DiscoveredModel {
  id: string;
  revision: string | null;
  name: string;
  downloads: number;
  likes: number;
  tags: string[];
  pipelineTag: string | null;
  lastModified: string | null;
  parameterCountB: number | null;
  estimatedDownloadGb: number | null;
  isVisionModel: boolean;
  interactionMode: ModelInteractionMode;
}

export interface ModelSearchPage {
  models: DiscoveredModel[];
  nextCursor: string | null;
}

export type ModelBrowserSort = "relevance" | "downloads" | "recency";

export interface CompatibilityContext {
  device: InferenceDevice;
  webgpuSupported: boolean | null;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
}

export interface ModelCompatibility {
  score: number;
  label: "Very likely" | "Likely" | "Maybe" | "Unlikely";
  tone: "green" | "emerald" | "amber" | "red";
  summary: string;
}

const GIGABYTE = 1024 ** 3;
const SUPPORTED_PIPELINE_TAGS = new Set(["text-generation", "image-text-to-text", "any-to-any"]);
const SUPPORTED_TEXT_TAGS = new Set(["text-generation", "conversational"]);
const UNSUPPORTED_TASK_TAGS = new Set([
  "feature-extraction",
  "sentence-similarity",
  "text-embeddings-inference",
]);
const SUPPORTED_TEXT_MODEL_TYPES = new Set([
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
  "phi3_v",
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
const SUPPORTED_VISION_MODEL_TYPES = new Set([
  "florence2",
  "gemma3n",
  "gemma4",
  "idefics3",
  "llava",
  "llava_onevision",
  "llava_qwen2",
  "mistral3",
  "moondream1",
  "paligemma",
  "phi3_v",
  "qwen2_5_vl",
  "qwen2_vl",
  "qwen3_5",
  "qwen3_5_moe",
  "qwen3_vl",
  "qwen3_vl_moe",
  "smolvlm",
]);

function getModelType(entry: HubModelApiEntry) {
  return entry.config?.model_type ?? null;
}

function isSupportedModelType(modelType: string | null) {
  if (!modelType) return false;
  return SUPPORTED_TEXT_MODEL_TYPES.has(modelType) || SUPPORTED_VISION_MODEL_TYPES.has(modelType);
}

function parseParameterCountB(modelId: string, tags: string[]) {
  const haystacks = [modelId, ...tags];

  for (const value of haystacks) {
    const match = value.match(/(?:^|[^\d])(\d+(?:\.\d+)?)\s*B(?:$|[^\w])/i);
    if (match) {
      const parsed = Number.parseFloat(match[1]);
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 1000) {
        return parsed;
      }
    }
  }

  return null;
}

function estimateDownloadGb(parameterCountB: number | null, usedStorage?: number) {
  if (typeof usedStorage === "number" && Number.isFinite(usedStorage) && usedStorage > 0) {
    return usedStorage / GIGABYTE;
  }

  if (parameterCountB === null) return null;
  if (parameterCountB <= 1) return parameterCountB * 1.05;
  if (parameterCountB <= 3) return parameterCountB * 0.9;
  return parameterCountB * 0.8;
}

function isVisionModel(modelId: string, tags: string[], pipelineTag: string | null, modelType: string | null) {
  return (
    pipelineTag === "any-to-any" ||
    pipelineTag === "image-text-to-text" ||
    SUPPORTED_VISION_MODEL_TYPES.has(modelType ?? "") ||
    /gemma-4/i.test(modelId) ||
    modelId.includes("Qwen3.5") ||
    tags.some((tag) => tag.includes("vision") || tag.includes("vlm"))
  );
}

function hasChatTemplate(entry: HubModelApiEntry) {
  return Boolean(
    entry.config?.tokenizer_config?.chat_template ||
    entry.config?.tokenizer_config?.chat_template_jinja,
  );
}

function hasUsableOnnxArtifacts(entry: HubModelApiEntry) {
  const filenames = entry.siblings
    ?.map((sibling) => sibling.rfilename)
    .filter((name): name is string => Boolean(name)) ?? [];

  if (filenames.length === 0) {
    return true;
  }

  const onnxFiles = filenames.filter((name) => name.startsWith("onnx/"));
  if (onnxFiles.length === 0) {
    return true;
  }

  return onnxFiles.some((name) => (
    name.startsWith("onnx/model_") ||
    name.startsWith("onnx/decoder_model") ||
    name.startsWith("onnx/embed_tokens") ||
    name.startsWith("onnx/vision_encoder")
  ));
}

function hasRequiredVisionProcessorAssets(entry: HubModelApiEntry) {
  const filenames = entry.siblings
    ?.map((sibling) => sibling.rfilename)
    .filter((name): name is string => Boolean(name)) ?? [];

  if (filenames.length === 0) {
    return true;
  }

  return filenames.includes("preprocessor_config.json");
}

function isSupportedChatModel(entry: HubModelApiEntry) {
  const tags = entry.tags ?? [];
  const pipelineTag = entry.pipeline_tag ?? null;
  const modelType = getModelType(entry);
  const hasUnsupportedName = isModelExcludedFromBrowser({
    id: entry.id,
    tags,
  });

  if (
    hasUnsupportedName ||
    (pipelineTag && !SUPPORTED_PIPELINE_TAGS.has(pipelineTag)) ||
    tags.some((tag) => UNSUPPORTED_TASK_TAGS.has(tag)) ||
    !hasUsableOnnxArtifacts(entry)
  ) {
    return false;
  }

  const looksLikeVisionModel = isVisionModel(entry.id, tags, pipelineTag, modelType);
  if (looksLikeVisionModel && !tags.includes("conversational") && !hasChatTemplate(entry)) {
    return false;
  }
  if (looksLikeVisionModel && !hasRequiredVisionProcessorAssets(entry)) {
    return false;
  }

  if (modelType) {
    return isSupportedModelType(modelType);
  }

  if (pipelineTag) {
    return SUPPORTED_PIPELINE_TAGS.has(pipelineTag);
  }

  return (
    isVisionModel(entry.id, tags, pipelineTag, modelType) ||
    tags.some((tag) => SUPPORTED_TEXT_TAGS.has(tag))
  );
}

function normalizeModel(entry: HubModelApiEntry): DiscoveredModel {
  const tags = entry.tags ?? [];
  const parameterCountB = parseParameterCountB(entry.id, tags);
  const pipelineTag = entry.pipeline_tag ?? null;
  const modelType = getModelType(entry);
  const isVision = isVisionModel(entry.id, tags, pipelineTag, modelType);

  return {
    id: entry.id,
    revision: entry.sha ?? null,
    name: entry.id.split("/").pop()?.replace(/-ONNX$/i, "") || entry.id,
    downloads: entry.downloads ?? 0,
    likes: entry.likes ?? 0,
    tags,
    pipelineTag,
    lastModified: entry.lastModified ?? entry.createdAt ?? null,
    parameterCountB,
    estimatedDownloadGb: estimateDownloadGb(parameterCountB, entry.usedStorage),
    isVisionModel: isVision,
    interactionMode: getModelInteractionMode({
      modelId: entry.id,
      isVisionModel: isVision,
      tags,
      pipelineTag,
      modelType,
      hasChatTemplate: hasChatTemplate(entry),
    }),
  };
}

function parseNextCursor(linkHeader: string | null) {
  if (!linkHeader) return null;

  const nextLink = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => /rel="?next"?/.test(part));

  if (!nextLink) return null;

  const match = nextLink.match(/<([^>]+)>/);
  if (!match) return null;

  try {
    const url = new URL(match[1]);
    return url.searchParams.get("cursor");
  } catch {
    return null;
  }
}

interface SearchBrowserReadyModelsOptions {
  cursor?: string | null;
  sort?: ModelBrowserSort;
}

function getHubSort(sort: ModelBrowserSort) {
  if (sort === "recency") {
    return {
      sort: "lastModified",
      direction: "-1",
    };
  }

  return {
    sort: "downloads",
    direction: "-1",
  };
}

export async function searchBrowserReadyModels(
  query: string,
  signal?: AbortSignal,
  options: SearchBrowserReadyModelsOptions = {},
): Promise<ModelSearchPage> {
  const requestedSort = options.sort ?? "relevance";
  const hubSort = getHubSort(requestedSort);
  const params = new URLSearchParams({
    filter: "onnx",
    limit: "24",
    sort: hubSort.sort,
    direction: hubSort.direction,
    full: "true",
    config: "true",
  });

  const trimmed = query.trim();
  if (trimmed) {
    params.set("search", trimmed);
  }
  if (options.cursor) {
    params.set("cursor", options.cursor);
  }

  let lastError: unknown = null;
  let response: Response | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const timeoutController = new AbortController();
    const timeout = window.setTimeout(
      () => timeoutController.abort(new DOMException("Request timed out", "AbortError")),
      8000,
    );
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      response = await fetch(`https://huggingface.co/api/models?${params.toString()}`, {
        signal: requestSignal,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Hugging Face search failed (${response.status})`);
      }

      break;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      if (attempt === 2) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 300 * 2 ** attempt));
    } finally {
      window.clearTimeout(timeout);
    }
  }

  if (!response) {
    throw lastError instanceof Error ? lastError : new Error("Hugging Face search failed");
  }

  const data = (await response.json()) as HubModelApiEntry[];

  return {
    models: data
      .filter((entry) => entry.id?.includes("/"))
      .filter((entry) => {
        const tags = entry.tags ?? [];
        return entry.id.endsWith("-ONNX") || tags.includes("onnx");
      })
      .filter(isSupportedChatModel)
      .map(normalizeModel),
    nextCursor: parseNextCursor(response.headers.get("Link")),
  };
}

function estimateWorkingSetGb(model: DiscoveredModel) {
  if (model.parameterCountB === null && model.estimatedDownloadGb === null) return null;

  if (model.estimatedDownloadGb !== null) {
    const multiplier = model.isVisionModel ? 1.6 : 1.35;
    return model.estimatedDownloadGb * multiplier;
  }

  const size = model.parameterCountB ?? 0;

  if (model.isVisionModel) return size * 1.8;
  if (size <= 1) return size * 1.3;
  if (size <= 3) return size * 1.55;
  return size * 1.85;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function assessModelCompatibility(model: DiscoveredModel, context: CompatibilityContext): ModelCompatibility {
  if (context.webgpuSupported === false) {
    return {
      score: 10,
      label: "Unlikely",
      tone: "red",
      summary: "WebGPU is unavailable in this browser. Local inference requires WebGPU.",
    };
  }

  let score = 72;

  const size = model.parameterCountB;
  const workingSetGb = estimateWorkingSetGb(model);

  if (size !== null) {
    if (size <= 1) score += 15;
    else if (size <= 2) score += 8;
    else if (size <= 4) score -= 4;
    else if (size <= 7) score -= 18;
    else score -= 32;
  } else {
    score -= 4;
  }

  if (model.isVisionModel) {
    score -= 10;
  }
  score += getCompatibilityScoreAdjustment({
    id: model.id,
    parameterCountB: size,
    isVisionModel: model.isVisionModel,
    device: context.device,
    deviceMemoryGb: context.deviceMemoryGb,
  });

  if (context.deviceMemoryGb !== null && workingSetGb !== null) {
    const browserBudgetGb = context.deviceMemoryGb * 0.45;

    if (workingSetGb <= browserBudgetGb * 0.75) score += 10;
    else if (workingSetGb <= browserBudgetGb) score += 2;
    else if (workingSetGb <= browserBudgetGb * 1.25) score -= 12;
    else score -= 26;
  }

  score = clamp(score, 5, 95);

  if (score >= 82) {
    return {
      score,
      label: "Very likely",
      tone: "green",
      summary: "Good fit for this browser and runtime.",
    };
  }

  if (score >= 65) {
    return {
      score,
      label: "Likely",
      tone: "emerald",
      summary: "Should run, but load time and speed depend on your GPU and RAM.",
    };
  }

  if (score >= 45) {
    return {
      score,
      label: "Maybe",
      tone: "amber",
      summary: "Borderline for this machine. Smaller models are safer.",
    };
  }

  return {
    score,
    label: "Unlikely",
    tone: "red",
    summary: "Large for this browser/runtime combination. Memory pressure is the main risk.",
  };
}
