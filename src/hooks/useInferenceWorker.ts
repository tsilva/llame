"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  WorkerResponse,
  WorkerRequest,
  ChatMessage,
  GenerationParams,
  ProgressInfo,
} from "@/types";

export type InferenceStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "generating"
  | "error";

interface InferenceState {
  status: InferenceStatus;
  loadingMessage: string;
  progress: Map<string, ProgressInfo>;
  error: string | null;
  loadedModel: string | null;
  loadedDevice: string | null;
  tps: number;
  numTokens: number;
}

interface UseInferenceWorkerReturn extends InferenceState {
  loadModel: (modelId: string, device: "webgpu" | "wasm") => void;
  generate: (messages: ChatMessage[], params: GenerationParams) => void;
  interrupt: () => void;
  reset: () => void;
  onTokenRef: React.MutableRefObject<((token: string, isThinking?: boolean) => void) | null>;
  onThinkingCompleteRef: React.MutableRefObject<((thinking: string) => void) | null>;
  onCompleteRef: React.MutableRefObject<(() => void) | null>;
}

export function useInferenceWorker(): UseInferenceWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const onTokenRef = useRef<((token: string, isThinking?: boolean) => void) | null>(null);
  const onThinkingCompleteRef = useRef<((thinking: string) => void) | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);

  const [state, setState] = useState<InferenceState>({
    status: "idle",
    loadingMessage: "",
    progress: new Map(),
    error: null,
    loadedModel: null,
    loadedDevice: null,
    tps: 0,
    numTokens: 0,
  });

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
            progress: new Map(),
            error: null,
          }));
          break;

        case "generating":
          setState((s) => ({
            ...s,
            status: "generating",
            tps: 0,
            numTokens: 0,
          }));
          break;

        case "update":
          onTokenRef.current?.(data.token, data.isThinking);
          setState((s) => ({
            ...s,
            tps: data.tps,
            numTokens: data.numTokens,
          }));
          break;

        case "thinking_complete":
          onThinkingCompleteRef.current?.(data.thinking);
          break;

        case "complete":
          onCompleteRef.current?.();
          setState((s) => ({
            ...s,
            status: "loaded",
            tps: data.tps,
            numTokens: data.numTokens,
          }));
          break;

        case "error":
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

  return {
    ...state,
    loadModel,
    generate,
    interrupt,
    reset,
    onTokenRef,
    onThinkingCompleteRef,
    onCompleteRef,
  };
}
