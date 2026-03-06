"use client";

import { MODEL_PRESETS } from "@/lib/constants";
import { PanelLeft, SquarePen, Settings, Trash2 } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onClearChat: () => void;
  modelId: string | null;
  onLoadModel: (modelId: string) => void;
  isLoading: boolean;
  isGenerating: boolean;
  device: "webgpu" | "wasm";
  webgpuSupported: boolean | null;
}

export function Sidebar({
  isOpen,
  onToggle,
  onNewChat,
  onOpenSettings,
  onClearChat,
  modelId,
  onLoadModel,
  isLoading,
  isGenerating,
  device,
  webgpuSupported,
}: SidebarProps) {
  return (
    <div
      className="flex-shrink-0 overflow-hidden transition-all duration-300 bg-[#171717]"
      style={{ width: isOpen ? 260 : 0 }}
    >
      <div className="flex h-full w-[260px] flex-col">
        {/* Top row */}
        <div className="flex items-center justify-between p-3">
          <button
            onClick={onToggle}
            className="rounded-lg p-2 text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors"
            title="Close sidebar"
          >
            <PanelLeft size={20} />
          </button>
          <button
            onClick={onNewChat}
            className="rounded-lg p-2 text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors"
            title="New chat"
          >
            <SquarePen size={20} />
          </button>
        </div>

        {/* Model presets */}
        <div className="px-3 py-2">
          <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
            Model
          </span>
          <div className="mt-2 space-y-0.5">
            {MODEL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onLoadModel(preset.id)}
                disabled={isLoading || isGenerating}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 ${
                  modelId === preset.id
                    ? "bg-[#2f2f2f] text-[#ececec]"
                    : "text-[#b4b4b4] hover:bg-[#2f2f2f]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom section */}
        <div className="border-t border-white/[0.08] p-3 space-y-1">
          {/* Device indicator */}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                webgpuSupported === null
                  ? "bg-[#8e8e8e]"
                  : device === "webgpu" && webgpuSupported
                    ? "bg-[#10a37f]"
                    : "bg-amber-400"
              }`}
            />
            <span className="text-xs text-[#b4b4b4]">
              {webgpuSupported === null
                ? "Checking..."
                : device === "webgpu" && webgpuSupported
                  ? "WebGPU"
                  : "WASM"}
            </span>
          </div>

          <button
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors"
          >
            <Settings size={16} />
            Settings
          </button>

          <button
            onClick={onClearChat}
            disabled={isGenerating}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors disabled:opacity-40"
          >
            <Trash2 size={16} />
            Clear chat
          </button>
        </div>
      </div>
    </div>
  );
}
