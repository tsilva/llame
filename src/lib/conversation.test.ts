import { describe, expect, it, vi } from "vitest";
import { Conversation } from "@/types";
import { removeEmptyTrailingAssistantMessage } from "@/lib/conversation";

const baseConversation: Conversation = {
  id: "conv-1",
  title: "Test",
  messages: [
    {
      id: "user-1",
      role: "user",
      content: "Hello",
    },
  ],
  createdAt: 100,
  updatedAt: 100,
  modelId: "onnx-community/Qwen3.5-0.8B-ONNX",
  modelRevision: null,
  modelSupportsImages: null,
  recommendedDevice: "webgpu",
  supportTier: "curated",
};

describe("removeEmptyTrailingAssistantMessage", () => {
  it("removes an empty trailing assistant placeholder", () => {
    vi.spyOn(Date, "now").mockReturnValue(250);

    const conversation = {
      ...baseConversation,
      messages: [
        ...baseConversation.messages,
        {
          id: "assistant-1",
          role: "assistant" as const,
          content: "",
          debug: { modelInput: "", rawOutput: "" },
        },
      ],
    };

    expect(removeEmptyTrailingAssistantMessage(conversation)).toEqual({
      ...baseConversation,
      updatedAt: 250,
    });
  });

  it("keeps an assistant message with visible content", () => {
    const conversation = {
      ...baseConversation,
      messages: [
        ...baseConversation.messages,
        {
          id: "assistant-1",
          role: "assistant" as const,
          content: "Partial reply",
        },
      ],
    };

    expect(removeEmptyTrailingAssistantMessage(conversation)).toBe(conversation);
  });

  it("keeps an assistant message with thinking content", () => {
    const conversation = {
      ...baseConversation,
      messages: [
        ...baseConversation.messages,
        {
          id: "assistant-1",
          role: "assistant" as const,
          content: "",
          thinking: "step 1",
        },
      ],
    };

    expect(removeEmptyTrailingAssistantMessage(conversation)).toBe(conversation);
  });
});
