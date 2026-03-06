import {
  env,
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  PreTrainedTokenizer,
  PreTrainedModel,
  Tensor,
} from "@huggingface/transformers";
import { WorkerRequest, WorkerResponse, ChatMessage, GenerationParams } from "@/types";

env.allowLocalModels = false;

let tokenizer: PreTrainedTokenizer | null = null;
let model: PreTrainedModel | null = null;
let currentModelId: string | null = null;
let shouldInterrupt = false;

// Thinking parser to handle different thinking tag formats
class ThinkingParser {
  private buffer = "";
  private inThinking = false;
  private thinkingContent = "";
  private contentBuffer = "";
  private thinkingComplete = false;
  private hasDetectedThinking = false;

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
  currentModelId = null;
}

async function loadModel(modelId: string, device: "webgpu" | "wasm") {
  if (currentModelId === modelId) {
    post({ status: "loaded", modelId, device });
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
    tokenizer = await AutoTokenizer.from_pretrained(modelId, {
      progress_callback: progressCallback,
    });

    post({ status: "loading", message: "Loading model..." });

    // Check if this is a Qwen3.5 model (vision-language model)
    const isQwen35 = modelId.includes("Qwen3.5");
    
    // For Qwen3.5 VLM models, use specific dtype configuration per component
    // Other models use simple fp16 (webgpu) or q4 (wasm)
    const dtype = isQwen35 
      ? { 
          embed_tokens: device === "webgpu" ? "q4" : "q4", 
          vision_encoder: "fp16", 
          decoder_model_merged: device === "webgpu" ? "q4" : "q4" 
        }
      : device === "webgpu" ? "fp16" : "q4";
    
    model = await AutoModelForCausalLM.from_pretrained(modelId, {
      device,
      dtype,
      progress_callback: progressCallback,
    } as Parameters<typeof AutoModelForCausalLM.from_pretrained>[1]);

    currentModelId = modelId;

    // Warm up with a dummy generation
    post({ status: "loading", message: "Warming up..." });
    try {
      const dummyInput = tokenizer("Hello", { return_tensor: true });
      await (model as { generate: (args: Record<string, unknown>) => Promise<unknown> }).generate({
        ...dummyInput,
        max_new_tokens: 1,
      });
    } catch {
      // Warm-up failure is non-critical
    }

    post({ status: "loaded", modelId, device });
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

  const parser = new ThinkingParser();

  try {
    // Check if this is a Qwen3.5 VLM model
    const isQwen35 = currentModelId?.includes("Qwen3.5") ?? false;

    // Format messages for the model
    // For VLM models with images, we need to use the multimodal format
    const chatMessages = messages.map((m) => {
      // If message has images and this is a VLM model, format as multimodal
      if (m.images && m.images.length > 0 && isQwen35) {
        const content = [
          ...m.images.map((img) => ({ type: "image" as const, image: img })),
          { type: "text" as const, text: m.content },
        ];
        return {
          role: m.role,
          content,
        };
      }
      // Standard text-only format
      return {
        role: m.role,
        content: m.content,
      };
    });

    const inputText = tokenizer.apply_chat_template(chatMessages as unknown as Parameters<typeof tokenizer.apply_chat_template>[0], {
      tokenize: false,
      add_generation_prompt: true,
    }) as string;

    const inputs = tokenizer(inputText, { return_tensor: true }) as { input_ids: Tensor; attention_mask: Tensor };

    let numTokens = 0;
    const startTime = performance.now();

    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (token: string) => {
        numTokens++;
        const elapsed = (performance.now() - startTime) / 1000;
        const tps = numTokens / elapsed;
        
        const result = parser.processToken(token);
        
        if (result.type === "thinking" && result.content) {
          post({ status: "update", token: result.content, tps, numTokens, isThinking: true });
          if (result.thinkingComplete) {
            post({ status: "thinking_complete", thinking: parser.getThinkingContent() });
          }
        } else if (result.type === "content" && result.content) {
          post({ status: "update", token: result.content, tps, numTokens, isThinking: false });
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
      if (remaining.type === "thinking") {
        post({ status: "update", token: remaining.content, tps: numTokens / ((performance.now() - startTime) / 1000), numTokens, isThinking: true });
        post({ status: "thinking_complete", thinking: parser.getThinkingContent() });
      } else {
        post({ status: "update", token: remaining.content, tps: numTokens / ((performance.now() - startTime) / 1000), numTokens, isThinking: false });
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
