"use client";

import { X } from "lucide-react";

interface ErrorBannerProps {
  error: string;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  return (
    <div className="mx-3 mb-2 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
      <span className="mt-0.5 text-red-400">&#x26A0;</span>
      <p className="flex-1 text-sm text-red-300">{error}</p>
      <button
        onClick={onDismiss}
        className="text-red-400 hover:text-red-300 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
