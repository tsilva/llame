"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage as ChatMessageType, GenerationParams } from "@/types";
import { DEFAULT_MODEL, DEFAULT_PARAMS } from "@/lib/constants";
import { useWebGPU } from "@/hooks/useWebGPU";
import { useInferenceWorker } from "@/hooks/useInferenceWorker";
import { StatusBar } from "@/components/StatusBar";
import { ProgressOverlay } from "@/components/ProgressOverlay";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ChatInterface } from "@/components/ChatInterface";
import { ModelSelector } from "@/components/ModelSelector";
import { SettingsPanel } from "@/components/SettingsPanel";

export default function Home() {
  const webgpu = useWebGPU();
  const worker = useInferenceWorker();

  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const [device, setDevice] = useState<"webgpu" | "wasm">("webgpu");
  const [error, setError] = useState<string | null>(null);

  const streamingContentRef = useRef("");
  const streamingThinkingRef = useRef("");
  const isCompleteRef = useRef(false);

  // Set device based on WebGPU availability
  useEffect(() => {
    if (webgpu.supported === false) {
      setDevice("wasm");
    }
  }, [webgpu.supported]);

  // Auto-load default model when worker is ready
  const hasAutoLoaded = useRef(false);
  useEffect(() => {
    if (
      worker.status === "idle" &&
      !hasAutoLoaded.current &&
      webgpu.checking === false
    ) {
      hasAutoLoaded.current = true;
      const d = webgpu.supported ? "webgpu" : "wasm";
      setDevice(d);
      worker.loadModel(DEFAULT_MODEL, d);
    }
  }, [worker.status, webgpu.checking, webgpu.supported, worker]);

  // Sync worker errors
  useEffect(() => {
    if (worker.error) {
      setError(worker.error);
    }
  }, [worker.error]);

  // Token streaming handler
  // eslint-disable-next-line react-hooks/immutability
  worker.onTokenRef.current = useCallback(
    (token: string, isThinking?: boolean) => {
      if (isThinking) {
        streamingThinkingRef.current += token;
        const thinking = streamingThinkingRef.current;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, thinking }];
          }
          return prev;
        });
      } else {
        streamingContentRef.current += token;
        const content = streamingContentRef.current;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, content }];
          }
          return prev;
        });
      }
    },
    []
  );

  // Thinking complete handler
  // eslint-disable-next-line react-hooks/immutability
  worker.onThinkingCompleteRef.current = useCallback((thinking: string) => {
    streamingThinkingRef.current = thinking;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") {
        return [...prev.slice(0, -1), { ...last, thinking }];
      }
      return prev;
    });
  }, []);

  // eslint-disable-next-line react-hooks/immutability
  worker.onCompleteRef.current = useCallback(() => {
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    isCompleteRef.current = true;
  }, []);

  const handleSend = useCallback(
    (content: string) => {
      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };
      const assistantMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      isCompleteRef.current = false;

      const newMessages = [...messages, userMsg, assistantMsg];
      setMessages(newMessages);

      // Send all messages except the empty assistant placeholder
      worker.generate(
        newMessages.filter((m) => m.content.length > 0),
        params
      );
    },
    [messages, params, worker]
  );

  const handleStop = useCallback(() => {
    worker.interrupt();
  }, [worker]);

  const handleLoadModel = useCallback(
    (modelId: string) => {
      setError(null);
      worker.loadModel(modelId, device);
    },
    [device, worker]
  );

  const handleDeviceChange = useCallback(
    (d: "webgpu" | "wasm") => {
      setDevice(d);
      // If a model is loaded, reload with new device
      if (worker.loadedModel) {
        setError(null);
        worker.loadModel(worker.loadedModel, d);
      }
    },
    [worker]
  );

  const isLoading = worker.status === "loading";
  const isGenerating = worker.status === "generating";
  const isModelLoaded =
    worker.status === "loaded" || worker.status === "generating";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0a]">
      <StatusBar
        webgpuSupported={webgpu.supported}
        loadedModel={worker.loadedModel}
        loadedDevice={worker.loadedDevice}
        tps={worker.tps}
        numTokens={worker.numTokens}
        isGenerating={isGenerating}
      />

      {error && (
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      )}

      <div className="relative flex flex-1 overflow-hidden">
        {isLoading && (
          <ProgressOverlay
            progress={worker.progress}
            message={worker.loadingMessage}
          />
        )}

        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 space-y-6 overflow-y-auto border-r border-white/10 bg-[#0e0e0e] p-4 scrollbar-thin">
          <ModelSelector
            onLoad={handleLoadModel}
            loadedModel={worker.loadedModel}
            isLoading={isLoading}
            disabled={isGenerating}
          />

          <SettingsPanel
            params={params}
            onChange={setParams}
            device={device}
            onDeviceChange={handleDeviceChange}
            webgpuAvailable={webgpu.supported ?? false}
          />

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              disabled={isGenerating}
              className="w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-400 hover:border-white/20 transition-colors disabled:opacity-40"
            >
              Clear chat
            </button>
          )}
        </div>

        {/* Main chat area */}
        <ChatInterface
          messages={messages}
          isGenerating={isGenerating}
          isModelLoaded={isModelLoaded}
          onSend={handleSend}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
