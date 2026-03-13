import { WorkerErrorCode } from "@/types";

function includesAny(message: string, needles: string[]) {
  const normalized = message.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

export function classifyWorkerLoadError(error: unknown): WorkerErrorCode {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (includesAny(message, [
    "failed to fetch",
    "networkerror",
    "network error",
    "timed out",
    "timeout",
    "fetch",
    "load failed",
  ])) {
    return "NETWORK_ERROR";
  }

  if (includesAny(message, [
    "unsupported model type",
    "missing model_type",
    "not supported",
  ])) {
    return "UNSUPPORTED_MODEL";
  }

  if (includesAny(message, [
    "out of memory",
    "not enough memory",
    "device lost",
    "webgpu is not supported",
    "no available backend found",
    "allocation",
    "oom",
  ])) {
    return "INSUFFICIENT_RESOURCES";
  }

  if (includesAny(message, [
    "404",
    "403",
    "config.json",
    "tokenizer",
    "artifact",
    "corrupt",
  ])) {
    return "MODEL_ARTIFACT_ERROR";
  }

  return "UNKNOWN_ERROR";
}

export function classifyWorkerGenerationError(error: unknown): WorkerErrorCode {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (includesAny(message, [
    "failed to fetch",
    "networkerror",
    "network error",
  ])) {
    return "NETWORK_ERROR";
  }

  if (includesAny(message, [
    "out of memory",
    "device lost",
    "allocation",
    "oom",
  ])) {
    return "INSUFFICIENT_RESOURCES";
  }

  if (includesAny(message, ["no model loaded"])) {
    return "NO_MODEL_LOADED";
  }

  return "GENERATION_ERROR";
}
