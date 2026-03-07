import {
  env,
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

env.allowLocalModels = false;

let tokenizer: PreTrainedTokenizer | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
let model: PreTrainedModel | null = null;
let currentModelId: string | null = null;
let currentDevice: "webgpu" | "wasm" | null = null;
let currentPrecision: string | null = null;
let shouldInterrupt = false;
let generationId = 0;

// Thinking parser to handle different thinking tag formats
class ThinkingParser {
  private buffer = "";
  private inThinking = false;
  private thinkingContent = "";
  private thinkingComplete = false;

  private static readonly START_RE = /<(think|thinking|thought|reasoning)>/;
  private static readonly END_RE = /<\/(think|thinking|thought|reasoning)>/;

  constructor(startInThinking = false) {
    if (startInThinking) this.inThinking = true;
  }

  processToken(token: string): {
    type: "thinking" | "content" | "buffer";
    content: string;
    thinkingComplete?: boolean;
  } {
    this.buffer += token;

    if (!this.inThinking && !this.thinkingComplete) {
      const startMatch = this.buffer.match(ThinkingParser.START_RE);
      if (startMatch) {
        this.inThinking = true;
        const before = this.buffer.slice(0, startMatch.index!);
        this.buffer = this.buffer.slice(startMatch.index! + startMatch[0].length);
        if (before) return { type: "content", content: before };
        return { type: "buffer", content: "" };
      }
    }

    if (this.inThinking) {
      const endMatch = this.buffer.match(ThinkingParser.END_RE);
      if (endMatch) {
        const thinkingPart = this.buffer.slice(0, endMatch.index!);
        this.thinkingContent += thinkingPart;
        this.inThinking = false;
        this.thinkingComplete = true;
        this.buffer = this.buffer.slice(endMatch.index! + endMatch[0].length);
        return { type: "thinking", content: thinkingPart, thinkingComplete: true };
      }
      this.thinkingContent += token;
      return { type: "thinking", content: token };
    }

    if (this.buffer.length > 20) {
      const toEmit = this.buffer.slice(0, -10);
      this.buffer = this.buffer.slice(-10);
      return { type: "content", content: toEmit };
    }

    return { type: "buffer", content: "" };
  }

  flush(): { type: "thinking" | "content"; content: string } | null {
    if (!this.buffer) return null;
    if (this.inThinking) {
      this.thinkingContent += this.buffer;
      return { type: "thinking", content: this.buffer };
    }
    return { type: "content", content: this.buffer };
  }

  getThinkingContent(): string {
    return this.thinkingContent;
  }
}

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  try {
    const serialized = JSON.stringify(err);
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
      // ignore
    }
    model = null;
  }
  tokenizer = null;
  processor = null;
  currentModelId = null;
  currentDevice = null;
  currentPrecision = null;
}

function pickDtype(modelId: string, device: "webgpu" | "wasm"): string {
  if (device !== "webgpu") return "q4";
  const match = modelId.match(/(\d+(?:\.\d+)?)B/i);
  if (match && parseFloat(match[1]) >= 1.0) return "q4f16";
  return "fp16";
}

async function loadModel(modelId: string, device: "webgpu" | "wasm") {
  if (currentModelId === modelId && currentDevice === device && currentPrecision) {
    post({ status: "loaded", modelId, device, precision: currentPrecision });
    return;
  }

  shouldInterrupt = true;
  generationId++;
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
    }
  };

  try {
    const isQwen35 = isVlmModel(modelId);

    if (isQwen35) {
      // Qwen3.5 VLM needs AutoProcessor + AutoModelForImageTextToText
      processor = await AutoProcessor.from_pretrained(modelId, {
        progress_callback: progressCallback,
      });
      tokenizer = processor.tokenizer;

      post({ status: "loading", message: "Loading model..." });

      const vlmDtype = {
        embed_tokens: "q4",
        vision_encoder: "fp16",
        decoder_model_merged: "q4",
      };
      currentPrecision = "q4";

      model = await AutoModelForImageTextToText.from_pretrained(modelId, {
        device,
        dtype: vlmDtype,
        progress_callback: progressCallback,
      } as Parameters<typeof AutoModelForImageTextToText.from_pretrained>[1]);
    } else {
      // Standard causal LM
      tokenizer = await AutoTokenizer.from_pretrained(modelId, {
        progress_callback: progressCallback,
      });

      post({ status: "loading", message: "Loading model..." });

      const dtype = pickDtype(modelId, device);
      currentPrecision = dtype;

      model = await AutoModelForCausalLM.from_pretrained(modelId, {
        device,
        dtype,
        progress_callback: progressCallback,
      } as Parameters<typeof AutoModelForCausalLM.from_pretrained>[1]);
    }

    currentModelId = modelId;
    currentDevice = device;

    // Warm up with a dummy generation
    post({ status: "loading", message: "Warming up..." });
    try {
      const dummyInput = tokenizer!("Hello", { return_tensor: true });
      await (model as { generate: (args: Record<string, unknown>) => Promise<unknown> }).generate({
        ...dummyInput,
        max_new_tokens: 1,
      });
    } catch {
      // Warm-up failure is non-critical
    }

    post({ status: "loaded", modelId, device, precision: currentPrecision! });
  } catch (err) {
    await dispose();
    post({ status: "error", error: `Failed to load model: ${getErrorMessage(err)}` });
  }
}

async function generate(messages: ChatMessage[], params: GenerationParams) {
  if (!tokenizer || !model) {
    post({ status: "error", error: "No model loaded" });
    return;
  }

  const myId = ++generationId;
  shouldInterrupt = false;
  post({ status: "generating" });

  try {
    const isQwen35 = currentModelId ? isVlmModel(currentModelId) : false;
    const hasImages = isQwen35 && messages.some((m) => m.images && m.images.length > 0);

    // Format messages for the model
    const chatMessages = messages.map((m) => {
      if (m.images && m.images.length > 0 && isQwen35) {
        const content = [
          ...m.images.map((img) => ({ type: "image" as const, image: img })),
          { type: "text" as const, text: m.content },
        ];
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });

    const thinkingMode = currentModelId ? getModelThinkingMode(currentModelId) : "unsupported";
    const thinkingEnabled = currentModelId
      ? getEffectiveThinkingEnabled(currentModelId, params.thinkingEnabled)
      : false;
    const inputText = tokenizer.apply_chat_template(chatMessages as unknown as Parameters<typeof tokenizer.apply_chat_template>[0], {
      tokenize: false,
      add_generation_prompt: true,
      ...(thinkingMode !== "unsupported" ? { enable_thinking: thinkingEnabled } : {}),
    }) as string;
    post({ status: "prompt", inputText });

    // Keep parsing <think> tags even when hidden so they don't leak into chat content.
    // Only start in thinking mode when reasoning was explicitly enabled in the prompt.
    const templateEndsWithThink = thinkingEnabled && inputText.trimEnd().endsWith("<think>");
    const parser = new ThinkingParser(templateEndsWithThink);

    // Calculate input token count for context fullness tracking
    const inputTokens = tokenizer(inputText, { return_tensor: false }).input_ids.length;

    // For VLM with images, use processor; otherwise use tokenizer
    let inputs: Record<string, unknown>;
    if (hasImages && processor) {
      post({ status: "processing", message: "Processing image..." });
      const images = messages
        .flatMap((m) => m.images || [])
        .map((img) => RawImage.fromURL(img));
      const resolvedImages = await Promise.all(images);
      inputs = await processor(inputText, resolvedImages.length === 1 ? resolvedImages[0] : resolvedImages);
      // Transition back to generating state after image processing completes
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
        if (myId !== generationId) return;
        post({ status: "raw_update", token: rawToken });
        // Filter out special tokens except thinking tags (which we need to parse)
        const token = rawToken.replace(/<\|[^>]*\|>/g, "");
        if (!token) return;
        numTokens++;
        const elapsed = (performance.now() - startTime) / 1000;
        const tps = numTokens / elapsed;

        const result = parser.processToken(token);

        if (result.type === "thinking" && result.content) {
          if (thinkingEnabled) {
            post({ status: "update", token: result.content, tps, numTokens, inputTokens, isThinking: true });
            if (result.thinkingComplete) {
              post({ status: "thinking_complete", thinking: parser.getThinkingContent() });
            }
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
        () => shouldInterrupt || myId !== generationId,
      ],
    });

    // Don't flush or complete if superseded by a newer generation
    if (myId !== generationId) return;

    // Flush any remaining content
    const remaining = parser.flush();
    if (remaining) {
      const finalTps = numTokens / ((performance.now() - startTime) / 1000);
      if (remaining.type === "thinking") {
        if (thinkingEnabled) {
          post({ status: "update", token: remaining.content, tps: finalTps, numTokens, inputTokens, isThinking: true });
          post({ status: "thinking_complete", thinking: parser.getThinkingContent() });
        }
      } else {
        post({ status: "update", token: remaining.content, tps: finalTps, numTokens, inputTokens, isThinking: false });
      }
    }

    const elapsed = (performance.now() - startTime) / 1000;
    const tps = numTokens / elapsed;
    post({ status: "complete", tps, numTokens });
  } catch (err) {
    if (myId !== generationId) return;
    if (shouldInterrupt) {
      post({ status: "complete", tps: 0, numTokens: 0 });
    } else {
      post({
        status: "error",
        error: `Generation failed: ${getErrorMessage(err)}`,
      });
    }
  }
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;

  switch (data.type) {
    case "load":
      await loadModel(data.modelId, data.device);
      break;
    case "generate":
      await generate(data.messages, data.params);
      break;
    case "interrupt":
      shouldInterrupt = true;
      break;
    case "reset":
      shouldInterrupt = true;
      generationId++;
      await dispose();
      shouldInterrupt = false;
      post({ status: "unloaded" });
      break;
  }
});

post({ status: "ready" });
