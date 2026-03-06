"use client";

import { ChatMessage as ChatMessageType } from "@/types";
import { ThinkingBlock } from "./ThinkingBlock";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  isGenerating?: boolean;
  isComplete?: boolean;
}

export function ChatMessage({ message, isStreaming, isGenerating, isComplete }: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasThinking = message.thinking !== undefined && message.thinking !== null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-[#1e1e1e] text-zinc-200 border border-white/5"
        }`}
      >
        {/* Thinking block for assistant messages */}
        {!isUser && hasThinking && (
          <ThinkingBlock
            thinking={message.thinking || ""}
            isGenerating={isGenerating || false}
            isComplete={isComplete || false}
          />
        )}
        
        {/* Main content */}
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 -mb-0.5 bg-zinc-400 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
