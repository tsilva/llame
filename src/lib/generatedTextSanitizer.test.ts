import { describe, expect, it } from "vitest";
import { GeneratedTextSanitizer } from "@/lib/generatedTextSanitizer";

describe("GeneratedTextSanitizer", () => {
  it("removes Gemma 4 end-of-turn tokens from streamed output", () => {
    const sanitizer = new GeneratedTextSanitizer();

    expect(sanitizer.processChunk("Hello")).toBe("");
    expect(sanitizer.processChunk("<turn|>")).toBe("");
    expect(sanitizer.flush()).toBe("Hello");
  });

  it("removes fragmented control tokens across stream chunks", () => {
    const sanitizer = new GeneratedTextSanitizer();

    expect(sanitizer.processChunk("Hello<tur")).toBe("");
    expect(sanitizer.processChunk("n|> world")).toBe("");
    expect(sanitizer.flush()).toBe("Hello world");
  });

  it("removes start-pipe and full-pipe control token variants", () => {
    const sanitizer = new GeneratedTextSanitizer();

    expect(sanitizer.processChunk("A<|tool_response>B<|tool_call|>C")).toBe("");
    expect(sanitizer.flush()).toBe("ABC");
  });

  it("preserves thinking tags for the downstream parser", () => {
    const sanitizer = new GeneratedTextSanitizer();

    const streamed = sanitizer.processChunk("<think>secret</think>");
    expect(streamed + sanitizer.flush()).toBe("<think>secret</think>");
  });
});
