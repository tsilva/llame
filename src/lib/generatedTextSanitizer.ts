const CONTROL_TOKEN_RE = /<(?:\|[^<>\s|]+(?:\|)?|[^<>\s|]+\||bos|eos|pad|mask|unk)>/g;
const CONTROL_TOKEN_TAIL_LENGTH = 20;
const THINKING_CHANNEL_TOKENS = new Set(["<|channel>", "<channel|>"]);

function stripControlTokens(text: string) {
  return text.replace(CONTROL_TOKEN_RE, (token) => (
    THINKING_CHANNEL_TOKENS.has(token) ? token : ""
  ));
}

export class GeneratedTextSanitizer {
  private buffer = "";

  processChunk(chunk: string): string {
    this.buffer += chunk;

    const sanitized = stripControlTokens(this.buffer);
    if (sanitized.length <= CONTROL_TOKEN_TAIL_LENGTH) {
      this.buffer = sanitized;
      return "";
    }

    const emitLength = sanitized.length - CONTROL_TOKEN_TAIL_LENGTH;
    const content = sanitized.slice(0, emitLength);
    this.buffer = sanitized.slice(emitLength);
    return content;
  }

  flush(): string {
    const content = stripControlTokens(this.buffer);
    this.buffer = "";
    return content;
  }
}
