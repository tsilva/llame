"use client";

import { useRef, useEffect, useState, KeyboardEvent, DragEvent, ChangeEvent } from "react";
import { ChatMessage as ChatMessageType } from "@/types";
import { ChatMessage } from "./ChatMessage";
import { ImagePlus, X } from "lucide-react";

interface ChatInterfaceProps {
  messages: ChatMessageType[];
  isGenerating: boolean;
  isModelLoaded: boolean;
  onSend: (content: string, images?: string[]) => void;
  onStop: () => void;
}

interface PendingImage {
  id: string;
  dataUrl: string;
  file: File;
}

export function ChatInterface({
  messages,
  isGenerating,
  isModelLoaded,
  onSend,
  onStop,
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

  const handleSend = () => {
    const trimmed = input.trim();
    if ((!trimmed && pendingImages.length === 0) || isGenerating || !isModelLoaded) return;
    
    // Extract image data URLs
    const imageDataUrls = pendingImages.map(img => img.dataUrl);
    
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
    setPendingImages((prev) => [...prev, ...newImages.filter(Boolean) as PendingImage[]].slice(0, 5));
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
    setPendingImages((prev) => [...prev, ...newImages.filter(Boolean) as PendingImage[]].slice(0, 5));
  };

  const removeImage = (id: string) => {
    setPendingImages((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <div 
      className="flex flex-1 flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-500 border-dashed z-50 flex items-center justify-center pointer-events-none">
          <p className="text-blue-200 text-lg font-medium">Drop images here</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-zinc-600 text-sm">
              {isModelLoaded
                ? "Send a message to start chatting"
                : "Load a model to get started"}
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isStreaming={
              isGenerating &&
              msg.role === "assistant" &&
              i === messages.length - 1
            }
            isGenerating={isGenerating && i === messages.length - 1}
            isComplete={!isGenerating && i === messages.length - 1 && msg.role === "assistant"}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/10 bg-[#111] p-4">
        {/* Image previews */}
        {pendingImages.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {pendingImages.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.dataUrl}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-white/10"
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
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
            className="rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-3 text-zinc-400 transition-colors hover:bg-[#252525] hover:text-zinc-200 disabled:opacity-40"
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
              isModelLoaded ? "Type a message..." : "Load a model first..."
            }
            disabled={!isModelLoaded}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-blue-500/50 transition-colors disabled:opacity-40"
          />
          {isGenerating ? (
            <button
              onClick={onStop}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-red-500"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={(!input.trim() && pendingImages.length === 0) || !isModelLoaded}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600"
            >
              Send
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-zinc-600">
          Enter to send, Shift+Enter for newline, Escape to stop, Drag & drop or click image icon to upload
        </p>
      </div>
    </div>
  );
}
