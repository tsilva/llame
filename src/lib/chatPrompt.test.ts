import { describe, expect, it } from "vitest";
import { buildFallbackTextPrompt, hasTokenizerChatTemplate } from "@/lib/chatPrompt";

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
});
