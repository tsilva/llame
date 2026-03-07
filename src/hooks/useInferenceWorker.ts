"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  WorkerResponse,
  WorkerRequest,
  ChatMessage,
  GenerationParams,
  ProgressInfo,
} from "@/types";
import { CONTEXT_WINDOWS } from "@/lib/constants";

export type InferenceStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "processing"
  | "generating"
  | "error";

interface InferenceState {
  status: InferenceStatus;
  loadingMessage: string;
  processingMessage: string;
  progress: Map<string, ProgressInfo>;
  error: string | null;
  loadedModel: string | null;
  loadedDevice: string | null;
  loadedPrecision: string | null;
  tps: number;
  numTokens: number;
  inputTokens: number;
}

interface UseInferenceWorkerReturn extends InferenceState {
  loadModel: (modelId: string, device: "webgpu" | "wasm") => void;
  generate: (messages: ChatMessage[], params: GenerationParams) => void;
  interrupt: () => void;
  reset: () => void;
  onTokenRef: React.MutableRefObject<((token: string, isThinking?: boolean) => void) | null>;
  onThinkingCompleteRef: React.MutableRefObject<((thinking: string) => void) | null>;
  onCompleteRef: React.MutableRefObject<(() => void) | null>;
  contextFullness: number;
  contextWindow: number;
}

export function useInferenceWorker(): UseInferenceWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const onTokenRef = useRef<((token: string, isThinking?: boolean) => void) | null>(null);
  const onThinkingCompleteRef = useRef<((thinking: string) => void) | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);

  const [state, setState] = useState<InferenceState>({
    status: "idle",
    loadingMessage: "",
    processingMessage: "",
    progress: new Map(),
    error: null,
    loadedModel: null,
    loadedDevice: null,
    loadedPrecision: null,
    tps: 0,
    numTokens: 0,
    inputTokens: 0,
  });

  const interruptedRef = useRef(false);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/inference.worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;

      switch (data.status) {
        case "ready":
          setState((s) => ({ ...s, status: "idle" }));
          break;

        case "loading":
          setState((s) => ({
            ...s,
            status: "loading",
            loadingMessage: data.message,
            progress: new Map(),
            error: null,
          }));
          break;

        case "progress":
          setState((s) => {
            const progress = new Map(s.progress);
            progress.set(data.progress.file, data.progress);
            return { ...s, progress };
          });
          break;

        case "loaded":
          setState((s) => ({
            ...s,
            status: "loaded",
            loadedModel: data.modelId,
            loadedDevice: data.device,
            loadedPrecision: data.precision,
            progress: new Map(),
            error: null,
          }));
          break;

        case "processing":
          setState((s) => ({
            ...s,
            status: "processing",
            processingMessage: data.message,
          }));
          break;

        case "generating":
          interruptedRef.current = false;
          setState((s) => ({
            ...s,
            status: "generating",
            tps: 0,
            numTokens: 0,
            inputTokens: 0,
          }));
          break;

        case "update":
          if (interruptedRef.current) break;
          onTokenRef.current?.(data.token, data.isThinking);
          setState((s) => ({
            ...s,
            tps: data.tps,
            numTokens: data.numTokens,
            inputTokens: data.inputTokens ?? s.inputTokens,
          }));
          break;

        case "thinking_complete":
          if (interruptedRef.current) break;
          onThinkingCompleteRef.current?.(data.thinking);
          break;

        case "complete":
          if (!interruptedRef.current) {
            onCompleteRef.current?.();
          }
          interruptedRef.current = false;
          setState((s) => ({
            ...s,
            status: "loaded",
            tps: data.tps,
            numTokens: data.numTokens,
          }));
          break;

        case "error":
          interruptedRef.current = false;
          setState((s) => ({
            ...s,
            status: "error",
            error: data.error,
          }));
          break;

        case "unloaded":
          setState((s) => ({
            ...s,
            status: "idle",
            loadedModel: null,
            loadedDevice: null,
            loadedPrecision: null,
          }));
          break;
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const postMessage = useCallback((msg: WorkerRequest) => {
    workerRef.current?.postMessage(msg);
  }, []);

  const loadModel = useCallback(
    (modelId: string, device: "webgpu" | "wasm") => {
      setState((s) => ({ ...s, progress: new Map(), error: null }));
      postMessage({ type: "load", modelId, device });
    },
    [postMessage]
  );

  const generate = useCallback(
    (messages: ChatMessage[], params: GenerationParams) => {
      postMessage({ type: "generate", messages, params });
    },
    [postMessage]
  );

  const interrupt = useCallback(() => {
    interruptedRef.current = true;
    postMessage({ type: "interrupt" });
    setState((s) => {
      if (s.status === "generating") {
        return { ...s, status: "loaded" };
      }
      return s;
    });
  }, [postMessage]);

  const reset = useCallback(() => {
    postMessage({ type: "reset" });
  }, [postMessage]);

  const { loadedModel, inputTokens, ...restState } = state;

  const contextWindow = useMemo(() => {
    if (!loadedModel) return 0;
    return CONTEXT_WINDOWS[loadedModel] || 32768; // Default to 32k if unknown
  }, [loadedModel]);

  const contextFullness = useMemo(() => {
    if (!contextWindow || inputTokens === 0) return 0;
    return Math.min(100, Math.round((inputTokens / contextWindow) * 100));
  }, [contextWindow, inputTokens]);

  return {
    ...restState,
    loadedModel,
    inputTokens,
    contextFullness,
    contextWindow,
    loadModel,
    generate,
    interrupt,
    reset,
    onTokenRef,
    onThinkingCompleteRef,
    onCompleteRef,
  };
}
