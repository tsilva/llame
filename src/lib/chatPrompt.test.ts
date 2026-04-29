import { describe, expect, it } from "vitest";
import { buildChatTemplateMessages, buildFallbackTextPrompt, hasTokenizerChatTemplate } from "@/lib/chatPrompt";

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
