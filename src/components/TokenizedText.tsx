"use client";

import { TokenizedToken } from "@/types";

const TOKEN_COLORS = [
  "bg-[#10a37f]/18 text-[#b8f3df]",
  "bg-[#4f8cff]/18 text-[#c7dcff]",
  "bg-[#f0ad4e]/18 text-[#ffe0ad]",
  "bg-[#d45cff]/16 text-[#efc4ff]",
  "bg-[#ff5c8a]/16 text-[#ffc2d2]",
  "bg-[#55d6be]/16 text-[#c5fff4]",
];

interface TokenizedTextProps {
  text: string;
  tokens?: TokenizedToken[];
  className?: string;
  tokenClassName?: string;
}

export function TokenizedText({
  text,
  tokens,
  className,
  tokenClassName,
}: TokenizedTextProps) {
  const hasTokens = tokens && tokens.length > 0;

  return (
    <span
      className={`whitespace-pre-wrap break-words ${className ?? ""}`}
      {...(hasTokens ? { "aria-label": text } : {})}
    >
      {hasTokens ? (
        tokens.map((token) => (
          <span
            key={`${token.index}-${token.id}`}
            aria-hidden="true"
            className={`rounded-[3px] box-decoration-clone px-[1px] ${TOKEN_COLORS[token.index % TOKEN_COLORS.length]} ${tokenClassName ?? ""}`}
          >
            {token.text}
          </span>
        ))
      ) : (
        text
      )}
    </span>
  );
}
