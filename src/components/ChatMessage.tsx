"use client";

import { ChatMessage as ChatMessageType } from "@/types";
import { ThinkingBlock } from "./ThinkingBlock";
import { Sparkles } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  isGenerating?: boolean;
  isComplete?: boolean;
  tps?: number;
  numTokens?: number;
}

export function ChatMessage({
  message,
  isStreaming,
  isGenerating,
  isComplete,
  tps,
  numTokens,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasThinking = message.thinking !== undefined && message.thinking !== null;
  const hasImages = message.images && message.images.length > 0;

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[70%]">
          {hasImages && (
            <div className="flex gap-2 mb-2 flex-wrap justify-end">
              {message.images!.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Attachment ${idx + 1}`}
                  className="max-w-[200px] max-h-[150px] object-cover rounded-2xl border border-white/[0.08]"
                />
              ))}
            </div>
          )}
          <div className="rounded-3xl bg-[#2f2f2f] px-5 py-3 text-sm leading-relaxed text-[#ececec] whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3 animate-fade-in">
      {/* Avatar */}
      <div className="mt-1 flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#10a37f]">
        <Sparkles size={14} className="text-white" />
      </div>

      <div className="min-w-0 flex-1">
        {/* Thinking block */}
        {hasThinking && (
          <ThinkingBlock
            thinking={message.thinking || ""}
            isGenerating={isGenerating || false}
            isComplete={isComplete || false}
          />
        )}

        {/* Content */}
        <div className="text-sm leading-7 text-[#ececec] whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-[3px] h-[18px] ml-0.5 -mb-1 bg-white animate-pulse rounded-sm" />
          )}
        </div>

        {/* Generation stats */}
        {isComplete && !isGenerating && numTokens && numTokens > 0 && (
          <div className="mt-2 text-xs text-[#8e8e8e]">
            {numTokens} tokens{tps && tps > 0 ? ` · ${tps.toFixed(1)} tokens/sec` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
