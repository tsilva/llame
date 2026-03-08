"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Search, X } from "lucide-react";
import {
  assessModelCompatibility,
  CompatibilityContext,
  DiscoveredModel,
  searchOnnxCommunityModels,
} from "@/lib/modelBrowser";

interface ModelBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModel: (modelId: string) => void;
  currentModelId: string;
  device: "webgpu" | "wasm";
  webgpuSupported: boolean | null;
  disabled?: boolean;
}

interface BrowserProfile {
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatSizeLabel(value: number | null) {
  if (value === null) return null;
  if (value < 1) return `${Math.round(value * 1024)} MB`;
  return `${value.toFixed(value >= 10 ? 0 : 1)} GB`;
}

function formatDateLabel(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function compatibilityClasses(tone: ReturnType<typeof assessModelCompatibility>["tone"]) {
  switch (tone) {
    case "green":
      return "border-[#10a37f]/30 bg-[#10a37f]/12 text-[#7ee7c7]";
    case "emerald":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
    case "amber":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";
    case "red":
      return "border-red-400/25 bg-red-400/10 text-red-200";
  }
}

function BrowserProfileLine({ device, webgpuSupported, profile }: {
  device: "webgpu" | "wasm";
  webgpuSupported: boolean | null;
  profile: BrowserProfile;
}) {
  const parts = [
    `Runtime: ${device === "webgpu" ? "WebGPU" : "WASM"}`,
    webgpuSupported === null ? "WebGPU: checking" : `WebGPU: ${webgpuSupported ? "available" : "unavailable"}`,
    profile.deviceMemoryGb ? `${profile.deviceMemoryGb} GB RAM hint` : "RAM hint unavailable",
    profile.hardwareConcurrency ? `${profile.hardwareConcurrency} CPU threads` : "CPU hint unavailable",
  ];

  return (
    <p className="text-xs leading-5 text-[#8e8e8e]">
      {parts.join(" · ")}
    </p>
  );
}

function mergeModels(existing: DiscoveredModel[], incoming: DiscoveredModel[]) {
  const seen = new Set(existing.map((model) => model.id));
  return [...existing, ...incoming.filter((model) => !seen.has(model.id))];
}

export function ModelBrowserModal({
  isOpen,
  onClose,
  onSelectModel,
  currentModelId,
  device,
  webgpuSupported,
  disabled = false,
}: ModelBrowserModalProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<DiscoveredModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [profile, setProfile] = useState<BrowserProfile>({
    deviceMemoryGb: null,
    hardwareConcurrency: null,
  });
  const requestControllerRef = useRef<AbortController | null>(null);

  const fetchModels = useCallback(async (searchQuery: string, cursor: string | null, append: boolean) => {
    requestControllerRef.current?.abort();

    const controller = new AbortController();
    requestControllerRef.current = controller;

    if (append) {
      setLoadingMore(true);
      setError(null);
    } else {
      setInitialLoading(true);
      setError(null);
    }

    try {
      const page = await searchOnnxCommunityModels(searchQuery, controller.signal, cursor);
      setResults((current) => append ? mergeModels(current, page.models) : page.models);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;

      setError(err instanceof Error ? err.message : "Failed to search models");

      if (!append) {
        setNextCursor(null);
        setResults([]);
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }

      if (append) {
        setLoadingMore(false);
      } else {
        setInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const nav = navigator as Navigator & { deviceMemory?: number };
      setProfile({
        deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
        hardwareConcurrency: typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    void fetchModels(debouncedQuery, null, false);

    return () => requestControllerRef.current?.abort();
  }, [debouncedQuery, fetchModels, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;

    requestControllerRef.current?.abort();
    setInitialLoading(false);
    setLoadingMore(false);
    setNextCursor(null);
    setError(null);
    setResults([]);
  }, [isOpen]);

  if (!isOpen) return null;

  const compatibilityContext: CompatibilityContext = {
    device,
    webgpuSupported,
    deviceMemoryGb: profile.deviceMemoryGb,
    hardwareConcurrency: profile.hardwareConcurrency,
  };
  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    void fetchModels(debouncedQuery, nextCursor, true);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-enter"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-4 flex max-h-[88dvh] w-full max-w-4xl flex-col rounded-2xl border border-white/[0.08] bg-[#2f2f2f] shadow-2xl shadow-black/40 animate-modal-enter">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-[#ececec]">Browse ONNX Community LLMs and VLMs</h2>
            <p className="text-sm text-[#8e8e8e]">
              Search Hugging Face for chat-capable ONNX models and use the compatibility badge as a browser-side estimate, not a guarantee.
            </p>
            <BrowserProfileLine device={device} webgpuSupported={webgpuSupported} profile={profile} />
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#8e8e8e] transition-colors duration-150 hover:bg-[#424242] hover:text-[#ececec]"
            aria-label="Close model browser"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-white/[0.08] px-5 py-4">
          <label className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#212121] px-3.5 py-3 focus-within:border-[#10a37f]/40">
            <Search size={18} className="text-[#6f6f6f]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ONNX Community LLMs and VLMs"
              className="w-full bg-transparent text-sm text-[#ececec] outline-none placeholder:text-[#6f6f6f]"
              autoFocus
            />
          </label>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 scrollbar-thin">
          {initialLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#212121] px-4 py-4 text-sm text-[#b4b4b4]">
              <Loader2 size={16} className="animate-spin text-[#10a37f]" />
              <span>Searching ONNX Community…</span>
            </div>
          )}

          {!initialLoading && error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!initialLoading && !error && results.length === 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#212121] px-4 py-5 text-sm text-[#8e8e8e]">
              No ONNX Community LLMs or VLMs matched that search.
            </div>
          )}

          {!initialLoading && results.map((model) => {
            const compatibility = assessModelCompatibility(model, compatibilityContext);
            const sizeLabel = formatSizeLabel(model.estimatedDownloadGb);
            const updatedLabel = formatDateLabel(model.lastModified);
            const active = model.id === currentModelId;

            return (
              <div
                key={model.id}
                className="rounded-2xl border border-white/[0.08] bg-[#212121] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-[#ececec]">{model.name}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${compatibilityClasses(compatibility.tone)}`}>
                        {compatibility.label}
                      </span>
                      {active && (
                        <span className="rounded-full border border-[#10a37f]/25 bg-[#10a37f]/10 px-2 py-0.5 text-[11px] font-medium text-[#7ee7c7]">
                          Current
                        </span>
                      )}
                    </div>

                    <p className="truncate text-xs text-[#6f6f6f]">{model.id}</p>
                    <p className="text-sm text-[#b4b4b4]">{compatibility.summary}</p>

                    <div className="flex flex-wrap gap-2 text-[11px] text-[#8e8e8e]">
                      {model.parameterCountB !== null && (
                        <span className="rounded-full bg-white/[0.05] px-2 py-1">
                          {model.parameterCountB}B params
                        </span>
                      )}
                      {sizeLabel && (
                        <span className="rounded-full bg-white/[0.05] px-2 py-1">
                          ~{sizeLabel} download
                        </span>
                      )}
                      {model.pipelineTag && (
                        <span className="rounded-full bg-white/[0.05] px-2 py-1">
                          {model.pipelineTag}
                        </span>
                      )}
                      <span className="rounded-full bg-white/[0.05] px-2 py-1">
                        {formatCompactNumber(model.downloads)} downloads
                      </span>
                      {model.likes > 0 && (
                        <span className="rounded-full bg-white/[0.05] px-2 py-1">
                          {formatCompactNumber(model.likes)} likes
                        </span>
                      )}
                      {updatedLabel && (
                        <span className="rounded-full bg-white/[0.05] px-2 py-1">
                          Updated {updatedLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`https://huggingface.co/${model.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-[#b4b4b4] transition-colors hover:bg-[#3a3a3a] hover:text-[#ececec]"
                    >
                      <span>View</span>
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => onSelectModel(model.id)}
                      disabled={disabled || active}
                      className="rounded-lg bg-[#10a37f] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#14b38c] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {active ? "Selected" : "Use model"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {!initialLoading && results.length > 0 && nextCursor && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#212121] px-4 py-2.5 text-sm text-[#d0d0d0] transition-colors hover:bg-[#3a3a3a] hover:text-[#ececec] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore && <Loader2 size={15} className="animate-spin text-[#10a37f]" />}
                <span>{loadingMore ? "Loading more models…" : "Load more models"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
