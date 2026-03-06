"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { ChatMessage as ChatMessageType } from "@/types";
import { ChatMessage } from "./ChatMessage";

interface ChatInterfaceProps {
  messages: ChatMessageType[];
  isGenerating: boolean;
  isModelLoaded: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
}

export function ChatInterface({
  messages,
  isGenerating,
  isModelLoaded,
  onSend,
  onStop,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (!trimmed || isGenerating || !isModelLoaded) return;
    setInput("");
    onSend(trimmed);
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
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
        <div className="flex gap-2">
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
              disabled={!input.trim() || !isModelLoaded}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600"
            >
              Send
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-zinc-600">
          Enter to send, Shift+Enter for newline, Escape to stop
        </p>
      </div>
    </div>
  );
}
