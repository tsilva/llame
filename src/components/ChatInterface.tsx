"use client";

import dynamic from "next/dynamic";
import {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  KeyboardEvent,
  DragEvent,
  ChangeEvent,
} from "react";
import { ChatMessage as ChatMessageType, GenerationStopReason, ProgressInfo, TotalProgressInfo } from "@/types";
import { getModelDisplayName } from "@/lib/constants";
import { siteDescription } from "@/lib/siteMetadata";
import { ModelLoadingCard } from "./ModelLoadingCard";
import {
  MAX_PENDING_IMAGES,
  compressImage,
  isAcceptedImageFile,
} from "@/lib/imageUtils";
import { Sparkles, ArrowUp, Square, ImagePlus, X, Brain } from "lucide-react";

interface ChatInterfaceProps {
  conversationId: string | null;
  messages: ChatMessageType[];
  isGenerating: boolean;
  isProcessing: boolean;
  processingMessage: string;
  isModelLoaded: boolean;
  modelId: string;
  isLoading: boolean;
  loadingProgress: Map<string, ProgressInfo>;
  loadingTotalProgress: TotalProgressInfo | null;
  loadingMessage: string;
  onSend: (content: string, images?: string[]) => void | Promise<void>;
  onStop: () => void;
  tps: number;
  numTokens: number;
  generationTime: number;
  stopReason: GenerationStopReason | null;
  device: string | null;
  isMobile: boolean;
  allowImageInputs: boolean;
  thinkingComplete: boolean;
  thinkingEnabled: boolean;
  showThinkingToggle: boolean;
  onToggleThinking: () => void;
  showRawConversation: boolean;
  onRegenerateLastAssistant: () => void;
  onDeleteLastMessage: () => void;
  onEditLastMessage: (content: string) => void;
}

interface PendingImage {
  id: string;
  dataUrl: string;
  file: File;
}

interface Suggestion {
  text: string;
  prompt?: string;
  image?: string;
}

const ChatMessage = dynamic(
  () => import("./ChatMessage").then((mod) => mod.ChatMessage),
);

const BOOK_PAGE_IMAGE_URL = "/book_page.png";

const STATIC_SUGGESTIONS: Suggestion[] = [
  { text: "Explain quantum computing in simple terms" },
  { text: "Code bubble sort in Python" },
  { text: "What is the meaning of life?" },
  {
    text: "Transcribe image to plain text",
    prompt: "Extract all visible text from this image as plain text only. Preserve line breaks and paragraphs when possible. Do not add commentary, HTML, markdown, or code fences.",
    image: BOOK_PAGE_IMAGE_URL,
  },
];

export function ChatInterface({
  conversationId,
  messages,
  isGenerating,
  isProcessing,
  processingMessage,
  isModelLoaded,
  modelId,
  isLoading,
  loadingProgress,
  loadingTotalProgress,
  loadingMessage,
  onSend,
  onStop,
  tps,
  numTokens,
  generationTime,
  stopReason,
  device,
  isMobile,
  allowImageInputs,
  thinkingComplete,
  thinkingEnabled,
  showThinkingToggle,
  onToggleThinking,
  showRawConversation,
  onRegenerateLastAssistant,
  onDeleteLastMessage,
  onEditLastMessage,
}: ChatInterfaceProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousMessageCountRef = useRef(messages.length);
  const previousConversationIdRef = useRef<string | null>(conversationId);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [imageSuggestions, setImageSuggestions] = useState<Suggestion[]>(STATIC_SUGGESTIONS);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const conversationChanged = conversationId !== previousConversationIdRef.current;
    const messageCountChanged = messages.length !== previousMessageCountRef.current;

    if (conversationChanged || messageCountChanged) {
      shouldAutoScrollRef.current = true;
    }

    if (shouldAutoScrollRef.current) {
      container.scrollTop = container.scrollHeight;
    }

    previousConversationIdRef.current = conversationId;
    previousMessageCountRef.current = messages.length;
  }, [conversationId, messages, isLoading, isProcessing]);

  useEffect(() => {
    if (!isGenerating && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isGenerating]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  // Load book_page.png as data URL for Web Worker compatibility
  useEffect(() => {
    const loadBookPageImage = async () => {
      try {
        const response = await fetch(BOOK_PAGE_IMAGE_URL);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = await compressImage(reader.result as string);
          setImageSuggestions((prev) =>
            prev.map((s) =>
              s.text === "Transcribe image to plain text" ? { ...s, image: dataUrl } : s
            )
          );
        };
        reader.readAsDataURL(blob);
      } catch {
        // Keep the original src if fetch fails
      }
    };
    loadBookPageImage();
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if ((!trimmed && activePendingImages.length === 0) || isGenerating) return;

    const imageDataUrls = activePendingImages.map((img) => img.dataUrl);

    setInput("");
    setPendingImages([]);
    onSend(trimmed, imageDataUrls.length > 0 ? imageDataUrls : undefined);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && isGenerating) {
      onStop();
    }
  };

  const processFile = async (file: File): Promise<PendingImage | null> => {
    if (!isAcceptedImageFile(file)) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawDataUrl = e.target?.result as string;
        const dataUrl = await compressImage(rawDataUrl);
        if (!dataUrl) {
          resolve(null);
          return;
        }
        resolve({
          id: Math.random().toString(36).substring(7),
          dataUrl,
          file,
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!allowImageInputs) {
      e.target.value = "";
      return;
    }
    const files = Array.from(e.target.files || []);
    const newImages = await Promise.all(files.map(processFile));
    setPendingImages((prev) =>
      [...prev, ...(newImages.filter(Boolean) as PendingImage[])].slice(0, MAX_PENDING_IMAGES)
    );
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!allowImageInputs) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!allowImageInputs) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!allowImageInputs) return;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const newImages = await Promise.all(files.map(processFile));
    setPendingImages((prev) =>
      [...prev, ...(newImages.filter(Boolean) as PendingImage[])].slice(0, MAX_PENDING_IMAGES)
    );
  };

  const removeImage = (id: string) => {
    setPendingImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleMessagesScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 48;
  };

  const hasMessages = messages.length > 0;
  const modelName = getModelDisplayName(modelId) || "Unknown model";
  const needsLoad = !isModelLoaded;
  const activePendingImages = allowImageInputs ? pendingImages : [];
  const suggestions = allowImageInputs
    ? imageSuggestions
    : imageSuggestions.filter((suggestion) => !suggestion.image);

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {allowImageInputs && isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-[#10a37f] bg-[#10a37f]/10 pointer-events-none">
          <p className="text-[#10a37f] text-lg font-medium" role="status" aria-live="polite">
            Drop images here
          </p>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        {!hasMessages && (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#10a37f]">
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className="mb-3 max-w-[700px] text-center text-2xl font-semibold text-[#ececec] md:text-3xl">
              Run private AI models in one tab
            </h1>
            <p className="max-w-[640px] text-center text-sm leading-6 text-[#b4b4b4] md:text-base">
              {siteDescription}
            </p>
            {modelName && (
              <p className="mb-8 mt-3 text-sm text-[#8e8e8e]">
                Ready to start with {modelName}
              </p>
            )}
            <div className="grid max-w-[500px] grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestions.map((s: Suggestion) => (
                <button
                  key={s.text}
                  onClick={() => onSend(s.prompt ?? s.text, s.image ? [s.image] : undefined)}
                  disabled={isGenerating}
                  className="rounded-xl border border-white/[0.08] px-4 py-3 text-left text-sm text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasMessages && (
          <div className="mx-auto max-w-[768px] space-y-6 px-3 py-4 md:px-4 md:py-6">
            {messages.map((msg, i) => {
              const isLastMessage = i === messages.length - 1;
              const isLastAssistant =
                msg.role === "assistant" && isLastMessage;
              const canActOnLastMessage =
                isLastMessage && !isGenerating && !isLoading && !isProcessing;
              return (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isStreaming={isGenerating && isLastAssistant}
                  isGenerating={isGenerating && i === messages.length - 1}
                  isComplete={
                    isLastAssistant && (!isGenerating || thinkingComplete)
                  }
                  tps={isLastAssistant ? tps : undefined}
                  numTokens={isLastAssistant ? numTokens : undefined}
                  generationTime={isLastAssistant ? generationTime : undefined}
                  stopReason={isLastAssistant ? stopReason : undefined}
                  showRaw={showRawConversation}
                  showActions={canActOnLastMessage}
                  showEditAction={canActOnLastMessage}
                  onRegenerate={onRegenerateLastAssistant}
                  onDelete={onDeleteLastMessage}
                  onEdit={onEditLastMessage}
                />
              );
            })}
            {/* Model loading card - shown inline when loading */}
            {isLoading && (
              <ModelLoadingCard
                progress={loadingProgress}
                totalProgress={loadingTotalProgress}
                message={loadingMessage}
                modelName={modelName}
              />
            )}
            {/* Processing indicator - shown when processing images */}
            {isProcessing && (
              <div className="flex gap-3 animate-fade-in">
                <div className="mt-1 flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#10a37f]">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="flex items-center gap-2 py-3 text-sm text-[#b4b4b4]" role="status" aria-live="polite">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#b4b4b4] border-t-transparent" />
                  <span>{processingMessage}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mx-auto w-full max-w-[768px] px-3 pb-3 pt-2 md:px-4 md:pb-4">
        <div className="rounded-3xl border border-white/[0.08] bg-[#2f2f2f] px-4 py-3">
          {/* Image previews inside pill */}
          {activePendingImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {activePendingImages.map((img) => (
                <div key={img.id} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.dataUrl}
                    alt="Preview"
                    width={64}
                    height={64}
                    loading="lazy"
                    decoding="async"
                    className="h-16 w-16 rounded-xl border border-white/[0.08] object-cover"
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    aria-label="Remove image"
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#424242] text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              multiple
              className="hidden"
              disabled={!allowImageInputs || needsLoad}
            />

            {allowImageInputs && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={needsLoad || activePendingImages.length >= MAX_PENDING_IMAGES || isGenerating}
                className="mb-0.5 rounded-lg p-1.5 text-[#8e8e8e] hover:text-[#ececec] transition-colors disabled:opacity-40"
                title={needsLoad ? "Load model first to use images" : "Upload images"}
                aria-label="Upload images"
              >
                <ImagePlus size={20} />
              </button>
            )}

            {showThinkingToggle && (
              <button
                onClick={onToggleThinking}
                disabled={isGenerating}
                className={`mb-0.5 rounded-lg p-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  thinkingEnabled ? "text-[#10a37f] hover:text-[#10a37f]" : "text-[#8e8e8e] hover:text-[#ececec]"
                }`}
                title={thinkingEnabled ? "Thinking mode on" : "Thinking mode off"}
                aria-label={thinkingEnabled ? "Disable thinking mode" : "Enable thinking mode"}
              >
                <Brain size={20} />
              </button>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                needsLoad
                  ? `Message (will load ${modelName}...)...`
                  : "Message..."
              }
              rows={1}
              className="max-h-[200px] flex-1 resize-none self-center bg-transparent text-sm text-[#ececec] placeholder-[#8e8e8e] outline-none"
            />

            {isGenerating ? (
              <button
                onClick={onStop}
                aria-label="Stop generation"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white transition-colors hover:bg-gray-200"
              >
                <Square size={14} className="text-[#212121]" fill="#212121" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() && activePendingImages.length === 0}
                aria-label="Send message"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white transition-colors hover:bg-gray-200 disabled:bg-[#424242] disabled:text-[#8e8e8e]"
              >
                <ArrowUp size={18} className="text-[#212121]" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-xs text-[#8e8e8e]">
          {isLoading
            ? `Loading ${modelName}...`
            : needsLoad
              ? `First message will load ${modelName}`
              : isMobile
                ? `Running locally via ${device?.toUpperCase() || "browser"}.`
                : `Running locally via ${device?.toUpperCase() || "browser"}. Enter to send, Shift+Enter for new line.`}
        </p>
      </div>
    </div>
  );
}
