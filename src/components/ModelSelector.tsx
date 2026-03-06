"use client";

import { useState, useEffect, useRef } from "react";
import { MODEL_PRESETS } from "@/lib/constants";
import { ChevronDown, Check, Circle } from "lucide-react";

interface ModelSelectorProps {
  selectedModel: string;
  loadedModel: string | null;
  isLoading: boolean;
  disabled: boolean;
  onSelect: (modelId: string) => void;
  onLoad: (modelId: string) => void;
}

export function ModelSelector({
  selectedModel,
  loadedModel,
  isLoading,
  disabled,
  onSelect,
  onLoad,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayName = selectedModel
    ? selectedModel.split("/").pop()
    : "Select model";

  const isModelReady = loadedModel === selectedModel && !isLoading;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[#ececec] hover:bg-[#2f2f2f] transition-colors"
      >
        {/* Status indicator */}
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isLoading
              ? "bg-amber-400 animate-pulse"
              : isModelReady
                ? "bg-[#10a37f]"
                : "bg-[#8e8e8e]"
          }`}
        />
        <span className="max-w-[140px] sm:max-w-[200px] truncate">
          {isLoading ? "Loading..." : displayName}
        </span>
        <ChevronDown
          size={14}
          className={`text-[#8e8e8e] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-white/[0.08] bg-[#2f2f2f] py-1 shadow-xl z-50">
          {MODEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                onSelect(preset.id);
                setOpen(false);
              }}
              disabled={isLoading || disabled}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#ececec] hover:bg-[#424242] transition-colors disabled:opacity-40"
            >
              <span className="w-4 flex-shrink-0 flex justify-center">
                {loadedModel === preset.id ? (
                  <Check size={14} className="text-[#10a37f]" />
                ) : selectedModel === preset.id ? (
                  <Circle size={14} className="text-[#8e8e8e]" />
                ) : null}
              </span>
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
