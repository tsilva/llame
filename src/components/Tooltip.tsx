"use client";

import type { ReactNode } from "react";

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}

export function Tooltip({
  label,
  children,
  side = "top",
  align = "center",
}: TooltipProps) {
  const sideClass =
    side === "bottom"
      ? "top-full mt-2"
      : "bottom-full mb-2";
  const alignClass =
    align === "start"
      ? "left-0"
      : align === "end"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${sideClass} ${alignClass} z-50 max-w-56 whitespace-nowrap rounded-md border border-white/[0.08] bg-[#171717] px-2 py-1 text-xs font-medium text-[#ececec] opacity-0 shadow-xl shadow-black/30 transition-opacity delay-300 duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}
