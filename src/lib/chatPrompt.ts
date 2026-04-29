import { ChatMessage } from "@/types";

export type ChatTemplateContent =
  | { type: "image"; image: string }
  | { type: "text"; text: string };

export type ChatTemplateMessage = {
  role: ChatMessage["role"];
  content: string | ChatTemplateContent[];
};

function normalizeMessageContent(content: string) {
  return content.trim();
}

export function hasTokenizerChatTemplate(tokenizer: { chat_template?: string | null }) {
  return Boolean(tokenizer.chat_template);
}

export function buildChatTemplateMessages(messages: ChatMessage[], supportsImages: boolean): ChatTemplateMessage[] {
  return messages.map((message) => {
    if (!supportsImages) {
      return { role: message.role, content: message.content };
    }

    return {
      role: message.role,
      content: [
        ...(message.images ?? []).map((image) => ({ type: "image" as const, image })),
        { type: "text", text: message.content },
      ],
    };
  });
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
