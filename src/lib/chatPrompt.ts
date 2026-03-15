import { ChatMessage } from "@/types";

function normalizeMessageContent(content: string) {
  return content.trim();
}

export function hasTokenizerChatTemplate(tokenizer: { chat_template?: string | null }) {
  return Boolean(tokenizer.chat_template);
}

export function buildFallbackTextPrompt(messages: ChatMessage[]) {
  const promptLines: string[] = [];

  for (const message of messages) {
    const content = normalizeMessageContent(message.content);
    if (!content) continue;

    if (message.role === "system") {
      promptLines.push(`System: ${content}`);
      continue;
    }

    if (message.role === "user") {
      promptLines.push(`User: ${content}`);
      continue;
    }

    promptLines.push(`Assistant: ${content}`);
  }

  promptLines.push("Assistant:");
  return promptLines.join("\n");
}
