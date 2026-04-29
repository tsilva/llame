import { ChatMessage, GenerationParams, InferenceDevice, ModelSelection, TokenizationRequestItem } from "@/types";
import { PARAM_RANGES } from "@/lib/constants";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_COMPRESSED_IMAGE_BYTES,
  MAX_PENDING_IMAGES,
} from "@/lib/imageUtils";
import { dataUrlToBlob } from "@/lib/dataUrl";

const MAX_MESSAGES = 100;
const MAX_MESSAGE_CONTENT_CHARS = 200_000;
const MAX_TOKENIZATION_ITEMS = 200;
const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const REVISION_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/u;
const VALID_ROLES = new Set(["user", "assistant", "system"]);

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : fallback;
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  return Math.round(clampNumber(value, min, max, fallback));
}

export function sanitizeGenerationParams(value: unknown): GenerationParams {
  const params = value && typeof value === "object"
    ? value as Partial<GenerationParams>
    : {};

  return {
    max_new_tokens: clampInteger(
      params.max_new_tokens,
      PARAM_RANGES.max_new_tokens.min,
      PARAM_RANGES.max_new_tokens.max,
      PARAM_RANGES.max_new_tokens.min,
    ),
    temperature: clampNumber(
      params.temperature,
      PARAM_RANGES.temperature.min,
      PARAM_RANGES.temperature.max,
      PARAM_RANGES.temperature.min,
    ),
    top_p: clampNumber(params.top_p, PARAM_RANGES.top_p.min, PARAM_RANGES.top_p.max, PARAM_RANGES.top_p.max),
    min_p: clampNumber(params.min_p, PARAM_RANGES.min_p.min, PARAM_RANGES.min_p.max, PARAM_RANGES.min_p.min),
    top_k: clampInteger(params.top_k, PARAM_RANGES.top_k.min, PARAM_RANGES.top_k.max, PARAM_RANGES.top_k.min),
    repetition_penalty: clampNumber(
      params.repetition_penalty,
      PARAM_RANGES.repetition_penalty.min,
      PARAM_RANGES.repetition_penalty.max,
      PARAM_RANGES.repetition_penalty.min,
    ),
    do_sample: typeof params.do_sample === "boolean" ? params.do_sample : true,
    thinkingEnabled: typeof params.thinkingEnabled === "boolean" ? params.thinkingEnabled : false,
  };
}

export function validateModelSelection(modelId: unknown, revision: unknown, device: unknown): ModelSelection & {
  device: InferenceDevice;
} {
  if (typeof modelId !== "string" || !MODEL_ID_RE.test(modelId.trim())) {
    throw new Error("Invalid Hugging Face model id.");
  }

  const normalizedRevision = typeof revision === "string" && revision.trim().length > 0
    ? revision.trim()
    : null;

  if (normalizedRevision !== null && !REVISION_RE.test(normalizedRevision)) {
    throw new Error("Invalid model revision.");
  }

  if (device !== "webgpu") {
    throw new Error("WebGPU is the only supported inference device.");
  }

  return {
    id: modelId.trim(),
    revision: normalizedRevision,
    device,
  };
}

export function isSupportedImageDataUrl(source: unknown) {
  return typeof source === "string" && dataUrlToBlob(source, {
    allowedMimeTypes: ACCEPTED_IMAGE_MIME_TYPES,
    maxBytes: MAX_COMPRESSED_IMAGE_BYTES,
  }) !== null;
}

export function sanitizeWorkerMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    throw new Error("Invalid message list.");
  }

  let imageCount = 0;

  return value.map((message) => {
    if (!message || typeof message !== "object") {
      throw new Error("Invalid message.");
    }

    const candidate = message as Partial<ChatMessage>;
    if (!VALID_ROLES.has(candidate.role ?? "")) {
      throw new Error("Invalid message role.");
    }

    if (typeof candidate.content !== "string" || candidate.content.length > MAX_MESSAGE_CONTENT_CHARS) {
      throw new Error("Invalid message content.");
    }

    const images = Array.isArray(candidate.images)
      ? candidate.images.map((image) => {
        if (!isSupportedImageDataUrl(image)) {
          throw new Error("Unsupported image payload.");
        }
        imageCount += 1;
        if (imageCount > MAX_PENDING_IMAGES) {
          throw new Error("Too many image payloads.");
        }
        return image;
      })
      : undefined;

    return {
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : "worker-message",
      role: candidate.role as ChatMessage["role"],
      content: candidate.content,
      ...(images && images.length > 0 ? { images } : {}),
    };
  });
}

export function sanitizeTokenizationItems(value: unknown): TokenizationRequestItem[] {
  if (!Array.isArray(value) || value.length > MAX_TOKENIZATION_ITEMS) {
    throw new Error("Invalid tokenization item list.");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid tokenization item.");
    }

    const candidate = item as Partial<TokenizationRequestItem>;
    if (typeof candidate.id !== "string" || candidate.id.length === 0) {
      throw new Error("Invalid tokenization item id.");
    }

    if (typeof candidate.text !== "string" || candidate.text.length > MAX_MESSAGE_CONTENT_CHARS) {
      throw new Error("Invalid tokenization item text.");
    }

    return {
      id: candidate.id,
      text: candidate.text,
    };
  });
}
