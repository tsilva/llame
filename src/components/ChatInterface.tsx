"use client";

import {
  useRef,
  useEffect,
  useState,
  KeyboardEvent,
  DragEvent,
  ChangeEvent,
} from "react";
import { ChatMessage as ChatMessageType, ProgressInfo } from "@/types";
import { ChatMessage } from "./ChatMessage";
import { ModelLoadingCard } from "./ModelLoadingCard";
import { compressImage } from "@/lib/imageUtils";
import { Sparkles, ArrowUp, Square, ImagePlus, X, Brain } from "lucide-react";

interface ChatInterfaceProps {
  messages: ChatMessageType[];
  isGenerating: boolean;
  isProcessing: boolean;
  processingMessage: string;
  isModelLoaded: boolean;
  loadedModel: string | null;
  isLoading: boolean;
  loadingProgress: Map<string, ProgressInfo>;
  loadingMessage: string;
  onSend: (content: string, images?: string[]) => void;
  onStop: () => void;
  tps: number;
  numTokens: number;
  device: string | null;
  isMobile: boolean;
  thinkingComplete: boolean;
  thinkingEnabled: boolean;
  onToggleThinking: () => void;
}

interface PendingImage {
  id: string;
  dataUrl: string;
  file: File;
}

import bookPageImage from "../../assets/book_page.png";

interface Suggestion {
  text: string;
  image?: string;
}

const STATIC_SUGGESTIONS: Suggestion[] = [
  { text: "Explain quantum computing in simple terms" },
  { text: "Code bubble sort in Python" },
  { text: "What is the meaning of life?" },
  { text: "Transcribe this book page", image: bookPageImage.src },
];

export function ChatInterface({
  messages,
  isGenerating,
  isProcessing,
  processingMessage,
  isModelLoaded,
  loadedModel,
  isLoading,
  loadingProgress,
  loadingMessage,
  onSend,
  onStop,
  tps,
  numTokens,
  device,
  isMobile,
  thinkingComplete,
  thinkingEnabled,
  onToggleThinking,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(STATIC_SUGGESTIONS);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement?.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages]);

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

  // Clear input when conversation changes (new conversation or switch)
  useEffect(() => {
    if (messages.length === 0) {
      setInput("");
      setPendingImages([]);
    }
  }, [messages]);

  // Load book_page.png as data URL for Web Worker compatibility
  useEffect(() => {
    const loadBookPageImage = async () => {
      try {
        const response = await fetch(bookPageImage.src);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setSuggestions((prev) =>
            prev.map((s) =>
              s.text === "Transcribe this book page" ? { ...s, image: dataUrl } : s
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
    if ((!trimmed && pendingImages.length === 0) || isGenerating) return;

    const imageDataUrls = pendingImages.map((img) => img.dataUrl);

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
    if (!file.type.startsWith("image/")) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawDataUrl = e.target?.result as string;
        const dataUrl = await compressImage(rawDataUrl);
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
    const files = Array.from(e.target.files || []);
    const newImages = await Promise.all(files.map(processFile));
    setPendingImages((prev) =>
      [...prev, ...(newImages.filter(Boolean) as PendingImage[])].slice(0, 5)
    );
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const newImages = await Promise.all(files.map(processFile));
    setPendingImages((prev) =>
      [...prev, ...(newImages.filter(Boolean) as PendingImage[])].slice(0, 5)
    );
  };

  const removeImage = (id: string) => {
    setPendingImages((prev) => prev.filter((img) => img.id !== id));
  };

  const hasMessages = messages.length > 0;
  const modelName = "Qwen3.5 0.8B";
  const needsLoad = !isModelLoaded;

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-[#10a37f] bg-[#10a37f]/10 pointer-events-none">
          <p className="text-[#10a37f] text-lg font-medium">
            Drop images here
          </p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!hasMessages && (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#10a37f]">
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className="mb-2 text-2xl font-semibold text-[#ececec]">
              How can I help you today?
            </h1>
            {modelName && (
              <p className="mb-8 text-sm text-[#8e8e8e]">
                Using {modelName}
              </p>
            )}
            <div className="grid max-w-[500px] grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestions.map((s: Suggestion) => (
                <button
                  key={s.text}
                  onClick={() => onSend(s.text, s.image ? [s.image] : undefined)}
                  className="rounded-xl border border-white/[0.08] px-4 py-3 text-left text-sm text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors"
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
              const isLastAssistant =
                msg.role === "assistant" && i === messages.length - 1;
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
                />
              );
            })}
            {/* Model loading card - shown inline when loading */}
            {isLoading && (
              <ModelLoadingCard
                progress={loadingProgress}
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
                <div className="flex items-center gap-2 py-3 text-sm text-[#b4b4b4]">
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
          {pendingImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingImages.map((img) => (
                <div key={img.id} className="group relative">
                  <img
                    src={img.dataUrl}
                    alt="Preview"
                    className="h-16 w-16 rounded-xl border border-white/[0.08] object-cover"
                  />
                  <button
                    onClick={() => removeImage(img.id)}
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
              disabled={needsLoad}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={needsLoad || pendingImages.length >= 5}
              className="mb-0.5 rounded-lg p-1.5 text-[#8e8e8e] hover:text-[#ececec] transition-colors disabled:opacity-40"
              title={needsLoad ? "Load model first to use images" : "Upload images"}
            >
              <ImagePlus size={20} />
            </button>

            <button
              onClick={onToggleThinking}
              className={`mb-0.5 rounded-lg p-1.5 transition-colors ${
                thinkingEnabled ? "text-[#10a37f] hover:text-[#10a37f]" : "text-[#8e8e8e] hover:text-[#ececec]"
              }`}
              title={thinkingEnabled ? "Thinking mode on" : "Thinking mode off"}
            >
              <Brain size={20} />
            </button>

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
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white transition-colors hover:bg-gray-200"
              >
                <Square size={14} className="text-[#212121]" fill="#212121" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() && pendingImages.length === 0}
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
