"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  WorkerResponse,
  WorkerRequest,
  ChatMessage,
  GenerationParams,
  GenerationStats,
  GenerationStopReason,
  ProgressInfo,
  TotalProgressInfo,
  ModelSelection,
  WorkerErrorCode,
  WorkerErrorStage,
} from "@/types";
import { CONTEXT_WINDOWS } from "@/lib/constants";

export type InferenceStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "processing"
  | "generating"
  | "error";

export interface WorkerErrorState {
  message: string;
  code: WorkerErrorCode;
  stage: WorkerErrorStage;
  modelId?: string | null;
  revision?: string | null;
  device?: "webgpu" | "wasm" | null;
}

interface WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  postMessage: (message: WorkerRequest) => void;
  terminate: () => void;
}

declare global {
  interface Window {
    __LLAME_WORKER_FACTORY__?: () => WorkerLike;
  }
}

interface InferenceState {
  status: InferenceStatus;
  loadingMessage: string;
  processingMessage: string;
  progress: Map<string, ProgressInfo>;
  totalProgress: TotalProgressInfo | null;
  error: WorkerErrorState | null;
  loadedModel: string | null;
  loadedRevision: string | null;
  loadedDevice: string | null;
  loadedPrecision: string | null;
  loadedSupportsImages: boolean | null;
  tps: number;
  numTokens: number;
  inputTokens: number;
  generationTime: number;
  stopReason: GenerationStopReason | null;
}

interface UseInferenceWorkerReturn extends InferenceState {
  loadModel: (model: ModelSelection, device: "webgpu" | "wasm") => void;
  generate: (messages: ChatMessage[], params: GenerationParams) => void;
  interrupt: () => void;
  reset: () => void;
  onPromptRef: React.MutableRefObject<((inputText: string) => void) | null>;
  onRawTokenRef: React.MutableRefObject<((token: string) => void) | null>;
  onTokenRef: React.MutableRefObject<((token: string, isThinking?: boolean) => void) | null>;
  onThinkingCompleteRef: React.MutableRefObject<((thinking: string) => void) | null>;
  onCompleteRef: React.MutableRefObject<((stats: GenerationStats) => void) | null>;
  contextFullness: number;
  contextWindow: number;
}

const INITIAL_STATE: InferenceState = {
  status: "idle",
  loadingMessage: "",
  processingMessage: "",
  progress: new Map(),
  totalProgress: null,
  error: null,
  loadedModel: null,
  loadedRevision: null,
  loadedDevice: null,
  loadedPrecision: null,
  loadedSupportsImages: null,
  tps: 0,
  numTokens: 0,
  inputTokens: 0,
  generationTime: 0,
  stopReason: null,
};

export function useInferenceWorker(): UseInferenceWorkerReturn {
  const workerRef = useRef<WorkerLike | null>(null);
  const stateRef = useRef<InferenceState>(INITIAL_STATE);
  const onPromptRef = useRef<((inputText: string) => void) | null>(null);
  const onRawTokenRef = useRef<((token: string) => void) | null>(null);
  const onTokenRef = useRef<((token: string, isThinking?: boolean) => void) | null>(null);
  const onThinkingCompleteRef = useRef<((thinking: string) => void) | null>(null);
  const onCompleteRef = useRef<((stats: GenerationStats) => void) | null>(null);
  const interruptedRef = useRef(false);

  const [state, setState] = useState<InferenceState>(INITIAL_STATE);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const attachWorker = useCallback((worker: WorkerLike) => {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (workerRef.current !== worker) return;

      const response = event.data;

      if (response.status === "ready") {
        setState((current) => ({ ...current, status: "idle" }));
      } else if (response.status === "loading") {
        setState((current) => ({
          ...current,
          status: "loading",
          loadingMessage: response.message,
          error: null,
        }));
      } else if (response.status === "progress") {
        setState((current) => {
          const progress = new Map(current.progress);
          progress.set(response.progress.file, response.progress);
          return { ...current, progress };
        });
      } else if (response.status === "progress_total") {
        setState((current) => ({ ...current, totalProgress: response.progress }));
      } else if (response.status === "loaded") {
        setState((current) => ({
          ...current,
          status: "loaded",
          loadedModel: response.modelId,
          loadedRevision: response.revision ?? null,
          loadedDevice: response.device,
          loadedPrecision: response.precision,
          loadedSupportsImages: response.supportsImages,
          progress: new Map(),
          totalProgress: null,
          error: null,
        }));
      } else if (response.status === "processing") {
        setState((current) => ({ ...current, status: "processing", processingMessage: response.message }));
      } else if (response.status === "generating") {
        interruptedRef.current = false;
        setState((current) => ({
          ...current,
          status: "generating",
          tps: 0,
          numTokens: 0,
          inputTokens: 0,
          generationTime: 0,
          stopReason: null,
          error: null,
        }));
      } else if (response.status === "prompt") {
        if (!interruptedRef.current) onPromptRef.current?.(response.inputText);
      } else if (response.status === "raw_update") {
        if (!interruptedRef.current) onRawTokenRef.current?.(response.token);
      } else if (response.status === "update") {
        if (interruptedRef.current) return;
        onTokenRef.current?.(response.token, response.isThinking);
        setState((current) => ({
          ...current,
          tps: response.tps,
          numTokens: response.numTokens,
          inputTokens: response.inputTokens ?? current.inputTokens,
        }));
      } else if (response.status === "thinking_complete") {
        if (!interruptedRef.current) onThinkingCompleteRef.current?.(response.thinking);
      } else if (response.status === "complete") {
        const stats: GenerationStats = {
          tps: response.tps,
          numTokens: response.numTokens,
          generationTime: response.generationTime,
          stopReason: response.stopReason,
        };
        if (!interruptedRef.current) onCompleteRef.current?.(stats);
        interruptedRef.current = false;
        setState((current) => ({ ...current, status: "loaded", ...stats }));
      } else if (response.status === "error") {
        interruptedRef.current = false;
        setState((current) => ({
          ...current,
          status: "error",
          error: {
            message: response.error,
            code: response.code,
            stage: response.stage,
            modelId: response.modelId,
            revision: response.revision,
            device: response.device,
          },
        }));
      } else if (response.status === "unloaded") {
        setState((current) => ({
          ...current,
          status: "idle",
          loadedModel: null,
          loadedRevision: null,
          loadedDevice: null,
          loadedPrecision: null,
          loadedSupportsImages: null,
        }));
      }
    };
  }, []);

  const createWorker = useCallback((): WorkerLike => {
    if (typeof window !== "undefined" && typeof window.__LLAME_WORKER_FACTORY__ === "function") {
      const worker = window.__LLAME_WORKER_FACTORY__();
      attachWorker(worker);
      return worker;
    }

    const worker = new Worker(
      new URL("../workers/inference.worker.ts", import.meta.url),
      { type: "module" },
    );
    attachWorker(worker);
    return worker;
  }, [attachWorker]);

  const replaceWorker = useCallback(() => {
    interruptedRef.current = false;
    workerRef.current?.terminate();
    const worker = createWorker();
    workerRef.current = worker;
    setState(INITIAL_STATE);
    return worker;
  }, [createWorker]);

  useEffect(() => {
    workerRef.current = createWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [createWorker]);

  const postMessage = useCallback((message: WorkerRequest) => {
    workerRef.current?.postMessage(message);
  }, []);

  const loadModel = useCallback((model: ModelSelection, device: "webgpu" | "wasm") => {
    const current = stateRef.current;
    const needsFreshWorker =
      current.status === "loading" ||
      current.status === "processing" ||
      (
        current.loadedModel !== null &&
        (
          current.loadedModel !== model.id ||
          current.loadedDevice !== device ||
          current.loadedRevision !== (model.revision ?? null)
        )
      );

    const message: WorkerRequest = {
      type: "load",
      modelId: model.id,
      revision: model.revision ?? null,
      device,
    };

    if (needsFreshWorker) {
      const worker = replaceWorker();
      setState((currentState) => ({
        ...currentState,
        progress: new Map(),
        totalProgress: null,
        error: null,
        status: "loading",
      }));
      worker.postMessage(message);
      return;
    }

    setState((currentState) => ({
      ...currentState,
      progress: new Map(),
      totalProgress: null,
      error: null,
    }));
    postMessage(message);
  }, [postMessage, replaceWorker]);

  const generate = useCallback((messages: ChatMessage[], params: GenerationParams) => {
    postMessage({ type: "generate", messages, params });
  }, [postMessage]);

  const interrupt = useCallback(() => {
    interruptedRef.current = true;
    postMessage({ type: "interrupt" });
    setState((current) => (
      current.status === "generating"
        ? { ...current, status: "loaded" }
        : current
    ));
  }, [postMessage]);

  const reset = useCallback(() => {
    replaceWorker();
  }, [replaceWorker]);

  const { loadedModel, inputTokens, ...restState } = state;
  const contextWindow = useMemo(() => {
    if (!loadedModel) return 0;
    return CONTEXT_WINDOWS[loadedModel] || 32768;
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
