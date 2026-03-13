export class ThinkingParser {
  private buffer = "";
  private inThinking = false;
  private thinkingContent = "";
  private thinkingComplete = false;

  private static readonly START_RE = /<(think|thinking|thought|reasoning)>/;
  private static readonly END_RE = /<\/(think|thinking|thought|reasoning)>/;

  constructor(startInThinking = false) {
    if (startInThinking) this.inThinking = true;
  }

  processToken(token: string): {
    type: "thinking" | "content" | "buffer";
    content: string;
    thinkingComplete?: boolean;
  } {
    this.buffer += token;

    if (!this.inThinking && !this.thinkingComplete) {
      const startMatch = this.buffer.match(ThinkingParser.START_RE);
      if (startMatch) {
        this.inThinking = true;
        const before = this.buffer.slice(0, startMatch.index ?? 0);
        this.buffer = this.buffer.slice((startMatch.index ?? 0) + startMatch[0].length);
        if (before) return { type: "content", content: before };
        return { type: "buffer", content: "" };
      }
    }

    if (this.inThinking) {
      const endMatch = this.buffer.match(ThinkingParser.END_RE);
      if (endMatch) {
        const thinkingPart = this.buffer.slice(0, endMatch.index ?? 0);
        this.thinkingContent += thinkingPart;
        this.inThinking = false;
        this.thinkingComplete = true;
        this.buffer = this.buffer.slice((endMatch.index ?? 0) + endMatch[0].length);
        return { type: "thinking", content: thinkingPart, thinkingComplete: true };
      }
      if (this.buffer.length > 20) {
        const toEmit = this.buffer.slice(0, -10);
        this.buffer = this.buffer.slice(-10);
        this.thinkingContent += toEmit;
        return { type: "thinking", content: toEmit };
      }
      return { type: "buffer", content: "" };
    }

    if (this.buffer.length > 20) {
      const toEmit = this.buffer.slice(0, -10);
      this.buffer = this.buffer.slice(-10);
      return { type: "content", content: toEmit };
    }

    return { type: "buffer", content: "" };
  }

  flush(): { type: "thinking" | "content"; content: string } | null {
    if (!this.buffer) return null;
    if (this.inThinking) {
      this.thinkingContent += this.buffer;
      return { type: "thinking", content: this.buffer };
    }
    return { type: "content", content: this.buffer };
  }

  getThinkingContent(): string {
    return this.thinkingContent;
  }
}
