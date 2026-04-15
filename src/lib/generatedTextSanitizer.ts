const CONTROL_TOKEN_RE = /<(?:\|[^<>\s|]+(?:\|)?|[^<>\s|]+\||bos|eos|pad|mask|unk)>/g;
const CONTROL_TOKEN_TAIL_LENGTH = 20;

export class GeneratedTextSanitizer {
  private buffer = "";

  processChunk(chunk: string): string {
    this.buffer += chunk;

    const sanitized = this.buffer.replace(CONTROL_TOKEN_RE, "");
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
    const content = this.buffer.replace(CONTROL_TOKEN_RE, "");
    this.buffer = "";
    return content;
  }
}
