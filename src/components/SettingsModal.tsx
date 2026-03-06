"use client";

import { GenerationParams, StorageStats } from "@/types";
import { DEFAULT_PARAMS, PARAM_RANGES } from "@/lib/constants";
import { X, Trash } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: GenerationParams;
  onChange: (params: GenerationParams) => void;
  device: "webgpu" | "wasm";
  onDeviceChange: (device: "webgpu" | "wasm") => void;
  webgpuAvailable: boolean;
  storageStats: StorageStats;
  conversationsCount: number;
  onClearAllChats: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  params,
  onChange,
  device,
  onDeviceChange,
  webgpuAvailable,
  storageStats,
  conversationsCount,
  onClearAllChats,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const update = (key: keyof GenerationParams, value: number | boolean) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 sm:mx-auto w-full max-w-md max-h-[85dvh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#2f2f2f] p-4 sm:p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-medium text-[#ececec]">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#8e8e8e] hover:bg-[#424242] hover:text-[#ececec] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto flex-1">
          {/* Device selector */}
          <div className="space-y-2">
            <label className="text-xs text-[#8e8e8e]">Device</label>
            <div className="flex gap-2">
              <button
                onClick={() => onDeviceChange("webgpu")}
                disabled={!webgpuAvailable}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  device === "webgpu"
                    ? "bg-[#10a37f]/20 text-[#10a37f] border border-[#10a37f]/30"
                    : "bg-[#212121] text-[#b4b4b4] border border-white/[0.08] hover:border-white/[0.15]"
                } disabled:opacity-30`}
              >
                WebGPU
              </button>
              <button
                onClick={() => onDeviceChange("wasm")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  device === "wasm"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-[#212121] text-[#b4b4b4] border border-white/[0.08] hover:border-white/[0.15]"
                }`}
              >
                WASM
              </button>
            </div>
          </div>

          {/* Sampling toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-[#b4b4b4]">Sampling</label>
            <button
              onClick={() => update("do_sample", !params.do_sample)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                params.do_sample ? "bg-[#10a37f]" : "bg-[#424242]"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                  params.do_sample ? "left-[22px]" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Sliders */}
          <Slider
            label="Max tokens"
            value={params.max_new_tokens}
            {...PARAM_RANGES.max_new_tokens}
            onChange={(v) => update("max_new_tokens", v)}
          />

          {params.do_sample && (
            <>
              <Slider
                label="Temperature"
                value={params.temperature}
                {...PARAM_RANGES.temperature}
                onChange={(v) => update("temperature", v)}
              />
              <Slider
                label="Top P"
                value={params.top_p}
                {...PARAM_RANGES.top_p}
                onChange={(v) => update("top_p", v)}
              />
              <Slider
                label="Top K"
                value={params.top_k}
                {...PARAM_RANGES.top_k}
                onChange={(v) => update("top_k", v)}
              />
              <Slider
                label="Repetition penalty"
                value={params.repetition_penalty}
                {...PARAM_RANGES.repetition_penalty}
                onChange={(v) => update("repetition_penalty", v)}
              />
            </>
          )}

          {/* Status & Data section */}
          <div className="rounded-lg border border-white/[0.08] p-3 space-y-3">
            <h3 className="text-xs font-medium text-[#8e8e8e] uppercase tracking-wider">
              Status & Data
            </h3>
            
            {/* Storage usage bar */}
            {(() => {
              const storagePercent = Math.min(
                100,
                Math.round((storageStats.usedBytes / storageStats.quotaBytes) * 100)
              );
              const usedMB = (storageStats.usedBytes / 1024 / 1024).toFixed(1);
              const quotaMB = (storageStats.quotaBytes / 1024 / 1024).toFixed(0);
              return (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#b4b4b4]">Storage</span>
                    <span className={`font-mono text-[#8e8e8e] ${
                      storagePercent >= 80
                        ? "text-[#dc3545]"
                        : storagePercent >= 50
                          ? "text-[#f0ad4e]"
                          : "text-[#10a37f]"
                    }`}>
                      {usedMB} / {quotaMB} MB
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#212121] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        storagePercent >= 80
                          ? "bg-[#dc3545]"
                          : storagePercent >= 50
                            ? "bg-[#f0ad4e]"
                            : "bg-[#10a37f]"
                      }`}
                      style={{
                        width: `${storagePercent}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Clear all history button */}
            {conversationsCount > 0 && (
              <button
                onClick={() => {
                  onClearAllChats();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash size={14} />
                Clear all history ({conversationsCount})
              </button>
            )}
          </div>

          <button
            onClick={() => onChange(DEFAULT_PARAMS)}
            className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-[#8e8e8e] hover:text-[#b4b4b4] hover:border-white/[0.15] transition-colors"
          >
            Reset defaults
          </button>

          {/* Git commit hash - discreet footer */}
          <div className="pt-2 text-center">
            <span className="text-[10px] text-[#5a5a5a] font-mono">
              {process.env.GIT_COMMIT_HASH}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-[#b4b4b4]">{label}</span>
        <span className="font-mono text-[#8e8e8e]">
          {Number.isInteger(step) ? value : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#10a37f]"
      />
    </div>
  );
}
