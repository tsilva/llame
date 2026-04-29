"use client";

import {
  KeyboardEvent,
  RefObject,
  UIEvent,
} from "react";
import { TokenizedToken } from "@/types";
import { TokenizedText } from "./TokenizedText";

interface TokenizedTextareaProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  tokens?: TokenizedToken[];
  enabled: boolean;
}

export function TokenizedTextarea({
  textareaRef,
  value,
  onChange,
  onKeyDown,
  placeholder,
  tokens,
  enabled,
}: TokenizedTextareaProps) {
  const showOverlay = enabled && value.length > 0;

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const overlay = event.currentTarget.previousElementSibling;
    if (overlay instanceof HTMLElement) {
      overlay.scrollTop = event.currentTarget.scrollTop;
      overlay.scrollLeft = event.currentTarget.scrollLeft;
    }
  };

  return (
    <div className="relative flex-1 self-center">
      {showOverlay && (
        <div
          className="pointer-events-none absolute inset-0 max-h-[200px] overflow-hidden text-sm leading-normal text-[#ececec]"
          aria-hidden="true"
        >
          <TokenizedText text={value} tokens={tokens} />
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        placeholder={placeholder}
        rows={1}
        className={`max-h-[200px] w-full resize-none bg-transparent text-sm outline-none placeholder-[#8e8e8e] ${
          showOverlay ? "text-transparent caret-[#ececec]" : "text-[#ececec]"
        }`}
      />
    </div>
  );
}
