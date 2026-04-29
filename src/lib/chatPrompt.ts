import { ChatMessage, ModelInteractionMode } from "@/types";

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

export interface TextPromptTokenizer {
  chat_template?: string | null;
  apply_chat_template?: (messages: ChatTemplateMessage[], options: {
    tokenize: false;
    add_generation_prompt: true;
    enable_thinking?: boolean;
  }) => string;
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

export function buildCompletionPrompt(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;

    const content = normalizeMessageContent(message.content);
    if (content) return content;
  }

  return "";
}

export function buildTextOnlyModelPrompt(
  messages: ChatMessage[],
  tokenizer: TextPromptTokenizer,
  interactionMode: ModelInteractionMode,
  options: {
    enableThinking?: boolean;
    supportsThinking?: boolean;
  } = {},
) {
  if (hasTokenizerChatTemplate(tokenizer) && tokenizer.apply_chat_template) {
    return tokenizer.apply_chat_template(
      buildChatTemplateMessages(messages, false),
      {
        tokenize: false,
        add_generation_prompt: true,
        ...(options.supportsThinking ? { enable_thinking: Boolean(options.enableThinking) } : {}),
      },
    );
  }

  if (interactionMode === "completion") {
    return buildCompletionPrompt(messages);
  }

  return buildFallbackTextPrompt(messages);
}
