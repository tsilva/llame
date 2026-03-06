"use client";

import { StorageStats } from "@/types";
import { StorageWarning } from "@/hooks/useStorage";
import { Trash2 } from "lucide-react";

interface StorageIndicatorProps {
  stats: StorageStats;
  warning: StorageWarning;
  onClearOldChats: () => void;
}

function formatBytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function StorageIndicator({ stats, warning, onClearOldChats }: StorageIndicatorProps) {
  const percent = Math.min((stats.usedBytes / stats.quotaBytes) * 100, 100);

  const barColor =
    warning === "critical"
      ? "bg-red-500"
      : warning === "warning"
        ? "bg-amber-400"
        : "bg-[#10a37f]";

  return (
    <div className="px-2 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#8e8e8e]">
          {formatBytes(stats.usedBytes)} / {formatBytes(stats.quotaBytes)} MB
        </span>
        {warning === "critical" && (
          <button
            onClick={onClearOldChats}
            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
            title="Clear old chats"
          >
            <Trash2 size={10} />
            Clear
          </button>
        )}
      </div>
      <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
