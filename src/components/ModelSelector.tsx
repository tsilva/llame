"use client";

import { useState, useRef, useEffect } from "react";
import { BadgeCheck, BadgeX, ChevronDown, Check } from "lucide-react";
import { getBrokenModel, getVerifiedModel } from "@/config/verifiedModels";
import { getModelCardMeta, getModelDisplayName, MODEL_PRESETS, ModelPreset } from "@/lib/constants";
import { getModelInteractionLabel } from "@/lib/modelInteraction";
import { InferenceDevice, ModelInteractionMode, ModelSelection } from "@/types";

interface ModelSelectorProps {
  isLoading: boolean;
  loadedModel: string | null;
  loadedPrecision: string | null;
  device: InferenceDevice;
  webgpuSupported: boolean | null;
  model: ModelSelection;
  interactionMode: ModelInteractionMode;
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
    interactionMode: preset.interactionMode ?? "chat",
  };
}

export function ModelSelector({
  isLoading,
  loadedModel,
  loadedPrecision,
  device,
  webgpuSupported,
  model,
  interactionMode,
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
  const interactionLabel = getModelInteractionLabel(interactionMode);

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
        {interactionMode === "completion" && !isLoading && (
          <span className="text-xs text-[#8e8e8e] ml-1">
            · {interactionLabel}
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
            <PresetMenuItem
              key={preset.id}
              preset={preset}
              selected={preset.id === model.id}
              onSelect={() => {
                onModelChange(presetToSelection(preset));
                setOpen(false);
              }}
            />
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

function PresetMenuItem({
  preset,
  selected,
  onSelect,
}: {
  preset: ModelPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const verifiedModel = getVerifiedModel(preset.id);
  const brokenModel = getBrokenModel(preset.id);

  return (
    <button
      onClick={onSelect}
      role="menuitemradio"
      aria-checked={selected}
      className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-[#ececec] hover:bg-[#424242] transition-colors"
    >
      <Check size={14} className={`mt-0.5 shrink-0 ${selected ? "text-[#10a37f]" : "invisible"}`} />
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate">{preset.label}</span>
          {verifiedModel && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[#10a37f]/30 bg-[#10a37f]/12 px-1.5 py-0.5 text-[10px] font-medium text-[#7ee7c7]"
              title={verifiedModel.testedUrl ? `Personally tested at ${verifiedModel.testedUrl}` : "Personally tested"}
            >
              <BadgeCheck size={10} className="shrink-0" />
              Verified
            </span>
          )}
          {brokenModel && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-red-400/25 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-200"
              title={brokenModel.reason}
            >
              <BadgeX size={10} className="shrink-0" />
              Broken
            </span>
          )}
        </span>
        <span className="block truncate text-[11px] text-[#8e8e8e]">
          {[...getModelCardMeta(preset.id), getModelInteractionLabel(preset.interactionMode ?? "chat")].join(" · ")}
        </span>
      </span>
    </button>
  );
}
