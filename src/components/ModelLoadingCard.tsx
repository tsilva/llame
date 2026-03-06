"use client";

import { ProgressInfo } from "@/types";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface ModelLoadingCardProps {
  progress: Map<string, ProgressInfo>;
  message: string;
  modelName: string;
}

export function ModelLoadingCard({
  progress,
  message,
  modelName,
}: ModelLoadingCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const entries = Array.from(progress.values());
  const totalLoaded = entries.reduce((s, p) => s + p.loaded, 0);
  const totalSize = entries.reduce((s, p) => s + p.total, 0);
  const overallPercent = totalSize > 0 ? (totalLoaded / totalSize) * 100 : 0;

  const displayModelName = modelName.split("/").pop() || modelName;

  return (
    <div className="flex gap-3 animate-fade-in">
      {/* Avatar */}
      <div className="mt-1 flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#10a37f]">
        <Sparkles size={14} className="text-white" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-white/[0.08] bg-[#2f2f2f] p-3 sm:p-4 max-w-md">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Loader2 size={16} className="text-[#10a37f] animate-spin" />
            <span className="text-sm font-medium text-[#ececec]">
              Loading {displayModelName}
            </span>
          </div>

          {/* Message */}
          <div className="text-xs text-[#8e8e8e] mb-3">{message}</div>

          {entries.length > 0 && (
            <>
              {/* Overall progress */}
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-xs text-[#8e8e8e]">
                  <span>Overall</span>
                  <span>{overallPercent.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-[#10a37f] transition-all duration-200"
                    style={{ width: `${overallPercent}%` }}
                  />
                </div>
              </div>

              {/* Expand/collapse toggle */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs text-[#8e8e8e] hover:text-[#ececec] transition-colors mb-2"
              >
                {showDetails ? (
                  <>
                    <ChevronUp size={14} />
                    <span>Hide details</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    <span>Show details ({entries.length} files)</span>
                  </>
                )}
              </button>

              {/* Individual file progress */}
              {showDetails && (
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto overflow-x-hidden mb-2">
                  {entries.map((p) => (
                    <div key={p.file} className="text-xs">
                      <div className="mb-0.5 flex justify-between text-[#8e8e8e]">
                        <span className="max-w-[140px] sm:max-w-[200px] truncate">{p.file}</span>
                        <span>{p.progress.toFixed(0)}%</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-[#10a37f]/60 transition-all duration-200"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total size */}
              <div className="text-center text-xs text-[#8e8e8e]">
                {formatBytes(totalLoaded)} / {formatBytes(totalSize)}
              </div>
            </>
          )}

          {entries.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-[#8e8e8e]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#10a37f] border-t-transparent" />
              <span>Preparing download...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
