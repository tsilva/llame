import {
  env,
  AutoTokenizer,
  AutoModelForCausalLM,
  AutoModelForImageTextToText,
  AutoProcessor,
  TextStreamer,
  PreTrainedTokenizer,
  PreTrainedModel,
  Tensor,
  RawImage,
} from "@huggingface/transformers";
import { WorkerRequest, WorkerResponse, ChatMessage, GenerationParams } from "@/types";

env.allowLocalModels = false;

let tokenizer: PreTrainedTokenizer | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
let model: PreTrainedModel | null = null;
let currentModelId: string | null = null;
let currentPrecision: string | null = null;
let shouldInterrupt = false;

// Thinking parser to handle different thinking tag formats
class ThinkingParser {
  private buffer = "";
  private inThinking = false;
  private thinkingContent = "";
  private contentBuffer = "";
  private thinkingComplete = false;
  private hasDetectedThinking = false;

  constructor(startInThinking = false) {
    if (startInThinking) {
      this.inThinking = true;
      this.hasDetectedThinking = true;
    }
  }

  // Tag patterns for different model formats
  private static readonly START_PATTERNS = [
    "<thinking>",
    "<thought>",
    "<reasoning>",
    "<think>",
  ];

  private static readonly END_PATTERNS = [
    "</thinking>",
    "</thought>",
    "</reasoning>",
    "</think>",
  ];

  processToken(token: string): {
    type: "thinking" | "content" | "buffer"; 
    content: string;
    thinkingComplete?: boolean;
  } {
    this.buffer += token;

    // Check for thinking start patterns
    if (!this.inThinking && !this.thinkingComplete) {
      for (const pattern of ThinkingParser.START_PATTERNS) {
        if (this.buffer.includes(pattern)) {
          this.inThinking = true;
          this.hasDetectedThinking = true;
          // Extract any content before the thinking tag
          const beforeThinking = this.buffer.split(pattern)[0];
          this.buffer = this.buffer.substring(this.buffer.indexOf(pattern) + pattern.length);
          if (beforeThinking) {
            return { type: "content", content: beforeThinking };
          }
          return { type: "buffer", content: "" };
        }
      }
    }

    // Check for thinking end patterns
    if (this.inThinking) {
      for (const pattern of ThinkingParser.END_PATTERNS) {
        if (this.buffer.includes(pattern)) {
          const thinkingPart = this.buffer.split(pattern)[0];
          this.thinkingContent += thinkingPart;
          this.inThinking = false;
          this.thinkingComplete = true;
          this.buffer = this.buffer.substring(this.buffer.indexOf(pattern) + pattern.length);
          return { 
            type: "thinking", 
            content: thinkingPart,
            thinkingComplete: true 
          };
        }
      }
      // Still in thinking, accumulate all
      this.thinkingContent += token;
      return { type: "thinking", content: token };
    }

    // Not in thinking, check if we should emit content
    // Only emit if we have enough to avoid partial tag matches
    if (this.buffer.length > 20) {
      const toEmit = this.buffer.slice(0, -10);
      this.buffer = this.buffer.slice(-10);
      return { type: "content", content: toEmit };
    }

    return { type: "buffer", content: "" };
  }

  flush(): { type: "thinking" | "content"; content: string } | null {
    if (this.buffer) {
      if (this.inThinking) {
        this.thinkingContent += this.buffer;
        return { type: "thinking", content: this.buffer };
      } else {
        return { type: "content", content: this.buffer };
      }
    }
    return null;
  }

  isInThinking(): boolean {
    return this.inThinking;
  }

  isThinkingComplete(): boolean {
    return this.thinkingComplete;
  }

  hasThinking(): boolean {
    return this.hasDetectedThinking;
  }

  getThinkingContent(): string {
    return this.thinkingContent;
  }
}

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

function dispose() {
  if (model) {
    try {
      (model as unknown as { dispose?: () => Promise<void> }).dispose?.();
    } catch {
      // ignore
    }
    model = null;
  }
  tokenizer = null;
  processor = null;
  currentModelId = null;
  currentPrecision = null;
}

function pickDtype(modelId: string, device: "webgpu" | "wasm"): string {
  if (device !== "webgpu") return "q4";
  const match = modelId.match(/(\d+(?:\.\d+)?)B/i);
  if (match && parseFloat(match[1]) >= 1.0) return "q4";
  return "fp16";
}

async function loadModel(modelId: string, device: "webgpu" | "wasm") {
  if (currentModelId === modelId && currentPrecision) {
    post({ status: "loaded", modelId, device, precision: currentPrecision });
    return;
  }

  await dispose();

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
    // Check if this is a Qwen3.5 model (vision-language model)
    const isQwen35 = modelId.includes("Qwen3.5");

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
      currentPrecision = "q4/fp16";

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
    post({ status: "error", error: `Failed to load model: ${(err as Error).message}` });
  }
}

async function generate(messages: ChatMessage[], params: GenerationParams) {
  if (!tokenizer || !model) {
    post({ status: "error", error: "No model loaded" });
    return;
  }

  shouldInterrupt = false;
  post({ status: "generating" });

  try {
    // Check if this is a Qwen3.5 VLM model
    const isQwen35 = currentModelId?.includes("Qwen3.5") ?? false;
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

    // Enable thinking for Qwen3/3.5 models so they produce <think> tags
    const isQwen = currentModelId?.toLowerCase().includes("qwen") ?? false;
    const inputText = tokenizer.apply_chat_template(chatMessages as unknown as Parameters<typeof tokenizer.apply_chat_template>[0], {
      tokenize: false,
      add_generation_prompt: true,
      ...(isQwen && params.thinkingEnabled && { enable_thinking: true }),
    }) as string;

    // If the template ends with <think>, the model will start generating thinking
    // content directly — so initialize the parser in thinking mode
    const templateEndsWithThink = inputText.trimEnd().endsWith("<think>");
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
        // Filter out special tokens except thinking tags (which we need to parse)
        const token = rawToken.replace(/<\|[^>]*\|>/g, "");
        if (!token) return;
        numTokens++;
        const elapsed = (performance.now() - startTime) / 1000;
        const tps = numTokens / elapsed;

        const result = parser.processToken(token);

        if (result.type === "thinking" && result.content) {
          post({ status: "update", token: result.content, tps, numTokens, inputTokens, isThinking: true });
          if (result.thinkingComplete) {
            post({ status: "thinking_complete", thinking: parser.getThinkingContent() });
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
        () => {
          return shouldInterrupt;
        },
      ],
    });

    // Flush any remaining content
    const remaining = parser.flush();
    if (remaining) {
      const finalTps = numTokens / ((performance.now() - startTime) / 1000);
      if (remaining.type === "thinking") {
        post({ status: "update", token: remaining.content, tps: finalTps, numTokens, inputTokens, isThinking: true });
        post({ status: "thinking_complete", thinking: parser.getThinkingContent() });
      } else {
        post({ status: "update", token: remaining.content, tps: finalTps, numTokens, inputTokens, isThinking: false });
      }
    }

    const elapsed = (performance.now() - startTime) / 1000;
    const tps = numTokens / elapsed;
    post({ status: "complete", tps, numTokens });
  } catch (err) {
    if (shouldInterrupt) {
      post({ status: "complete", tps: 0, numTokens: 0 });
    } else {
      post({
        status: "error",
        error: `Generation failed: ${(err as Error).message}`,
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
      await dispose();
      post({ status: "unloaded" });
      break;
  }
});

post({ status: "ready" });
