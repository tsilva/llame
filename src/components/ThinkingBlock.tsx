"use client";

import { useState, useRef, useLayoutEffect } from "react";

interface ThinkingBlockProps {
  thinking: string;
  isGenerating: boolean;
  isComplete: boolean;
}

// Brain icon SVG
function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

// Chevron icon SVG
function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Pulse animation for the thinking indicator
function ThinkingIndicator() {
  return (
    <span className="flex items-center gap-1 ml-2">
      <span className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

export function ThinkingBlock({ thinking, isGenerating, isComplete }: ThinkingBlockProps) {
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // During generation, always show expanded
  const isExpanded = isGenerating || userExpanded !== false;

  // Reset user preference when generation starts
  if (isGenerating && userExpanded !== null) {
    setUserExpanded(null);
  }

  // Auto-scroll to bottom when new thinking content arrives during generation
  useLayoutEffect(() => {
    if (isGenerating && shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinking, isGenerating]);

  // Handle manual scroll - stop auto-scroll if user scrolls up
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
      shouldAutoScroll.current = isAtBottom;
    }
  };

  // When complete and has thinking content, collapse by default
  if (isComplete && !isExpanded) {
    return (
      <button
        onClick={() => setUserExpanded(true)}
        className="flex items-center gap-2 w-full py-2 px-3 mb-3 text-left rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors group"
      >
        <BrainIcon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400" />
        <span className="text-sm text-zinc-400 group-hover:text-zinc-300">Thought process</span>
        <ChevronIcon className="w-4 h-4 ml-auto text-zinc-500" expanded={false} />
      </button>
    );
  }

  return (
    <div className="mb-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => !isGenerating && setUserExpanded(!isExpanded)}
        className={`flex items-center gap-2 w-full py-2 px-3 text-left transition-colors ${
          isGenerating ? "cursor-default" : "hover:bg-zinc-800/50 cursor-pointer"
        }`}
      >
        <BrainIcon className={`w-4 h-4 ${isGenerating ? "text-amber-500" : "text-zinc-500"}`} />
        <span className={`text-sm font-medium ${isGenerating ? "text-amber-500" : "text-zinc-400"}`}>
          {isGenerating ? "Thinking" : "Thought process"}
        </span>
        {isGenerating && <ThinkingIndicator />}
        {!isGenerating && (
          <ChevronIcon className="w-4 h-4 ml-auto text-zinc-500" expanded={isExpanded} />
        )}
      </button>

      {/* Thinking content - scrollable during generation */}
      {isExpanded && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={`px-3 pb-3 overflow-y-auto font-mono text-sm text-zinc-500 leading-relaxed ${
            isGenerating ? "max-h-[200px]" : ""
          }`}
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
        >
          {thinking || (isGenerating ? "" : "No thinking content available")}
        </div>
      )}

      {/* Divider during generation */}
      {isGenerating && (
        <div className="mx-3 mb-3 pt-2 border-t border-dashed border-zinc-700/50">
          <span className="text-xs text-zinc-600">Response</span>
        </div>
      )}
    </div>
  );
}
