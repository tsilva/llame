import { describe, expect, it } from "vitest";
import { ThinkingParser } from "@/lib/thinkingParser";

describe("ThinkingParser", () => {
  it("separates fragmented thinking tags from visible content", () => {
    const parser = new ThinkingParser();
    const chunks = ["Hello ", "<thi", "nk>", "secret", "</think>", " world"];

    const outputs = chunks
      .map((chunk) => parser.processToken(chunk))
      .filter((result) => result.type !== "buffer");

    expect(outputs).toEqual([
      { type: "content", content: "Hello " },
      { type: "thinking", content: "secret", thinkingComplete: true },
    ]);

    expect(parser.flush()).toEqual({ type: "content", content: " world" });
    expect(parser.getThinkingContent()).toBe("secret");
  });

  it("starts inside a thinking block when the prompt ends with an opening tag", () => {
    const parser = new ThinkingParser(true);

    expect(parser.processToken("step 1")).toEqual({ type: "buffer", content: "" });
    expect(parser.flush()).toEqual({ type: "thinking", content: "step 1" });
  });
});
