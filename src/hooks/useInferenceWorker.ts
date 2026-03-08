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
  loadedSupportsImages: boolean | null;
  tps: number;
  numTokens: number;
  inputTokens: number;
}

interface UseInferenceWorkerReturn extends InferenceState {
  loadModel: (modelId: string, device: "webgpu" | "wasm") => void;
  generate: (messages: ChatMessage[], params: GenerationParams) => void;
  interrupt: () => void;
  reset: () => void;
  onPromptRef: React.MutableRefObject<((inputText: string) => void) | null>;
  onRawTokenRef: React.MutableRefObject<((token: string) => void) | null>;
  onTokenRef: React.MutableRefObject<((token: string, isThinking?: boolean) => void) | null>;
  onThinkingCompleteRef: React.MutableRefObject<((thinking: string) => void) | null>;
  onCompleteRef: React.MutableRefObject<(() => void) | null>;
  contextFullness: number;
  contextWindow: number;
}

export function useInferenceWorker(): UseInferenceWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const stateRef = useRef<InferenceState>({
    status: "idle",
    loadingMessage: "",
    processingMessage: "",
    progress: new Map(),
    error: null,
    loadedModel: null,
    loadedDevice: null,
    loadedPrecision: null,
    loadedSupportsImages: null,
    tps: 0,
    numTokens: 0,
    inputTokens: 0,
  });
  const onPromptRef = useRef<((inputText: string) => void) | null>(null);
  const onRawTokenRef = useRef<((token: string) => void) | null>(null);
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
    loadedSupportsImages: null,
    tps: 0,
    numTokens: 0,
    inputTokens: 0,
  });

  const interruptedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const attachWorker = useCallback((worker: Worker) => {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (workerRef.current !== worker) return;

      const d = event.data;

      if (d.status === "ready") {
        setState((s) => ({ ...s, status: "idle" }));
      } else if (d.status === "loading") {
        setState((s) => ({ ...s, status: "loading", loadingMessage: d.message, progress: new Map(), error: null }));
      } else if (d.status === "progress") {
        setState((s) => { const p = new Map(s.progress); p.set(d.progress.file, d.progress); return { ...s, progress: p }; });
      } else if (d.status === "loaded") {
        setState((s) => ({
          ...s,
          status: "loaded",
          loadedModel: d.modelId,
          loadedDevice: d.device,
          loadedPrecision: d.precision,
          loadedSupportsImages: d.supportsImages,
          progress: new Map(),
          error: null,
        }));
      } else if (d.status === "processing") {
        setState((s) => ({ ...s, status: "processing", processingMessage: d.message }));
      } else if (d.status === "generating") {
        interruptedRef.current = false;
        setState((s) => ({ ...s, status: "generating", tps: 0, numTokens: 0, inputTokens: 0 }));
      } else if (d.status === "prompt") {
        if (!interruptedRef.current) onPromptRef.current?.(d.inputText);
      } else if (d.status === "raw_update") {
        if (!interruptedRef.current) onRawTokenRef.current?.(d.token);
      } else if (d.status === "update") {
        if (interruptedRef.current) return;
        onTokenRef.current?.(d.token, d.isThinking);
        setState((s) => ({ ...s, tps: d.tps, numTokens: d.numTokens, inputTokens: d.inputTokens ?? s.inputTokens }));
      } else if (d.status === "thinking_complete") {
        if (!interruptedRef.current) onThinkingCompleteRef.current?.(d.thinking);
      } else if (d.status === "complete") {
        if (!interruptedRef.current) onCompleteRef.current?.();
        interruptedRef.current = false;
        setState((s) => ({ ...s, status: "loaded", tps: d.tps, numTokens: d.numTokens }));
      } else if (d.status === "error") {
        interruptedRef.current = false;
        setState((s) => ({ ...s, status: "error", error: d.error }));
      } else if (d.status === "unloaded") {
        setState((s) => ({
          ...s,
          status: "idle",
          loadedModel: null,
          loadedDevice: null,
          loadedPrecision: null,
          loadedSupportsImages: null,
        }));
      }
    };
  }, []);

  const createWorker = useCallback(() => {
    const worker = new Worker(
      new URL("../workers/inference.worker.ts", import.meta.url),
      { type: "module" }
    );
    attachWorker(worker);
    return worker;
  }, [attachWorker]);

  const replaceWorker = useCallback(() => {
    interruptedRef.current = false;
    workerRef.current?.terminate();
    const worker = createWorker();
    workerRef.current = worker;
    setState((s) => ({
      ...s,
      status: "idle",
      loadingMessage: "",
      processingMessage: "",
      progress: new Map(),
      error: null,
      loadedModel: null,
      loadedDevice: null,
      loadedPrecision: null,
      loadedSupportsImages: null,
      tps: 0,
      numTokens: 0,
      inputTokens: 0,
    }));
    return worker;
  }, [createWorker]);

  useEffect(() => {
    workerRef.current = createWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [createWorker]);

  const postMessage = useCallback((msg: WorkerRequest) => {
    workerRef.current?.postMessage(msg);
  }, []);

  const loadModel = useCallback(
    (modelId: string, device: "webgpu" | "wasm") => {
      const current = stateRef.current;
      // Cross-model loads are safer with a fresh worker because ORT/WebGPU
      // resources from a previous session can survive in-process disposal.
      const needsFreshWorker =
        current.status === "loading" ||
        current.status === "processing" ||
        (current.loadedModel !== null && (current.loadedModel !== modelId || current.loadedDevice !== device));

      if (needsFreshWorker) {
        const worker = replaceWorker();
        setState((s) => ({ ...s, progress: new Map(), error: null, status: "loading" }));
        worker.postMessage({ type: "load", modelId, device });
        return;
      }

      setState((s) => ({ ...s, progress: new Map(), error: null }));
      postMessage({ type: "load", modelId, device });
    },
    [postMessage, replaceWorker]
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
    replaceWorker();
  }, [replaceWorker]);

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
    onPromptRef,
    onRawTokenRef,
    onTokenRef,
    onThinkingCompleteRef,
    onCompleteRef,
  };
}
