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

  it("classifies templated chat models separately from fallback chat prompts", () => {
    expect(getModelChatFormatType({
      modelId: "owner/base-llama",
      pipelineTag: "text-generation",
      modelType: "llama",
      hasChatTemplate: true,
    })).toBe("chat-template");

    expect(getModelChatFormatType({
      modelId: "owner/example-chat-model",
      pipelineTag: "text-generation",
      modelType: "llama",
    })).toBe("fallback-chat");
  });
});
