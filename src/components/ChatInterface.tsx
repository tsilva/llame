"use client";

import {
  useRef,
  useEffect,
  useState,
  KeyboardEvent,
  DragEvent,
  ChangeEvent,
} from "react";
import { ChatMessage as ChatMessageType } from "@/types";
import { ChatMessage } from "./ChatMessage";
import { Sparkles, ArrowUp, Square, ImagePlus, X } from "lucide-react";

interface ChatInterfaceProps {
  messages: ChatMessageType[];
  isGenerating: boolean;
  isModelLoaded: boolean;
  onSend: (content: string, images?: string[]) => void;
  onStop: () => void;
  tps: number;
  numTokens: number;
  loadedModel: string | null;
  device: string | null;
}

interface PendingImage {
  id: string;
  dataUrl: string;
  file: File;
}

const SUGGESTIONS = [
  "Explain quantum computing in simple terms",
  "Write a haiku about programming",
  "What is the meaning of life?",
  "Help me write a short story",
];

export function ChatInterface({
  messages,
  isGenerating,
  isModelLoaded,
  onSend,
  onStop,
  tps,
  numTokens,
  loadedModel,
  device,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const handleSend = () => {
    const trimmed = input.trim();
    if (
      (!trimmed && pendingImages.length === 0) ||
      isGenerating ||
      !isModelLoaded
    )
      return;

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
      reader.onload = (e) => {
        resolve({
          id: Math.random().toString(36).substring(7),
          dataUrl: e.target?.result as string,
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
            {loadedModel && (
              <p className="mb-8 text-sm text-[#8e8e8e]">
                {loadedModel.split("/").pop()}
              </p>
            )}
            {!loadedModel && (
              <p className="mb-8 text-sm text-[#8e8e8e]">
                Load a model to get started
              </p>
            )}
            {isModelLoaded && (
              <div className="grid max-w-[500px] grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSend(s)}
                    className="rounded-xl border border-white/[0.08] px-4 py-3 text-left text-sm text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {hasMessages && (
          <div className="mx-auto max-w-[768px] space-y-6 px-4 py-6">
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
                    !isGenerating && isLastAssistant
                  }
                  tps={isLastAssistant ? tps : undefined}
                  numTokens={isLastAssistant ? numTokens : undefined}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mx-auto w-full max-w-[768px] px-4 pb-4 pt-2">
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
              disabled={!isModelLoaded}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!isModelLoaded || pendingImages.length >= 5}
              className="mb-0.5 rounded-lg p-1.5 text-[#8e8e8e] hover:text-[#ececec] transition-colors disabled:opacity-40"
              title="Upload images"
            >
              <ImagePlus size={20} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isModelLoaded ? "Message..." : "Load a model first..."
              }
              disabled={!isModelLoaded}
              rows={1}
              className="max-h-[200px] flex-1 resize-none bg-transparent text-sm text-[#ececec] placeholder-[#8e8e8e] outline-none disabled:opacity-40"
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
                disabled={
                  (!input.trim() && pendingImages.length === 0) ||
                  !isModelLoaded
                }
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white transition-colors hover:bg-gray-200 disabled:bg-[#424242] disabled:text-[#8e8e8e]"
              >
                <ArrowUp size={18} className="text-[#212121]" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-xs text-[#8e8e8e]">
          Running locally via {device?.toUpperCase() || "browser"}. Enter to
          send, Shift+Enter for new line.
        </p>
      </div>
    </div>
  );
}
