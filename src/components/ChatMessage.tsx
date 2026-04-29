"use client";

import { useState, useEffect, useRef, type RefObject } from "react";
import {
  ChatMessage as ChatMessageType,
  GenerationStats,
  GenerationStopReason,
} from "@/types";
import { ThinkingBlock } from "./ThinkingBlock";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Check, Pencil, RefreshCw, Sparkles, Trash2, X } from "lucide-react";

const MESSAGE_ACTION_ICON_SIZE = 16;

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  isGenerating?: boolean;
  isComplete?: boolean;
  tps?: number;
  numTokens?: number;
  generationTime?: number;
  stopReason?: GenerationStopReason | null;
  showRaw?: boolean;
  showActions?: boolean;
  showEditAction?: boolean;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onEdit?: (content: string) => void;
}

export function ChatMessage({
  message,
  isStreaming,
  isGenerating,
  isComplete,
  tps,
  numTokens,
  generationTime,
  stopReason,
  showRaw,
  showActions,
  showEditAction,
  onRegenerate,
  onDelete,
  onEdit,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasThinking = message.thinking !== undefined && message.thinking !== null;
  const hasImages = message.images && message.images.length > 0;
  const stats = getDisplayStats(message, tps, numTokens, generationTime, stopReason);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState(message.content);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = editingMessageId === message.id;
  const canSaveEdit = draftContent.trim().length > 0 || Boolean(hasImages);
  const canEditMessage = Boolean(showEditAction && onEdit);

  useEffect(() => {
    if (!isEditing || !editTextareaRef.current) return;

    const textarea = editTextareaRef.current;
    textarea.focus();
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 260)}px`;
  }, [draftContent, isEditing]);

  const startEditing = () => {
    setDraftContent(message.content);
    setEditingMessageId(message.id);
  };

  const cancelEditing = () => {
    setDraftContent(message.content);
    setEditingMessageId(null);
  };

  const saveEditing = () => {
    if (!canSaveEdit) return;
    onEdit?.(draftContent);
    setEditingMessageId(null);
  };

  const editForm = (
    <MessageEditForm
      textareaRef={editTextareaRef}
      value={draftContent}
      onChange={setDraftContent}
      onSave={saveEditing}
      onCancel={cancelEditing}
      canSave={canSaveEdit}
      align={isUser ? "right" : "left"}
    />
  );

  if (showRaw) {
    return (
      <div className="animate-fade-in">
        {isEditing ? (
          editForm
        ) : (
          <RawChatMessage message={message} isComplete={isComplete} isGenerating={isGenerating} stats={stats} />
        )}
        {!isEditing && (showActions || canEditMessage) && (
          <MessageActions
            align={isUser ? "right" : "left"}
            onEdit={canEditMessage ? startEditing : undefined}
            onRegenerate={!isUser && showActions ? onRegenerate : undefined}
            onDelete={showActions ? onDelete : undefined}
          />
        )}
      </div>
    );
  }

  if (isUser) {
    return (
      <>
        <div className="flex justify-end animate-fade-in">
          <div className="max-w-[85%] md:max-w-[70%]">
            {hasImages && (
              <div className="flex gap-2 mb-2 flex-wrap justify-end">
                {message.images!.map((img, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={idx}
                    src={img}
                    alt={`Attachment ${idx + 1}`}
                    onClick={() => setSelectedImage(img)}
                    loading="lazy"
                    decoding="async"
                    width={200}
                    height={150}
                    className="max-w-[160px] max-h-[120px] sm:max-w-[200px] sm:max-h-[150px] object-cover rounded-2xl border border-white/[0.08] cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </div>
            )}
            {isEditing ? (
              editForm
            ) : (
              <div className="rounded-3xl bg-[#2f2f2f] px-5 py-3 text-sm leading-relaxed text-[#ececec] whitespace-pre-wrap break-words">
                {message.content}
              </div>
            )}
            {!isEditing && (showActions || canEditMessage) ? (
              <MessageActions
                align="right"
                onEdit={canEditMessage ? startEditing : undefined}
                onDelete={showActions ? onDelete : undefined}
              />
            ) : null}
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
        {isEditing ? (
          editForm
        ) : (
          <MarkdownRenderer content={message.content} isStreaming={isStreaming} />
        )}

        {/* Generation stats */}
        {isComplete && !isGenerating && stats && <GenerationStatsRow stats={stats} />}

        {!isEditing && (showActions || canEditMessage) && (
          <MessageActions
            onEdit={canEditMessage ? startEditing : undefined}
            onRegenerate={showActions ? onRegenerate : undefined}
            onDelete={showActions ? onDelete : undefined}
          />
        )}
      </div>
    </div>
  );
}

function MessageActions({
  align = "left",
  onEdit,
  onRegenerate,
  onDelete,
}: {
  align?: "left" | "right";
  onEdit?: () => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={`mt-3 flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          className="rounded-lg p-2 text-[#8e8e8e] transition-colors hover:bg-[#2f2f2f] hover:text-[#ececec]"
          aria-label="Regenerate answer"
          title="Regenerate answer"
        >
          <RefreshCw size={MESSAGE_ACTION_ICON_SIZE} />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-2 text-[#8e8e8e] transition-colors hover:bg-[#2f2f2f] hover:text-[#ececec]"
          aria-label="Edit message"
          title="Edit message"
        >
          <Pencil size={MESSAGE_ACTION_ICON_SIZE} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-2 text-[#8e8e8e] transition-colors hover:bg-[#2f2f2f] hover:text-[#ececec]"
          aria-label="Delete message"
          title="Delete message"
        >
          <Trash2 size={MESSAGE_ACTION_ICON_SIZE} />
        </button>
      )}
    </div>
  );
}

function MessageEditForm({
  textareaRef,
  value,
  onChange,
  onSave,
  onCancel,
  canSave,
  align,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSave();
          }
        }}
        rows={1}
        className="w-full resize-none rounded-2xl border border-white/[0.08] bg-[#2f2f2f] px-4 py-3 text-sm leading-6 text-[#ececec] outline-none transition-colors placeholder:text-[#8e8e8e] focus:border-[#10a37f]/50"
        aria-label="Edit message content"
      />
      <div className={`mt-2 flex items-center gap-2 ${align === "right" ? "justify-end" : ""}`}>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#212121] transition-colors hover:bg-gray-200 disabled:bg-[#424242] disabled:text-[#8e8e8e]"
          aria-label="Save edited message"
          title="Save"
        >
          <Check size={16} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#424242] text-[#ececec] transition-colors hover:bg-[#4a4a4a]"
          aria-label="Cancel editing message"
          title="Cancel"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function RawChatMessage({
  message,
  isComplete,
  isGenerating,
  stats,
}: {
  message: ChatMessageType;
  isComplete?: boolean;
  isGenerating?: boolean;
  stats: GenerationStats | null;
}) {
  const isUser = message.role === "user";
  const rawOutputAvailable = typeof message.debug?.rawOutput === "string";
  const modelInputAvailable = typeof message.debug?.modelInput === "string";

  return (
    <div>
      <div className="rounded-2xl border border-white/[0.08] bg-[#171717] p-4">
        <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-[#6f6f6f]">
          {isUser ? "User" : "Assistant generation"}
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
              label="prompt sent to model"
              content={
                modelInputAvailable
                  ? message.debug?.modelInput ?? ""
                  : "Prompt sent to model is unavailable for this older message."
              }
              muted={!modelInputAvailable}
            />
            <div className="mt-3">
              <RawSection
                label="raw generated output"
                content={
                  rawOutputAvailable
                    ? message.debug?.rawOutput ?? ""
                    : "Raw generated output is unavailable for this older message."
                }
                muted={!rawOutputAvailable}
              />
            </div>
            {isComplete && !isGenerating && stats && <GenerationStatsRow stats={stats} raw />}
          </>
        )}
      </div>
    </div>
  );
}

function getDisplayStats(
  message: ChatMessageType,
  tps?: number,
  numTokens?: number,
  generationTime?: number,
  stopReason?: GenerationStopReason | null,
): GenerationStats | null {
  if (message.stats && message.stats.numTokens > 0) {
    return message.stats;
  }

  if (!numTokens || numTokens <= 0) return null;

  return {
    tps: tps ?? 0,
    numTokens,
    generationTime: generationTime ?? 0,
    stopReason: stopReason ?? "unknown",
  };
}

function formatGenerationTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds < 10 ? `${seconds.toFixed(2)}s` : `${seconds.toFixed(1)}s`;
}

function getStopReasonLabel(reason: GenerationStopReason) {
  switch (reason) {
    case "eos_token":
      return "EOS token found";
    case "max_new_tokens":
      return "Max tokens reached";
    case "interrupted":
      return "Interrupted";
    case "stale":
      return "Superseded";
    case "unknown":
      return "Unknown";
  }
}

function GenerationStatsRow({ stats, raw = false }: { stats: GenerationStats; raw?: boolean }) {
  const generationTime = formatGenerationTime(stats.generationTime);
  const textColor = raw ? "text-[#6f6f6f]" : "text-[#8e8e8e]";

  return (
    <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${textColor}`}>
      <span>{stats.numTokens} tokens</span>
      {stats.tps > 0 && <span>{stats.tps.toFixed(1)} tokens/sec</span>}
      {generationTime && <span>Generation time: {generationTime}</span>}
      <span>Stop reason: {getStopReasonLabel(stats.stopReason)}</span>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#212121]/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button onClick={onClose} aria-label="Close image preview" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#2f2f2f] text-white transition-colors hover:bg-[#3f3f3f]">
        <X size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Fullscreen image"
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
