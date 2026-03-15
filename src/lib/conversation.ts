import { ChatMessage, Conversation } from "@/types";

function isEmptyAssistantMessage(message: ChatMessage | undefined) {
  if (!message || message.role !== "assistant") return false;

  const hasContent = message.content.trim().length > 0;
  const hasThinking = (message.thinking?.trim().length ?? 0) > 0;

  return !hasContent && !hasThinking;
}

export function removeEmptyTrailingAssistantMessage(conversation: Conversation): Conversation {
  if (!isEmptyAssistantMessage(conversation.messages.at(-1))) {
    return conversation;
  }

  return {
    ...conversation,
    messages: conversation.messages.slice(0, -1),
    updatedAt: Date.now(),
  };
}
