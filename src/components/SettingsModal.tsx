"use client";

import { GenerationParams } from "@/types";
import { DEFAULT_PARAMS, PARAM_RANGES } from "@/lib/constants";
import { X } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: GenerationParams;
  onChange: (params: GenerationParams) => void;
  device: "webgpu" | "wasm";
  onDeviceChange: (device: "webgpu" | "wasm") => void;
  webgpuAvailable: boolean;
}

export function SettingsModal({
  isOpen,
  onClose,
  params,
  onChange,
  device,
  onDeviceChange,
  webgpuAvailable,
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
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#2f2f2f] p-6 shadow-xl">
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

        <div className="space-y-5">
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

          <button
            onClick={() => onChange(DEFAULT_PARAMS)}
            className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-[#8e8e8e] hover:text-[#b4b4b4] hover:border-white/[0.15] transition-colors"
          >
            Reset defaults
          </button>
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
