"use client";

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface ThinkingBlockProps {
  thinking: string;
  isGenerating: boolean;
  isComplete: boolean;
}

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#b4b4b4] border-t-transparent" />
  );
}

export function ThinkingBlock({ thinking, isGenerating, isComplete }: ThinkingBlockProps) {
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [finalSeconds, setFinalSeconds] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track thinking duration
  useEffect(() => {
    if (isGenerating && !isComplete) {
      setSeconds(0);
      setFinalSeconds(null);
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (isComplete && finalSeconds === null) {
        setFinalSeconds(seconds);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isGenerating, isComplete]);

  // Auto-expand while thinking is in progress, collapse once thinking completes
  const isThinkingInProgress = isGenerating && !isComplete;
  const isExpanded = isThinkingInProgress || userExpanded === true;

  if (isThinkingInProgress && userExpanded !== null) {
    setUserExpanded(null);
  }

  useLayoutEffect(() => {
    if (isThinkingInProgress && shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinking, isThinkingInProgress]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
      shouldAutoScroll.current = isAtBottom;
    }
  };

  const displaySeconds = finalSeconds ?? seconds;
  const label = isThinkingInProgress
    ? seconds > 0
      ? `Thinking for ${seconds}s...`
      : "Thinking..."
    : `Thought for ${displaySeconds} second${displaySeconds !== 1 ? "s" : ""}`;

  return (
    <div className="mb-3">
      <button
        onClick={() => !isThinkingInProgress && setUserExpanded(isExpanded ? false : true)}
        className={`flex items-center gap-2 py-1 text-sm transition-colors ${
          isThinkingInProgress ? "cursor-default" : "cursor-pointer hover:text-[#ececec]"
        } ${isThinkingInProgress ? "text-[#b4b4b4]" : "text-[#8e8e8e]"}`}
      >
        {isThinkingInProgress ? <Spinner /> : null}
        <span>{label}</span>
        {!isThinkingInProgress && (
          <ChevronDown
            size={14}
            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {isExpanded && thinking && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={`mt-2 whitespace-pre-wrap border-l-2 border-white/[0.08] pl-3 sm:pl-4 text-sm leading-relaxed text-[#8e8e8e] ${
            isThinkingInProgress ? "max-h-[150px] sm:max-h-[200px] overflow-y-auto" : ""
          }`}
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
        >
          {thinking}
        </div>
      )}
    </div>
  );
}
