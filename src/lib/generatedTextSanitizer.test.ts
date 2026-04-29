import { describe, expect, it } from "vitest";
import { GeneratedTextSanitizer } from "@/lib/generatedTextSanitizer";
import { ThinkingParser } from "@/lib/thinkingParser";

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

  it("removes SmolVLM end-of-utterance tokens from streamed output", () => {
    const sanitizer = new GeneratedTextSanitizer();

    const output = [
      sanitizer.processChunk("Quantum systems.<end_"),
      sanitizer.processChunk("of_utterance>"),
      sanitizer.flush(),
    ].join("");

    expect(output).toBe("Quantum systems.");
  });

  it("preserves thinking tags for the downstream parser", () => {
    const sanitizer = new GeneratedTextSanitizer();

    const streamed = sanitizer.processChunk("<think>secret</think>");
    expect(streamed + sanitizer.flush()).toBe("<think>secret</think>");
  });

  it("preserves Gemma 4 thinking channel markers for the downstream parser", () => {
    const sanitizer = new GeneratedTextSanitizer();
    const parser = new ThinkingParser();
    const chunks = ["<|chan", "nel>thought\n", "secret", "<channel|><turn|>", " answer"];

    const outputs = chunks
      .flatMap((chunk) => {
        const sanitized = sanitizer.processChunk(chunk);
        return sanitized ? [parser.processToken(sanitized)] : [];
      })
      .filter((result) => result.type !== "buffer");

    const remainingSanitized = sanitizer.flush();
    const remaining = remainingSanitized ? parser.processToken(remainingSanitized) : null;
    if (remaining && remaining.type !== "buffer") outputs.push(remaining);

    expect(outputs).toEqual([
      { type: "thinking", content: "secret", thinkingComplete: true },
    ]);
    expect(parser.flush()).toEqual({ type: "content", content: " answer" });
    expect(parser.getThinkingContent()).toBe("secret");
  });
});
