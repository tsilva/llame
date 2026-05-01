"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, BadgeX, ChevronDown, ExternalLink, Loader2, Search, X } from "lucide-react";
import { getBrokenModel, getVerifiedModel } from "@/config/verifiedModels";
import { formatDownloadSizeLabel, getModelQuantizationLabel } from "@/lib/constants";
import { getModelChatFormatLabel, getModelInteractionLabel } from "@/lib/modelInteraction";
import { InferenceDevice, ModelSelection } from "@/types";
import {
  assessModelCompatibility,
  CompatibilityContext,
  DiscoveredModel,
  ModelBrowserSort,
  searchBrowserReadyModels,
} from "@/lib/modelBrowser";
import { Tooltip } from "./Tooltip";

interface ModelBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModel: (model: ModelSelection) => void;
  currentModelId: string;
  device: InferenceDevice;
  webgpuSupported: boolean | null;
  disabled?: boolean;
}

interface BrowserProfile {
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
}

type CompatibilityFilter = "all" | "recommended";

const SORT_OPTIONS: { value: ModelBrowserSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "downloads", label: "Top downloads" },
  { value: "recency", label: "Most recent" },
];

const COMPATIBILITY_FILTER_OPTIONS: { value: CompatibilityFilter; label: string }[] = [
  { value: "all", label: "All fits" },
  { value: "recommended", label: "Likely on this device" },
];

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
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
  device: InferenceDevice;
  webgpuSupported: boolean | null;
  profile: BrowserProfile;
}) {
  const parts = [
    `Runtime: ${device.toUpperCase()}`,
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

function parseModelDate(value: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRelevanceScore(model: DiscoveredModel) {
  const downloadsScore = Math.log10(model.downloads + 1) * 100;
  const likesScore = Math.log10(model.likes + 1) * 18;
  const modifiedAt = parseModelDate(model.lastModified);
  const ageDays = modifiedAt > 0
    ? (Date.now() - modifiedAt) / (1000 * 60 * 60 * 24)
    : 3650;
  const freshnessScore = Math.max(0, 26 - Math.min(ageDays, 365) / 18);

  return downloadsScore + likesScore + freshnessScore;
}

function compareModels(sortBy: ModelBrowserSort, left: DiscoveredModel, right: DiscoveredModel) {
  if (sortBy === "recency") {
    return parseModelDate(right.lastModified) - parseModelDate(left.lastModified);
  }

  if (sortBy === "relevance") {
    return getRelevanceScore(right) - getRelevanceScore(left);
  }

  return right.downloads - left.downloads;
}

function matchesCompatibilityFilter(
  model: DiscoveredModel,
  filter: CompatibilityFilter,
  compatibilityContext: CompatibilityContext,
) {
  if (filter === "all") return true;

  const compatibility = assessModelCompatibility(model, compatibilityContext);
  return compatibility.label === "Very likely" || compatibility.label === "Likely";
}

function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="min-w-[150px] flex-1 space-y-1">
      <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-[#6f6f6f]">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          className="w-full appearance-none rounded-xl border border-white/[0.08] bg-[#212121] py-2.5 pl-3 pr-10 text-sm text-[#ececec] outline-none transition-colors focus:border-[#10a37f]/40"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#c7c7c7]"
        />
      </span>
    </label>
  );
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
  const [sortBy, setSortBy] = useState<ModelBrowserSort>("relevance");
  const [compatibilityFilter, setCompatibilityFilter] = useState<CompatibilityFilter>("all");
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
  const resultsContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

  const fetchModels = useCallback(async (
    searchQuery: string,
    cursor: string | null,
    append: boolean,
    requestedSort: ModelBrowserSort,
  ) => {
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
      const page = await searchBrowserReadyModels(searchQuery, controller.signal, {
        cursor,
        sort: requestedSort,
      });
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

    void fetchModels(debouncedQuery, null, false, sortBy);

    return () => requestControllerRef.current?.abort();
  }, [debouncedQuery, fetchModels, isOpen, sortBy]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
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

  useEffect(() => {
    if (!isOpen) return;
    if (!nextCursor || initialLoading || loadingMore || error) return;

    const root = resultsContainerRef.current;
    const target = loadMoreTriggerRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting) return;
      observer.unobserve(target);
      void fetchModels(debouncedQuery, nextCursor, true, sortBy);
    }, {
      root,
      rootMargin: "0px 0px 240px 0px",
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [debouncedQuery, error, fetchModels, initialLoading, isOpen, loadingMore, nextCursor, sortBy]);

  if (!isOpen) return null;

  const compatibilityContext: CompatibilityContext = {
    device,
    webgpuSupported,
    deviceMemoryGb: profile.deviceMemoryGb,
    hardwareConcurrency: profile.hardwareConcurrency,
  };
  const displayedResults = [...results]
    .sort((left, right) => compareModels(sortBy, left, right))
    .filter((model) => matchesCompatibilityFilter(model, compatibilityFilter, compatibilityContext));
  const hasActiveFilters = compatibilityFilter !== "all";
  const clearFilters = () => {
    setCompatibilityFilter("all");
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-enter"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-4 flex max-h-[88dvh] w-full max-w-4xl flex-col rounded-2xl border border-white/[0.08] bg-[#2f2f2f] shadow-2xl shadow-black/40 animate-modal-enter" role="dialog" aria-modal="true" aria-labelledby="model-browser-title">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
          <div className="space-y-1">
            <h2 id="model-browser-title" className="text-lg font-medium text-[#ececec]">Browse Browser-Ready ONNX LLMs and VLMs</h2>
            <BrowserProfileLine device={device} webgpuSupported={webgpuSupported} profile={profile} />
          </div>
          <Tooltip label="Close model browser" align="end">
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-[#8e8e8e] transition-colors duration-150 hover:bg-[#424242] hover:text-[#ececec]"
              aria-label="Close model browser"
            >
              <X size={20} />
            </button>
          </Tooltip>
        </div>

        <div className="border-b border-white/[0.08] px-5 py-4">
          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#212121] px-3.5 py-3 focus-within:border-[#10a37f]/40">
              <Search size={18} className="text-[#6f6f6f]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search browser-ready ONNX LLMs and VLMs"
                className="w-full bg-transparent text-sm text-[#ececec] outline-none placeholder:text-[#6f6f6f]"
                autoFocus
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <SelectControl
                label="Sort"
                value={sortBy}
                options={SORT_OPTIONS}
                onChange={setSortBy}
              />
              <SelectControl
                label="Fit"
                value={compatibilityFilter}
                options={COMPATIBILITY_FILTER_OPTIONS}
                onChange={setCompatibilityFilter}
              />
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#212121] px-3.5 py-2.5 text-xs text-[#8e8e8e]">
                <span>Filters are narrowing the current results.</span>
                <button
                  type="button"
                  onClick={clearFilters}
                  title="Clear filters"
                  className="rounded-lg px-2 py-1 text-[#b4b4b4] transition-colors hover:bg-[#3a3a3a] hover:text-[#ececec]"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>

        <div ref={resultsContainerRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4 scrollbar-thin">
          {initialLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#212121] px-4 py-4 text-sm text-[#b4b4b4]" role="status" aria-live="polite">
              <Loader2 size={16} className="animate-spin text-[#10a37f]" />
              <span>Searching Hugging Face ONNX models…</span>
            </div>
          )}

          {!initialLoading && error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
              <div>{error}</div>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => void fetchModels(debouncedQuery, null, false, sortBy)}
                  title="Retry search"
                  className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-100 transition-colors hover:bg-red-500/25"
                >
                  Retry search
                </button>
              </div>
            </div>
          )}

          {!initialLoading && !error && displayedResults.length === 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#212121] px-4 py-5 text-sm text-[#8e8e8e]">
              {results.length === 0
                ? "No browser-ready ONNX LLMs or VLMs matched that search."
                : "No models matched the current filters. Try widening the fit filter."}
            </div>
          )}

          {!initialLoading && displayedResults.map((model) => {
            const compatibility = assessModelCompatibility(model, compatibilityContext);
            const updatedLabel = formatDateLabel(model.lastModified);
            const quantizationLabel = getModelQuantizationLabel(model.id, model.isVisionModel);
            const parameterCountLabel = model.parameterCountB !== null ? `${model.parameterCountB}B` : null;
            const downloadSizeLabel = formatDownloadSizeLabel(model.estimatedDownloadGb);
            const active = model.id === currentModelId;
            const verifiedModel = getVerifiedModel(model.id);
            const brokenModel = getBrokenModel(model.id);
            const interactionLabel = getModelInteractionLabel(model.interactionMode);
            const chatFormatLabel = getModelChatFormatLabel(model.chatFormat);

            return (
              <div
                key={model.id}
                className={`rounded-xl border px-3 py-2.5 ${
                  verifiedModel
                    ? "border-[#10a37f]/35 bg-[#1d2824]"
                    : "border-white/[0.08] bg-[#212121]"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <a
                          href={`https://huggingface.co/${model.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-w-0 items-center gap-1 text-sm font-medium text-[#ececec] transition-colors hover:text-white"
                        >
                          <span className="truncate">{model.name}</span>
                          <ExternalLink size={12} className="shrink-0" />
                        </a>
                        {verifiedModel && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-[#10a37f]/30 bg-[#10a37f]/12 px-2 py-0.5 text-[10px] font-medium text-[#7ee7c7]"
                            title={verifiedModel.testedUrl ? `Personally tested at ${verifiedModel.testedUrl}` : "Personally tested"}
                          >
                            <BadgeCheck size={11} className="shrink-0" />
                            Verified
                          </span>
                        )}
                        {brokenModel && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-red-400/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-200"
                            title={brokenModel.reason}
                          >
                            <BadgeX size={11} className="shrink-0" />
                            Broken
                          </span>
                        )}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${compatibilityClasses(compatibility.tone)}`}>
                          {compatibility.label}
                        </span>
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                          Experimental
                        </span>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-[#d0d0d0]">
                          {quantizationLabel}
                        </span>
                        {parameterCountLabel && (
                          <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-[#d0d0d0]">
                            {parameterCountLabel}
                          </span>
                        )}
                        {downloadSizeLabel && (
                          <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-[#d0d0d0]">
                            {downloadSizeLabel}
                          </span>
                        )}
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-[#d0d0d0]">
                          {interactionLabel}
                        </span>
                        <span
                          className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-[#d0d0d0]"
                          title="Chat template format"
                        >
                          {chatFormatLabel}
                        </span>
                        {active && (
                          <span className="rounded-full border border-[#10a37f]/25 bg-[#10a37f]/10 px-2 py-0.5 text-[10px] font-medium text-[#7ee7c7]">
                            Current
                          </span>
                        )}
                      </div>

                      <p className="truncate text-[11px] text-[#6f6f6f]">{model.id}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 self-center">
                      <button
                        onClick={() => onSelectModel({
                          id: model.id,
                          revision: model.revision,
                          supportsImages: model.isVisionModel,
                          recommendedDevice: device,
                          supportTier: "experimental",
                          interactionMode: model.interactionMode,
                          chatFormat: model.chatFormat,
                        })}
                        disabled={disabled || active}
                        title={active ? "Current model" : `Use ${model.name}`}
                        className="rounded-lg bg-[#10a37f] px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#14b38c] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {active ? "Selected" : "Use model"}
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap gap-1 text-[10px] text-[#8e8e8e]">
                      <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5">
                        {model.isVisionModel ? "Vision" : "Text"}
                      </span>
                      {model.pipelineTag && (
                        <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5">
                          {model.pipelineTag}
                        </span>
                      )}
                      <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5">
                        {formatCompactNumber(model.downloads)} downloads
                      </span>
                      {model.likes > 0 && (
                        <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5">
                          {formatCompactNumber(model.likes)} likes
                        </span>
                      )}
                      {updatedLabel && (
                        <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5">
                          Updated {updatedLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!initialLoading && results.length > 0 && (
            <div ref={loadMoreTriggerRef} className="flex min-h-8 items-center justify-center pt-1">
              {loadingMore && (
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#212121] px-3 py-2 text-xs text-[#d0d0d0]">
                  <Loader2 size={14} className="animate-spin text-[#10a37f]" />
                  <span>Loading more models…</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
