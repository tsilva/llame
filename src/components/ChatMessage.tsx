"use client";

import { useState, useEffect } from "react";
import { ChatMessage as ChatMessageType } from "@/types";
import { ThinkingBlock } from "./ThinkingBlock";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Sparkles, X } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  isGenerating?: boolean;
  isComplete?: boolean;
  tps?: number;
  numTokens?: number;
  showRaw?: boolean;
}

export function ChatMessage({
  message,
  isStreaming,
  isGenerating,
  isComplete,
  tps,
  numTokens,
  showRaw,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasThinking = message.thinking !== undefined && message.thinking !== null;
  const hasImages = message.images && message.images.length > 0;
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (showRaw) {
    return <RawChatMessage message={message} isComplete={isComplete} isGenerating={isGenerating} tps={tps} numTokens={numTokens} />;
  }

  if (isUser) {
    return (
      <>
        <div className="flex justify-end animate-fade-in">
          <div className="max-w-[85%] md:max-w-[70%]">
            {hasImages && (
              <div className="flex gap-2 mb-2 flex-wrap justify-end">
                {message.images!.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Attachment ${idx + 1}`}
                    onClick={() => setSelectedImage(img)}
                    className="max-w-[160px] max-h-[120px] sm:max-w-[200px] sm:max-h-[150px] object-cover rounded-2xl border border-white/[0.08] cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </div>
            )}
            <div className="rounded-3xl bg-[#2f2f2f] px-5 py-3 text-sm leading-relaxed text-[#ececec] whitespace-pre-wrap break-words">
              {message.content}
            </div>
          </div>
        </div>
        {selectedImage && (
          <ImageLightboxInline
            src={selectedImage}
            onClose={() => setSelectedImage(null)}
          />
        )}
      </>
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
            isStreaming={isStreaming}
          />
        )}

        {/* Content */}
        <MarkdownRenderer content={message.content} isStreaming={isStreaming} />

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

function RawChatMessage({
  message,
  isComplete,
  isGenerating,
  tps,
  numTokens,
}: {
  message: ChatMessageType;
  isComplete?: boolean;
  isGenerating?: boolean;
  tps?: number;
  numTokens?: number;
}) {
  const isUser = message.role === "user";
  const rawOutputAvailable = typeof message.debug?.rawOutput === "string";
  const modelInputAvailable = typeof message.debug?.modelInput === "string";

  return (
    <div className="animate-fade-in">
      <div className="rounded-2xl border border-white/[0.08] bg-[#171717] p-4">
        <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-[#6f6f6f]">
          {isUser ? "User" : "Assistant"}
        </div>

        {isUser ? (
          <>
            <RawSection label="message" content={message.content || "(empty)"} />
            {message.images && message.images.length > 0 && (
              <details className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.18em] text-[#8e8e8e]">
                  image payloads ({message.images.length})
                </summary>
                <div className="mt-3 space-y-3">
                  {message.images.map((image, index) => (
                    <RawSection key={index} label={`image ${index + 1}`} content={image} />
                  ))}
                </div>
              </details>
            )}
          </>
        ) : (
          <>
            <RawSection
              label="model input"
              content={
                modelInputAvailable
                  ? (message.debug?.modelInput ?? "")
                  : "Raw model input is unavailable for this older message."
              }
              muted={!modelInputAvailable}
            />
            <div className="mt-3">
              <RawSection
                label="model output"
                content={
                  rawOutputAvailable
                    ? (message.debug?.rawOutput ?? "")
                    : "Raw model output is unavailable for this older message."
                }
                muted={!rawOutputAvailable}
              />
            </div>
            {isComplete && !isGenerating && numTokens && numTokens > 0 && (
              <div className="mt-3 text-xs text-[#6f6f6f]">
                {numTokens} tokens{tps && tps > 0 ? ` · ${tps.toFixed(1)} tokens/sec` : ""}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RawSection({
  label,
  content,
  muted,
}: {
  label: string;
  content: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#6f6f6f]">
        {label}
      </div>
      <pre
        className={`overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.06] px-3 py-2 font-mono text-xs leading-6 ${
          muted ? "bg-black/10 text-[#7c7c7c]" : "bg-black/20 text-[#d6d6d6]"
        }`}
      >
        {content}
      </pre>
    </div>
  );
}

function ImageLightboxInline({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#212121]/90 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button onClick={onClose} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#2f2f2f] text-white transition-colors hover:bg-[#3f3f3f]">
        <X size={20} />
      </button>
      <img src={src} alt="Fullscreen image" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
