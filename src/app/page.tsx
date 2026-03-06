"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage as ChatMessageType, GenerationParams } from "@/types";
import { DEFAULT_PARAMS } from "@/lib/constants";
import { useWebGPU } from "@/hooks/useWebGPU";
import { useInferenceWorker } from "@/hooks/useInferenceWorker";
import { ProgressOverlay } from "@/components/ProgressOverlay";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ChatInterface } from "@/components/ChatInterface";
import { ModelSelector } from "@/components/ModelSelector";
import { Sidebar } from "@/components/Sidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { PanelLeft } from "lucide-react";

export default function Home() {
  const webgpu = useWebGPU();
  const worker = useInferenceWorker();

  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const [device, setDevice] = useState<"webgpu" | "wasm">("webgpu");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const streamingContentRef = useRef("");
  const streamingThinkingRef = useRef("");
  const isCompleteRef = useRef(false);

  useEffect(() => {
    if (webgpu.supported === false) {
      setDevice("wasm");
    }
  }, [webgpu.supported]);

  useEffect(() => {
    if (worker.error) {
      setError(worker.error);
    }
  }, [worker.error]);

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
    (content: string, images?: string[]) => {
      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        images,
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

      worker.generate(
        newMessages.filter(
          (m) => m.content.length > 0 || (m.images && m.images.length > 0)
        ),
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
    <div className="flex h-screen overflow-hidden bg-[#212121]">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={() => setMessages([])}
        onOpenSettings={() => setSettingsOpen(true)}
        onClearChat={() => setMessages([])}
        modelId={worker.loadedModel}
        onLoadModel={handleLoadModel}
        isLoading={isLoading}
        isGenerating={isGenerating}
        device={device}
        webgpuSupported={webgpu.supported}
      />

      {/* Main area */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors"
            >
              <PanelLeft size={20} />
            </button>
          )}
          <ModelSelector
            onLoad={handleLoadModel}
            loadedModel={worker.loadedModel}
            isLoading={isLoading}
            disabled={isGenerating}
          />
          {isGenerating && worker.tps > 0 && (
            <span className="ml-auto text-xs font-mono text-[#8e8e8e]">
              {worker.tps.toFixed(1)} t/s
            </span>
          )}
        </div>

        {error && (
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
        )}

        {isLoading && (
          <ProgressOverlay
            progress={worker.progress}
            message={worker.loadingMessage}
          />
        )}

        <ChatInterface
          messages={messages}
          isGenerating={isGenerating}
          isModelLoaded={isModelLoaded}
          onSend={handleSend}
          onStop={handleStop}
          tps={worker.tps}
          numTokens={worker.numTokens}
          loadedModel={worker.loadedModel}
          device={worker.loadedDevice}
        />
      </div>

      {/* Settings modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        params={params}
        onChange={setParams}
        device={device}
        onDeviceChange={handleDeviceChange}
        webgpuAvailable={webgpu.supported ?? false}
      />
    </div>
  );
}
