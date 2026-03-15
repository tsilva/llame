import {
  env,
  AutoConfig,
  AutoTokenizer,
  AutoModelForCausalLM,
  AutoModelForImageTextToText,
  AutoProcessor,
  TextStreamer,
  PreTrainedTokenizer,
  PreTrainedModel,
  RawImage,
} from "@huggingface/transformers";
import { WorkerRequest, WorkerResponse, ChatMessage, GenerationParams } from "@/types";
import { getEffectiveThinkingEnabled, getModelThinkingMode, isVlmModel } from "@/lib/constants";
import { buildFallbackTextPrompt, hasTokenizerChatTemplate } from "@/lib/chatPrompt";
import { pickDtypeForModel } from "@/lib/modelDtype";
import { ThinkingParser } from "@/lib/thinkingParser";
import { withRetry } from "@/lib/network";
import { classifyWorkerGenerationError, classifyWorkerLoadError } from "@/lib/workerErrors";
import { getOnnxWasmAssetBaseUrl } from "@/lib/workerBootstrap";

env.allowLocalModels = false;
env.logLevel = 40;

type OnnxBackendEnvironment = {
  wasm?: {
    numThreads?: number;
    wasmPaths?:
      | string
      | {
          mjs: string;
          wasm: string;
        };
  };
};

function configureOnnxWasmPaths() {
  const onnxBackend = env.backends.onnx as OnnxBackendEnvironment | undefined;
  if (!onnxBackend?.wasm) {
    return;
  }

  const assetBaseUrl = getOnnxWasmAssetBaseUrl(self.location);
  if (!assetBaseUrl) {
    return;
  }

  // The worker bundle itself is loaded via a blob URL in production, which makes
  // ORT/Transformers.js fall back to a blob-based module preload path. Forcing a
  // same-origin prefix and single-threaded init avoids that bootstrap path.
  env.useWasmCache = false;
  onnxBackend.wasm.numThreads = 1;
  onnxBackend.wasm.wasmPaths = assetBaseUrl;
}

configureOnnxWasmPaths();

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
let currentDevice: "webgpu" | "wasm" | null = null;
let currentPrecision: string | null = null;
let currentSupportsImages = false;
let shouldInterrupt = false;
let generationId = 0;

function post(message: WorkerResponse) {
  self.postMessage(message);
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
}

function supportsModelType(autoModelClass: { supports?: (modelType: string) => boolean }, modelType: string) {
  return autoModelClass.supports?.(modelType) ?? false;
}

async function loadConfig(modelId: string, revision: string | null) {
  return withRetry(() => AutoConfig.from_pretrained(modelId, revision ? { revision } : undefined), 3);
}

async function loadModel(modelId: string, revision: string | null, device: "webgpu" | "wasm") {
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

      post({ status: "loading", message: "Loading model..." });

      const dtype = isQwen35
        ? {
            embed_tokens: "q4",
            vision_encoder: "fp16",
            decoder_model_merged: "q4",
          }
        : pickDtypeForModel(modelId, device);
      currentPrecision = typeof dtype === "string" ? dtype : "q4";

      model = await AutoModelForImageTextToText.from_pretrained(modelId, {
        ...commonOptions,
        device,
        dtype,
      } as Parameters<typeof AutoModelForImageTextToText.from_pretrained>[1]);
    } else if (supportsCausalLM) {
      currentSupportsImages = false;
      tokenizer = await AutoTokenizer.from_pretrained(modelId, commonOptions);

      post({ status: "loading", message: "Loading model..." });

      const dtype = pickDtypeForModel(modelId, device);
      currentPrecision = dtype;

      model = await AutoModelForCausalLM.from_pretrained(modelId, {
        ...commonOptions,
        device,
        dtype,
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

    const chatMessages = messages.map((message) => {
      if (message.images && message.images.length > 0 && supportsImages) {
        const content = [
          ...message.images.map((image) => ({ type: "image" as const, image })),
          { type: "text" as const, text: message.content },
        ];
        return { role: message.role, content };
      }
      return { role: message.role, content: message.content };
    });

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
          ? tokenizer.apply_chat_template(
            chatMessages as unknown as Parameters<typeof tokenizer.apply_chat_template>[0],
            {
              tokenize: false,
              add_generation_prompt: true,
              ...(thinkingMode !== "unsupported" ? { enable_thinking: thinkingEnabled } : {}),
            },
          )
          : buildFallbackTextPrompt(messages)
    ) as string;
    post({ status: "prompt", inputText });

    const templateEndsWithThink = thinkingEnabled && inputText.trimEnd().endsWith("<think>");
    const parser = new ThinkingParser(templateEndsWithThink);
    const inputTokens = tokenizer(inputText, { return_tensor: false }).input_ids.length;

    let inputs: Record<string, unknown>;
    if (hasImages && processor) {
      post({ status: "processing", message: "Processing image..." });
      const images = messages
        .flatMap((message) => message.images || [])
        .map((image) => RawImage.fromURL(image));
      const resolvedImages = await Promise.all(images);
      inputs = await processor(inputText, resolvedImages.length === 1 ? resolvedImages[0] : resolvedImages);
      post({ status: "generating" });
    } else {
      inputs = tokenizer(inputText, { return_tensor: true }) as Record<string, unknown>;
    }

    let numTokens = 0;
    const startTime = performance.now();
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: false,
      callback_function: (rawToken: string) => {
        if (requestId !== generationId) return;

        post({ status: "raw_update", token: rawToken });
        const token = rawToken.replace(/<\|[^>]*\|>/g, "");
        if (!token) return;

        numTokens += 1;
        const elapsed = (performance.now() - startTime) / 1000;
        const tps = numTokens / elapsed;
        const result = parser.processToken(token);

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
      },
    });

    await (model as { generate: (args: Record<string, unknown>) => Promise<unknown> }).generate({
      ...inputs,
      ...params,
      streamer,
      stopping_criteria: [
        () => shouldInterrupt || requestId !== generationId,
      ],
    });

    if (requestId !== generationId) return;

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

    const elapsed = (performance.now() - startTime) / 1000;
    const tps = numTokens / elapsed;
    post({ status: "complete", tps, numTokens });
  } catch (error) {
    if (requestId !== generationId) return;

    if (shouldInterrupt) {
      post({ status: "complete", tps: 0, numTokens: 0 });
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
    case "load":
      await loadModel(data.modelId, data.revision ?? null, data.device);
      break;
    case "generate":
      await generate(data.messages, data.params);
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
