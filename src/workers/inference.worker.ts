import {
  env,
  AutoConfig,
  AutoTokenizer,
  AutoModelForCausalLM,
  AutoModelForImageTextToText,
  AutoProcessor,
  ModelRegistry,
  TextStreamer,
  PreTrainedTokenizer,
  PreTrainedModel,
  RawImage,
  DataType,
} from "@huggingface/transformers";
import { WorkerRequest, WorkerResponse, ChatMessage, GenerationParams, GenerationStopReason, InferenceDevice } from "@/types";
import { getEffectiveThinkingEnabled, getModelThinkingMode, isVlmModel } from "@/lib/constants";
import { buildChatTemplateMessages, buildTextOnlyModelPrompt, hasTokenizerChatTemplate } from "@/lib/chatPrompt";
import { dataUrlToBlob } from "@/lib/dataUrl";
import { getModelInteractionMode } from "@/lib/modelInteraction";
import { pickDtypeForModel } from "@/lib/modelDtype";
import {
  AvailableCausalLmArtifact,
  CAUSAL_LM_MODEL_FILE_CANDIDATES,
  selectCausalLmLoadArtifact,
} from "@/lib/modelArtifacts";
import { ThinkingParser } from "@/lib/thinkingParser";
import { GeneratedTextSanitizer } from "@/lib/generatedTextSanitizer";
import { withRetry } from "@/lib/network";
import { classifyWorkerGenerationError, classifyWorkerLoadError } from "@/lib/workerErrors";
import {
  sanitizeGenerationParams,
  sanitizeWorkerMessages,
  validateModelSelection,
} from "@/lib/workerRequestValidation";
import { ACCEPTED_IMAGE_MIME_TYPES, MAX_COMPRESSED_IMAGE_BYTES } from "@/lib/imageUtils";
import { getOnnxWasmAssetPaths } from "@/lib/workerBootstrap";
env.allowLocalModels = false;
env.logLevel = 40;

const onnxWasmAssetPaths = getOnnxWasmAssetPaths(self.location);
if (onnxWasmAssetPaths && env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = onnxWasmAssetPaths;
}

env.fetch = async (input, init) => {
  const requestLike = input as { url?: string; toString(): string };
  const url = typeof input === "string" ? input : (requestLike.url ?? requestLike.toString());
  const isHuggingFaceAsset =
    /^https:\/\/(?:[^/]+\.)?(?:huggingface\.co|hf\.co|xethub\.hf\.co)\//.test(url);

  const requestInit: RequestInit = isHuggingFaceAsset
    ? {
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      }
    : {};

  try {
    return await fetch(input, {
      ...requestInit,
      ...init,
    });
  } catch (error) {
    if (!isHuggingFaceAsset) {
      throw error;
    }

    // Signed Hub/Xet redirects can go stale quickly, so force a fresh network lookup once.
    return fetch(input, {
      ...requestInit,
      ...init,
      cache: "reload",
    });
  }
};

let tokenizer: PreTrainedTokenizer | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
let model: PreTrainedModel | null = null;
let currentModelId: string | null = null;
let currentRevision: string | null = null;
let currentDevice: InferenceDevice | null = null;
let currentPrecision: string | null = null;
let currentSupportsImages = false;
let currentInteractionMode = getModelInteractionMode({});
let shouldInterrupt = false;
let generationId = 0;

function post(message: WorkerResponse) {
  self.postMessage(message);
}

function toBigIntTokenId(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(value);
  if (typeof value === "string" && /^\d+$/u.test(value)) return BigInt(value);
  return null;
}

function addTokenIds(target: Set<bigint>, value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((item) => addTokenIds(target, item));
    return;
  }

  const tokenId = toBigIntTokenId(value);
  if (tokenId !== null) {
    target.add(tokenId);
  }
}

function getEosTokenIds(activeTokenizer: PreTrainedTokenizer, activeModel: PreTrainedModel) {
  const eosTokenIds = new Set<bigint>();
  const tokenizerLike = activeTokenizer as { eos_token_id?: unknown };
  const modelLike = activeModel as {
    config?: { eos_token_id?: unknown };
    generation_config?: { eos_token_id?: unknown };
  };

  addTokenIds(eosTokenIds, tokenizerLike.eos_token_id);
  addTokenIds(eosTokenIds, modelLike.config?.eos_token_id);
  addTokenIds(eosTokenIds, modelLike.generation_config?.eos_token_id);

  return eosTokenIds;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Ignore serialization failures and fall back below.
  }
  return "Unknown error";
}

function promptEndsWithThinkingTag(prompt: string) {
  return /(?:<think>|<\|think\|>)\s*$/u.test(prompt);
}

async function resolveImageInput(source: string) {
  const dataUrlBlob = dataUrlToBlob(source, {
    allowedMimeTypes: ACCEPTED_IMAGE_MIME_TYPES,
    maxBytes: MAX_COMPRESSED_IMAGE_BYTES,
  });
  if (dataUrlBlob) {
    return RawImage.fromBlob(dataUrlBlob);
  }

  throw new Error("Unsupported image payload");
}

async function dispose() {
  if (model) {
    try {
      await (model as unknown as { dispose?: () => Promise<void> }).dispose?.();
    } catch {
      // Ignore disposal failures.
    }
    model = null;
  }
  tokenizer = null;
  processor = null;
  currentModelId = null;
  currentRevision = null;
  currentDevice = null;
  currentPrecision = null;
  currentSupportsImages = false;
  currentInteractionMode = getModelInteractionMode({});
}

function supportsModelType(autoModelClass: { supports?: (modelType: string) => boolean }, modelType: string) {
  return autoModelClass.supports?.(modelType) ?? false;
}

async function loadConfig(modelId: string, revision: string | null) {
  return withRetry(() => AutoConfig.from_pretrained(modelId, revision ? { revision } : undefined), 3);
}

async function getAvailableCausalLmArtifactDtypes(
  modelId: string,
  revision: string | null,
  config: Awaited<ReturnType<typeof AutoConfig.from_pretrained>>,
  modelFileName: (typeof CAUSAL_LM_MODEL_FILE_CANDIDATES)[number],
) {
  return withRetry(
    async () => ModelRegistry.get_available_dtypes(modelId, {
      config,
      ...(revision ? { revision } : {}),
      ...(modelFileName ? { model_file_name: modelFileName } : {}),
    }) as Promise<DataType[]>,
    2,
  );
}

async function resolveCausalLmLoadArtifact(
  modelId: string,
  revision: string | null,
  config: Awaited<ReturnType<typeof AutoConfig.from_pretrained>>,
  device: InferenceDevice,
) {
  const artifacts = await Promise.all(
    CAUSAL_LM_MODEL_FILE_CANDIDATES.map(async (modelFileName): Promise<AvailableCausalLmArtifact> => ({
      modelFileName,
      dtypes: await getAvailableCausalLmArtifactDtypes(modelId, revision, config, modelFileName),
    })),
  );
  const artifact = selectCausalLmLoadArtifact(modelId, device, artifacts);

  if (!artifact) {
    throw new Error(
      `No browser-compatible ONNX model artifacts found for ${modelId}. ` +
      "Expected onnx/model*.onnx or onnx/decoder_model_merged*.onnx files.",
    );
  }

  return artifact;
}

async function loadModel(modelId: string, revision: string | null, device: InferenceDevice) {
  if (
    currentModelId === modelId &&
    currentDevice === device &&
    currentPrecision &&
    currentRevision === (revision ?? null)
  ) {
    post({
      status: "loaded",
      modelId,
      revision: currentRevision,
      device,
      precision: currentPrecision,
      supportsImages: currentSupportsImages,
      interactionMode: currentInteractionMode,
    });
    return;
  }

  shouldInterrupt = true;
  generationId += 1;
  await dispose();
  shouldInterrupt = false;

  post({ status: "loading", message: "Loading tokenizer..." });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const progressCallback = (progress: any) => {
    if (progress.status === "progress") {
      post({
        status: "progress",
        progress: {
          file: progress.file,
          progress: progress.progress,
          loaded: progress.loaded,
          total: progress.total,
        },
      });
    } else if (progress.status === "progress_total") {
      post({
        status: "progress_total",
        progress: {
          progress: progress.progress,
          loaded: progress.loaded,
          total: progress.total,
        },
      });
    }
  };

  try {
    const config = await loadConfig(modelId, revision);
    const modelType = config.model_type;
    if (!modelType) {
      throw new Error("Model config is missing model_type");
    }

    const supportsImages = supportsModelType(AutoModelForImageTextToText, modelType);
    const supportsCausalLM = supportsModelType(AutoModelForCausalLM, modelType);
    const isQwen35 = modelType === "qwen3_5" || modelType === "qwen3_5_moe" || modelId.includes("Qwen3.5");
    const commonOptions = {
      progress_callback: progressCallback,
      ...(revision ? { revision } : {}),
    };

    if (supportsImages) {
      currentSupportsImages = true;
      processor = await AutoProcessor.from_pretrained(modelId, commonOptions);
      tokenizer = processor.tokenizer;
      currentInteractionMode = getModelInteractionMode({
        modelId,
        supportsImages: true,
        modelType,
        hasChatTemplate: hasTokenizerChatTemplate(tokenizer as unknown as { chat_template?: string | null }),
      });

      post({ status: "loading", message: "Loading model..." });

      const dtype = isQwen35
        ? {
            embed_tokens: "fp16",
            vision_encoder: "fp16",
            decoder_model_merged: "q4f16",
          }
        : pickDtypeForModel(modelId, device);
      currentPrecision = typeof dtype === "string" ? dtype : "q4f16+fp16";

      model = await AutoModelForImageTextToText.from_pretrained(modelId, {
        ...commonOptions,
        device,
        dtype,
      } as Parameters<typeof AutoModelForImageTextToText.from_pretrained>[1]);
    } else if (supportsCausalLM) {
      currentSupportsImages = false;
      tokenizer = await AutoTokenizer.from_pretrained(modelId, commonOptions);
      currentInteractionMode = getModelInteractionMode({
        modelId,
        supportsImages: false,
        modelType,
        hasChatTemplate: hasTokenizerChatTemplate(tokenizer as unknown as { chat_template?: string | null }),
      });

      post({ status: "loading", message: "Loading model..." });

      const { dtype, modelFileName } = await resolveCausalLmLoadArtifact(modelId, revision, config, device);
      currentPrecision = dtype;

      model = await AutoModelForCausalLM.from_pretrained(modelId, {
        ...commonOptions,
        device,
        dtype,
        ...(modelFileName ? { model_file_name: modelFileName } : {}),
      } as Parameters<typeof AutoModelForCausalLM.from_pretrained>[1]);
    } else {
      throw new Error(`Unsupported model type: ${modelType}`);
    }

    currentModelId = modelId;
    currentRevision = revision ?? null;
    currentDevice = device;

    post({ status: "loading", message: "Warming up..." });
    try {
      const dummyInput = tokenizer!("Hello", { return_tensor: true });
      await (model as { generate: (args: Record<string, unknown>) => Promise<unknown> }).generate({
        ...dummyInput,
        max_new_tokens: 1,
      });
    } catch {
      // Warm-up failure is non-critical.
    }

    post({
      status: "loaded",
      modelId,
      revision: currentRevision,
      device,
      precision: currentPrecision!,
      supportsImages: currentSupportsImages,
      interactionMode: currentInteractionMode,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const code = classifyWorkerLoadError(error);
    await dispose();
    post({
      status: "error",
      error: `Failed to load model: ${message}`,
      code,
      stage: "load",
      modelId,
      revision,
      device,
    });
  }
}

async function generate(messages: ChatMessage[], params: GenerationParams) {
  if (!tokenizer || !model) {
    post({
      status: "error",
      error: "No model loaded",
      code: "NO_MODEL_LOADED",
      stage: "generate",
      modelId: currentModelId,
      revision: currentRevision,
      device: currentDevice,
    });
    return;
  }

  const requestId = ++generationId;
  shouldInterrupt = false;
  post({ status: "generating" });

  try {
    const supportsImages = currentSupportsImages || (currentModelId ? isVlmModel(currentModelId) : false);
    const hasImages = supportsImages && messages.some((message) => message.images && message.images.length > 0);

    const chatMessages = buildChatTemplateMessages(messages, supportsImages);
    const interactionMode = currentInteractionMode;

    const thinkingMode = currentModelId ? getModelThinkingMode(currentModelId) : "unsupported";
    const thinkingEnabled = currentModelId
      ? getEffectiveThinkingEnabled(currentModelId, params.thinkingEnabled)
      : false;
    const inputText = (
      supportsImages && processor
        ? processor.apply_chat_template(chatMessages, {
            tokenize: false,
            add_generation_prompt: true,
            ...(thinkingMode !== "unsupported" ? { enable_thinking: thinkingEnabled } : {}),
          })
        : hasTokenizerChatTemplate(tokenizer as unknown as { chat_template?: string | null })
          ? buildTextOnlyModelPrompt(
            messages,
            tokenizer as unknown as Parameters<typeof buildTextOnlyModelPrompt>[1],
            interactionMode,
            {
              enableThinking: thinkingEnabled,
              supportsThinking: thinkingMode !== "unsupported",
            },
          )
          : buildTextOnlyModelPrompt(messages, {}, interactionMode)
    ) as string;
    post({ status: "prompt", inputText });

    const templateEndsWithThink = thinkingEnabled && promptEndsWithThinkingTag(inputText);
    const parser = new ThinkingParser(templateEndsWithThink);
    const sanitizer = new GeneratedTextSanitizer();
    const inputTokens = tokenizer(inputText, { return_tensor: false }).input_ids.length;

    let inputs: Record<string, unknown>;
    if (hasImages && processor) {
      post({ status: "processing", message: "Processing image..." });
      const resolvedImages = await Promise.all(
        messages
          .flatMap((message) => message.images || [])
          .map((image) => resolveImageInput(image)),
      );
      inputs = await processor(inputText, resolvedImages.length === 1 ? resolvedImages[0] : resolvedImages);
      post({ status: "generating" });
    } else {
      inputs = tokenizer(inputText, { return_tensor: true }) as Record<string, unknown>;
    }

    let numTokens = 0;
    const generatedTokenIds: bigint[] = [];
    const eosTokenIds = getEosTokenIds(tokenizer, model);
    let stopReason: GenerationStopReason = "unknown";
    const startTime = performance.now();
    const emitChunk = (chunk: string) => {
      if (!chunk) return;

      numTokens += 1;
      const elapsed = Math.max((performance.now() - startTime) / 1000, 0.001);
      const tps = numTokens / elapsed;
      const result = parser.processToken(chunk);

      if (result.type === "thinking" && result.content) {
        if (thinkingEnabled) {
          post({ status: "update", token: result.content, tps, numTokens, inputTokens, isThinking: true });
          if (result.thinkingComplete) {
            post({ status: "thinking_complete", thinking: parser.getThinkingContent() });
          }
        } else {
          post({ status: "update", token: result.content, tps, numTokens, inputTokens, isThinking: false });
        }
      } else if (result.type === "content" && result.content) {
        post({ status: "update", token: result.content, tps, numTokens, inputTokens, isThinking: false });
      }
    };
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: false,
      token_callback_function: (tokens: bigint[]) => {
        generatedTokenIds.push(...tokens);
      },
      callback_function: (rawToken: string) => {
        if (requestId !== generationId) return;

        post({ status: "raw_update", token: rawToken });
        emitChunk(sanitizer.processChunk(rawToken));
      },
    });
    const stoppingCriteria = (inputIds: unknown[]) => {
      const stop = shouldInterrupt || requestId !== generationId;
      if (stop && stopReason === "unknown") {
        stopReason = shouldInterrupt ? "interrupted" : "stale";
      }
      return new Array(inputIds.length).fill(stop);
    };

    await (model as { generate: (args: Record<string, unknown>) => Promise<unknown> }).generate({
      ...inputs,
      ...params,
      streamer,
      stopping_criteria: [stoppingCriteria],
    });

    if (requestId !== generationId) return;

    emitChunk(sanitizer.flush());

    const remaining = parser.flush();
    if (remaining) {
      const finalTps = numTokens / ((performance.now() - startTime) / 1000);
      if (remaining.type === "thinking") {
        if (thinkingEnabled) {
          post({ status: "update", token: remaining.content, tps: finalTps, numTokens, inputTokens, isThinking: true });
          post({ status: "thinking_complete", thinking: parser.getThinkingContent() });
        } else {
          post({ status: "update", token: remaining.content, tps: finalTps, numTokens, inputTokens, isThinking: false });
        }
      } else {
        post({ status: "update", token: remaining.content, tps: finalTps, numTokens, inputTokens, isThinking: false });
      }
    }

    const elapsed = Math.max((performance.now() - startTime) / 1000, 0.001);
    const finalTokenId = generatedTokenIds.at(-1);
    if (stopReason === "unknown" && finalTokenId !== undefined && eosTokenIds.has(finalTokenId)) {
      stopReason = "eos_token";
    } else if (stopReason === "unknown" && generatedTokenIds.length >= params.max_new_tokens) {
      stopReason = "max_new_tokens";
    }
    const tps = numTokens / elapsed;
    post({ status: "complete", tps, numTokens, generationTime: elapsed, stopReason });
  } catch (error) {
    if (requestId !== generationId) return;

    if (shouldInterrupt) {
      post({ status: "complete", tps: 0, numTokens: 0, generationTime: 0, stopReason: "interrupted" });
      return;
    }

    const message = getErrorMessage(error);
    post({
      status: "error",
      error: `Generation failed: ${message}`,
      code: classifyWorkerGenerationError(error),
      stage: "generate",
      modelId: currentModelId,
      revision: currentRevision,
      device: currentDevice,
    });
  }
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;

  switch (data.type) {
    case "load": {
      try {
        const selection = validateModelSelection(data.modelId, data.revision ?? null, data.device);
        await loadModel(selection.id, selection.revision ?? null, selection.device);
      } catch (error) {
        post({
          status: "error",
          error: getErrorMessage(error),
          code: "UNSUPPORTED_MODEL",
          stage: "load",
          modelId: typeof data.modelId === "string" ? data.modelId : null,
          revision: typeof data.revision === "string" ? data.revision : null,
          device: data.device === "webgpu" ? data.device : null,
        });
      }
      break;
    }
    case "generate":
      try {
        await generate(sanitizeWorkerMessages(data.messages), sanitizeGenerationParams(data.params));
      } catch (error) {
        post({
          status: "error",
          error: getErrorMessage(error),
          code: "GENERATION_ERROR",
          stage: "generate",
          modelId: currentModelId,
          revision: currentRevision,
          device: currentDevice,
        });
      }
      break;
    case "interrupt":
      shouldInterrupt = true;
      break;
    case "reset":
      shouldInterrupt = true;
      generationId += 1;
      await dispose();
      shouldInterrupt = false;
      post({ status: "unloaded" });
      break;
  }
});

post({ status: "ready" });
