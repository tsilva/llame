"use client";

import { ProgressInfo } from "@/types";
import { useRef } from "react";

interface ProgressOverlayProps {
  progress: Map<string, ProgressInfo>;
  message: string;
}

export function ProgressOverlay({ progress, message }: ProgressOverlayProps) {
  const maxPercentRef = useRef(0);
  const entries = Array.from(progress.values());
  const totalLoaded = entries.reduce((s, p) => s + p.loaded, 0);
  const totalSize = entries.reduce((s, p) => s + p.total, 0);
  const rawPercent = totalSize > 0 ? (totalLoaded / totalSize) * 100 : 0;

  if (entries.length === 0) {
    maxPercentRef.current = 0;
  } else {
    maxPercentRef.current = Math.max(maxPercentRef.current, rawPercent);
  }
  const overallPercent = maxPercentRef.current;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 sm:mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#2f2f2f] p-4 sm:p-6 max-h-[80dvh]">
        <div className="text-center">
          <div className="mb-1 text-lg font-medium text-[#ececec]">
            Loading Model
          </div>
          <div className="text-sm text-[#8e8e8e]">{message}</div>
        </div>

        {entries.length > 0 && (
          <>
            <div>
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

            <div className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden">
              {entries.map((p) => (
                <div key={p.file} className="text-xs">
                  <div className="mb-0.5 flex justify-between text-[#8e8e8e]">
                    <span className="max-w-[150px] sm:max-w-[250px] truncate">{p.file}</span>
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

            <div className="text-center text-xs text-[#8e8e8e]">
              {formatBytes(totalLoaded)} / {formatBytes(totalSize)}
            </div>
          </>
        )}

        {entries.length === 0 && (
          <div className="flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#10a37f] border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
