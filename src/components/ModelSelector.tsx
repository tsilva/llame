"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { getModelCardMeta, getModelDisplayName, MODEL_PRESETS, ModelPreset } from "@/lib/constants";
import { InferenceDevice, ModelSelection } from "@/types";

interface ModelSelectorProps {
  isLoading: boolean;
  loadedModel: string | null;
  loadedPrecision: string | null;
  device: InferenceDevice;
  webgpuSupported: boolean | null;
  model: ModelSelection;
  onModelChange: (model: ModelSelection) => void;
  onOpenModelBrowser: () => void;
  isGenerating: boolean;
}

function presetToSelection(preset: ModelPreset): ModelSelection {
  return {
    id: preset.id,
    revision: preset.revision ?? null,
    supportsImages: preset.supportsImages ?? null,
    recommendedDevice: preset.recommendedDevice,
    supportTier: preset.supportTier,
  };
}

export function ModelSelector({
  isLoading,
  loadedModel,
  loadedPrecision,
  device,
  webgpuSupported,
  model,
  onModelChange,
  onOpenModelBrowser,
  isGenerating,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isModelReady = loadedModel !== null && !isLoading;
  const disabled = isLoading || isGenerating;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const displayModel = isLoading
    ? "Loading..."
    : getModelDisplayName(model.id) || getModelDisplayName(loadedModel || "") || "Qwen3.5 0.8B";

  const runtimeLabel = webgpuSupported === null
    ? "Checking..."
    : webgpuSupported
      ? device.toUpperCase()
      : "WebGPU unavailable";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[#ececec] hover:bg-[#2f2f2f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
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
          {displayModel}
        </span>
        {loadedPrecision && !isLoading && (
          <span className="text-xs text-[#8e8e8e] ml-1">
            · {loadedPrecision}
          </span>
        )}
        <span className="text-xs text-[#8e8e8e] ml-1">
          · {runtimeLabel}
        </span>
        <ChevronDown size={14} className={`text-[#8e8e8e] ml-0.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[280px] rounded-xl border border-white/[0.08] bg-[#2f2f2f] py-1 shadow-2xl shadow-black/40 animate-fade-in" role="menu">
          {MODEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                onModelChange(presetToSelection(preset));
                setOpen(false);
              }}
              role="menuitemradio"
              aria-checked={preset.id === model.id}
              className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-[#ececec] hover:bg-[#424242] transition-colors"
            >
              <Check size={14} className={`mt-0.5 shrink-0 ${preset.id === model.id ? "text-[#10a37f]" : "invisible"}`} />
              <span className="min-w-0">
                <span className="block truncate">{preset.label}</span>
                <span className="block truncate text-[11px] text-[#8e8e8e]">
                  {getModelCardMeta(preset.id).join(" · ")}
                </span>
              </span>
            </button>
          ))}
          <div className="my-1 border-t border-white/[0.08]" />
          <button
            onClick={() => {
              setOpen(false);
              onOpenModelBrowser();
            }}
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#ececec] hover:bg-[#424242] transition-colors"
          >
            <span className="w-[14px]" />
            <span>More models…</span>
          </button>
        </div>
      )}
    </div>
  );
}
