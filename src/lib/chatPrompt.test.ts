import { describe, expect, it } from "vitest";
import {
  buildChatTemplateMessages,
  buildCompletionPrompt,
  buildFallbackTextPrompt,
  buildTextOnlyModelPrompt,
  hasTokenizerChatTemplate,
} from "@/lib/chatPrompt";

describe("chatPrompt", () => {
  it("detects tokenizer chat templates", () => {
    expect(hasTokenizerChatTemplate({ chat_template: "<|im_start|>{{ message }}" })).toBe(true);
    expect(hasTokenizerChatTemplate({ chat_template: "" })).toBe(false);
    expect(hasTokenizerChatTemplate({})).toBe(false);
  });

  it("builds a fallback text prompt for causal models without chat templates", () => {
    expect(buildFallbackTextPrompt([
      {
        id: "1",
        role: "system",
        content: "Be concise.",
      },
      {
        id: "2",
        role: "user",
        content: "Reply with one short sentence about browsers.",
      },
    ])).toBe(
      "System: Be concise.\nUser: Reply with one short sentence about browsers.\nAssistant:",
    );
  });

  it("builds a completion prompt from the latest user message", () => {
    expect(buildCompletionPrompt([
      {
        id: "1",
        role: "user",
        content: "First prompt",
      },
      {
        id: "2",
        role: "assistant",
        content: "First continuation",
      },
      {
        id: "3",
        role: "user",
        content: "  Continue this story  ",
      },
    ])).toBe("Continue this story");
  });

  it("returns an empty completion prompt without user content", () => {
    expect(buildCompletionPrompt([
      {
        id: "1",
        role: "assistant",
        content: "Only assistant content",
      },
    ])).toBe("");
  });

  it("uses completion formatting for text models without chat templates", () => {
    expect(buildTextOnlyModelPrompt([
      {
        id: "1",
        role: "user",
        content: "First prompt",
      },
      {
        id: "2",
        role: "user",
        content: "Second prompt",
      },
    ], {}, "completion")).toBe("Second prompt");
  });

  it("keeps fallback chat formatting for chat models without templates", () => {
    expect(buildTextOnlyModelPrompt([
      {
        id: "1",
        role: "user",
        content: "Reply briefly.",
      },
    ], {}, "chat")).toBe("User: Reply briefly.\nAssistant:");
  });

  it("applies tokenizer chat templates before interaction fallback", () => {
    expect(buildTextOnlyModelPrompt([
      {
        id: "1",
        role: "user",
        content: "Hello",
      },
    ], {
      chat_template: "{{ messages }}",
      apply_chat_template: (messages) => `${messages[0]!.role}: ${messages[0]!.content}`,
    }, "completion")).toBe("user: Hello");
  });

  it("keeps text-only model messages as string content", () => {
    expect(buildChatTemplateMessages([
      {
        id: "1",
        role: "user",
        content: "Say hello.",
      },
    ], false)).toEqual([
      {
        role: "user",
        content: "Say hello.",
      },
    ]);
  });

  it("uses multimodal content arrays for vision model chat templates", () => {
    expect(buildChatTemplateMessages([
      {
        id: "1",
        role: "user",
        content: "Describe this image.",
        images: ["data:image/png;base64,abc"],
      },
      {
        id: "2",
        role: "assistant",
        content: "It is a chart.",
      },
    ], true)).toEqual([
      {
        role: "user",
        content: [
          { type: "image", image: "data:image/png;base64,abc" },
          { type: "text", text: "Describe this image." },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "It is a chart." },
        ],
      },
    ]);
  });
});
