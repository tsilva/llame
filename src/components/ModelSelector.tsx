"use client";

import { useState, useEffect, useRef } from "react";
import { MODEL_PRESETS, DEFAULT_MODEL } from "@/lib/constants";
import { ChevronDown, Check } from "lucide-react";

interface ModelSelectorProps {
  onLoad: (modelId: string) => void;
  loadedModel: string | null;
  isLoading: boolean;
  disabled: boolean;
}

export function ModelSelector({
  onLoad,
  loadedModel,
  isLoading,
  disabled,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customId, setCustomId] = useState("");
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

  const displayName = loadedModel
    ? loadedModel.split("/").pop()
    : "Select model";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[#ececec] hover:bg-[#2f2f2f] transition-colors"
      >
        <span className="max-w-[200px] truncate">
          {isLoading ? "Loading..." : displayName}
        </span>
        <ChevronDown
          size={14}
          className={`text-[#8e8e8e] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 rounded-xl border border-white/[0.08] bg-[#2f2f2f] py-1 shadow-xl z-50">
          {MODEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                onLoad(preset.id);
                setOpen(false);
              }}
              disabled={isLoading || disabled}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#ececec] hover:bg-[#424242] transition-colors disabled:opacity-40"
            >
              <span className="w-4 flex-shrink-0">
                {loadedModel === preset.id && (
                  <Check size={14} className="text-[#10a37f]" />
                )}
              </span>
              {preset.label}
            </button>
          ))}

          <div className="mx-3 my-1 border-t border-white/[0.08]" />

          <div className="px-3 py-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customId.trim()) {
                    onLoad(customId.trim());
                    setOpen(false);
                    setCustomId("");
                  }
                }}
                placeholder="Custom HF model ID..."
                className="flex-1 rounded-lg border border-white/[0.08] bg-[#212121] px-2.5 py-1.5 text-sm text-[#ececec] placeholder-[#8e8e8e] outline-none focus:border-white/[0.2]"
              />
              <button
                onClick={() => {
                  if (customId.trim()) {
                    onLoad(customId.trim());
                    setOpen(false);
                    setCustomId("");
                  }
                }}
                disabled={!customId.trim() || isLoading || disabled}
                className="rounded-lg bg-[#10a37f] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0d8c6d] disabled:opacity-40 transition-colors"
              >
                Load
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
