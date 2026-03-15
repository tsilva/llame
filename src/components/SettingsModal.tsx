"use client";

import { useEffect } from "react";
import { GenerationParams, StorageStats } from "@/types";
import { DEFAULT_PARAMS, PARAM_RANGES, SLIDER_CONFIGS } from "@/lib/constants";
import { X, Cpu, RotateCcw, HardDrive } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: GenerationParams;
  onChange: (params: GenerationParams) => void;
  device: "webgpu" | "wasm";
  onDeviceChange: (device: "webgpu" | "wasm") => void;
  webgpuAvailable: boolean;
  storageStats: StorageStats;
  isGenerating: boolean;
}

function SectionHeader({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-[#8e8e8e]">{icon}</span>}
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8e8e8e] whitespace-nowrap">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/[0.08]" />
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
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className={`group space-y-2 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex justify-between text-sm">
        <span className={`text-[#8e8e8e] transition-colors duration-150 ${disabled ? '' : 'group-hover:text-[#b4b4b4]'}`}>
          {label}
        </span>
        <span className="font-mono text-[#10a37f] tabular-nums">
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
        disabled={disabled}
        className="slider-industrial disabled:cursor-not-allowed"
        style={{ "--slider-fill": `${fill}%` } as React.CSSProperties}
      />
    </div>
  );
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
  isGenerating,
}: SettingsModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const update = (key: keyof GenerationParams, value: number | boolean) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 sm:mx-auto w-full max-w-lg max-h-[85dvh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#2f2f2f] shadow-2xl shadow-black/40 animate-modal-enter" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <h2 id="settings-title" className="text-lg font-medium text-[#ececec]">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#8e8e8e] hover:bg-[#424242] hover:text-[#ececec] transition-colors duration-150"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto flex-1 scrollbar-thin px-5 py-4">
          {/* RUNTIME section */}
          <div className="space-y-4">
            <SectionHeader label="Runtime" icon={<Cpu size={13} />} />

            {/* Segmented device selector */}
            <div className="space-y-2">
              <label className="text-xs text-[#8e8e8e]">Device</label>
              <div className="relative flex rounded-lg bg-[#212121] p-1">
                {/* Sliding indicator */}
                <div
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md transition-[left] duration-200 ease-out"
                  style={{
                    left: device === "webgpu" ? "4px" : "calc(50% + 0px)",
                    background:
                      device === "webgpu"
                        ? "rgba(16, 163, 127, 0.15)"
                        : "rgba(245, 158, 11, 0.15)",
                  }}
                />
                <button
                  onClick={() => onDeviceChange("webgpu")}
                  disabled={!webgpuAvailable || isGenerating}
                  className={`relative z-10 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    device === "webgpu"
                      ? "text-[#10a37f]"
                      : "text-[#8e8e8e] hover:text-[#b4b4b4]"
                  } disabled:opacity-30`}
                >
                  WebGPU
                </button>
                <button
                  onClick={() => onDeviceChange("wasm")}
                  disabled={isGenerating}
                  className={`relative z-10 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    device === "wasm"
                      ? "text-amber-400"
                      : "text-[#8e8e8e] hover:text-[#b4b4b4]"
                  } ${isGenerating ? 'disabled:opacity-30' : ''}`}
                >
                  WASM
                </button>
              </div>
            </div>

            {/* Sampling toggle card */}
            <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#212121] px-3.5 py-3">
              <div>
                <div className="text-sm text-[#b4b4b4]">Sampling</div>
                <div className="text-[11px] text-[#6e6e6e]">
                  {params.do_sample
                    ? "Stochastic decoding"
                    : "Greedy decoding"}
                </div>
              </div>
              <button
                onClick={() => update("do_sample", !params.do_sample)}
                disabled={isGenerating}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  params.do_sample ? "bg-[#10a37f]" : "bg-[#424242]"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
                    params.do_sample ? "left-[22px]" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* INFERENCE section */}
          <div className="space-y-4">
            <SectionHeader label="Inference" />

            {SLIDER_CONFIGS
              .filter((s) => !s.samplingOnly || params.do_sample)
              .map((s) => (
                <Slider
                  key={s.key}
                  label={s.label}
                  value={params[s.key] as number}
                  {...PARAM_RANGES[s.key]}
                  onChange={(v) => update(s.key, v)}
                  disabled={isGenerating}
                />
              ))}
          </div>

          {/* STORAGE section */}
          <div className="space-y-4">
            <SectionHeader label="Storage" icon={<HardDrive size={13} />} />

            {/* Storage usage bar */}
            {(() => {
              const storagePercent = Math.min(
                100,
                Math.round(
                  (storageStats.usedBytes / storageStats.quotaBytes) * 100
                )
              );
              const usedMB = (storageStats.usedBytes / 1024 / 1024).toFixed(1);
              const quotaMB = (storageStats.quotaBytes / 1024 / 1024).toFixed(
                0
              );
              return (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8e8e8e]">Usage</span>
                    <span
                      className={`font-mono tabular-nums ${
                        storagePercent >= 80
                          ? "text-[#dc3545]"
                          : storagePercent >= 50
                            ? "text-[#f0ad4e]"
                            : "text-[#10a37f]"
                      }`}
                    >
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

          </div>

          {/* Footer */}
          <div className="space-y-3 pt-1">
            <button
              onClick={() => onChange(DEFAULT_PARAMS)}
              disabled={isGenerating}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-[#8e8e8e] hover:text-[#b4b4b4] hover:border-white/[0.15] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={13} />
              Reset defaults
            </button>

            {/* Git commit hash */}
            <div className="text-center">
              <span className="text-[10px] text-[#5a5a5a] font-mono">
                {process.env.GIT_COMMIT_HASH}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
