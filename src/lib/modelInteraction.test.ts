import { describe, expect, it } from "vitest";
import { getModelChatFormatType, getModelInteractionMode } from "@/lib/modelInteraction";

describe("getModelInteractionMode", () => {
  it("classifies GPT-2-like base text-generation models as completion", () => {
    expect(getModelInteractionMode({
      modelId: "openai-community/gpt2",
      pipelineTag: "text-generation",
      modelType: "gpt2",
    })).toBe("completion");
  });

  it("classifies instruct, chat, conversational, and templated models as chat", () => {
    expect(getModelInteractionMode({
      modelId: "onnx-community/Qwen2.5-0.5B-Instruct",
      pipelineTag: "text-generation",
      modelType: "qwen2",
    })).toBe("chat");
    expect(getModelInteractionMode({
      modelId: "owner/example-chat-model",
      pipelineTag: "text-generation",
      modelType: "llama",
    })).toBe("chat");
    expect(getModelInteractionMode({
      modelId: "onnx-community/gemma-4-E2B-it-ONNX",
      pipelineTag: "text-generation",
      modelType: "gemma4_text",
    })).toBe("chat");
    expect(getModelInteractionMode({
      modelId: "owner/base-llama",
      tags: ["onnx", "conversational"],
      pipelineTag: "text-generation",
      modelType: "llama",
    })).toBe("chat");
    expect(getModelInteractionMode({
      modelId: "owner/base-llama",
      pipelineTag: "text-generation",
      modelType: "llama",
      hasChatTemplate: true,
    })).toBe("chat");
  });

  it("classifies vision models as chat", () => {
    expect(getModelInteractionMode({
      modelId: "onnx-community/Qwen3.5-0.8B-ONNX",
      isVisionModel: true,
      pipelineTag: "image-text-to-text",
      modelType: "qwen3_5",
    })).toBe("chat");
  });
});

describe("getModelChatFormatType", () => {
  it("classifies base completion models as completion prompts", () => {
    expect(getModelChatFormatType({
      modelId: "openai-community/gpt2",
      pipelineTag: "text-generation",
      modelType: "gpt2",
    })).toBe("completion");
  });

  it("classifies common chat template delimiter families", () => {
    expect(getModelChatFormatType({
      modelId: "owner/qwen",
      chatTemplate: "{% for message in messages %}<|im_start|>{{ message.role }}\n{{ message.content }}<|im_end|>{% endfor %}",
      hasChatTemplate: true,
    })).toBe("chatml");

    expect(getModelChatFormatType({
      modelId: "owner/gemma",
      chatTemplate: "{% for message in messages %}<start_of_turn>{{ message.role }}\n{{ message.content }}<end_of_turn>{% endfor %}",
      hasChatTemplate: true,
    })).toBe("gemma");

    expect(getModelChatFormatType({
      modelId: "owner/base-llama",
      chatTemplate: "<|start_header_id|>user<|end_header_id|>\n{{ message.content }}",
      hasChatTemplate: true,
    })).toBe("llama-3");
  });

  it("falls back to model family or role-label prompts when no known delimiters are present", () => {
    expect(getModelChatFormatType({
      modelId: "HuggingFaceTB/SmolLM3-3B-ONNX",
      pipelineTag: "text-generation",
      modelType: "smollm3",
      hasChatTemplate: true,
      chatTemplate: "{%- for message in messages -%}{%- endfor -%}",
    })).toBe("smollm");

    expect(getModelChatFormatType({
      modelId: "owner/example-chat-model",
      pipelineTag: "text-generation",
      modelType: "llama",
    })).toBe("llama-2");

    expect(getModelChatFormatType({
      modelId: "owner/example-chat-model",
    })).toBe("role-labels");
  });
});
