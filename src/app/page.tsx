"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage as ChatMessageType, Conversation, GenerationParams } from "@/types";
import { DEFAULT_PARAMS, DEFAULT_MODEL } from "@/lib/constants";
import { useWebGPU } from "@/hooks/useWebGPU";
import { useInferenceWorker } from "@/hooks/useInferenceWorker";
import { useStorage } from "@/hooks/useStorage";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ChatInterface } from "@/components/ChatInterface";
import { ModelSelector } from "@/components/ModelSelector";
import { Sidebar } from "@/components/Sidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { PanelLeft } from "lucide-react";

export default function Home() {
  const webgpu = useWebGPU();
  const worker = useInferenceWorker();
  const storage = useStorage();

  const [pendingGeneration, setPendingGeneration] = useState<{ content: string; images?: string[] } | null>(null);

  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const [device, setDevice] = useState<"webgpu" | "wasm">("webgpu");
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const streamingContentRef = useRef("");
  const streamingThinkingRef = useRef("");
  const isCompleteRef = useRef(false);
  const activeConversationIdRef = useRef<string | null>(null);

  // Sync ref with state
  useEffect(() => {
    activeConversationIdRef.current = storage.activeConversationId;
  }, [storage.activeConversationId]);

  // Always start with a new chat on page load
  useEffect(() => {
    if (!storage.activeConversationId) {
      createNewConversation();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track mobile breakpoint
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (e.matches) setSidebarOpen(false);
    };
    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

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

  // Handle pending generation after model loads
  useEffect(() => {
    if (pendingGeneration && worker.status === "loaded") {
      setPendingGeneration(null);

      const assistantMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      isCompleteRef.current = false;

      if (storage.activeConversation) {
        const newMessages = [...storage.activeConversation.messages, assistantMsg];
        const updatedConv = { ...storage.activeConversation, messages: newMessages, updatedAt: Date.now() };
        storage.updateConversation(updatedConv);

        worker.generate(
          newMessages.filter(
            (m) => m.content.length > 0 || (m.images && m.images.length > 0)
          ),
          params
        );
      }
    }
  }, [pendingGeneration, worker.status, params, worker, storage]);

  // eslint-disable-next-line react-hooks/immutability
  worker.onTokenRef.current = useCallback(
    (token: string, isThinking?: boolean) => {
      if (isThinking) {
        streamingThinkingRef.current += token;
        const thinking = streamingThinkingRef.current;

        const conv = storage.activeConversation;
        if (!conv) return;
        const last = conv.messages[conv.messages.length - 1];
        if (last?.role === "assistant") {
          const updatedMessages = [...conv.messages.slice(0, -1), { ...last, thinking }];
          storage.updateConversation({ ...conv, messages: updatedMessages, updatedAt: Date.now() });
        }
      } else {
        streamingContentRef.current += token;
        const content = streamingContentRef.current;

        const conv = storage.activeConversation;
        if (!conv) return;
        const last = conv.messages[conv.messages.length - 1];
        if (last?.role === "assistant") {
          const updatedMessages = [...conv.messages.slice(0, -1), { ...last, content }];
          storage.updateConversation({ ...conv, messages: updatedMessages, updatedAt: Date.now() });
        }
      }
    },
    [storage]
  );

  // eslint-disable-next-line react-hooks/immutability
  worker.onThinkingCompleteRef.current = useCallback((thinking: string) => {
    streamingThinkingRef.current = thinking;

    const conv = storage.activeConversation;
    if (!conv) return;
    const last = conv.messages[conv.messages.length - 1];
    if (last?.role === "assistant") {
      const updatedMessages = [...conv.messages.slice(0, -1), { ...last, thinking }];
      storage.updateConversation({ ...conv, messages: updatedMessages, updatedAt: Date.now() });
    }
  }, [storage]);

  // eslint-disable-next-line react-hooks/immutability
  worker.onCompleteRef.current = useCallback(() => {
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    isCompleteRef.current = true;
    storage.flushPendingSave();
  }, [storage]);

  const createNewConversation = useCallback(() => {
    if (worker.status === "generating") {
      worker.interrupt();
      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      isCompleteRef.current = true;
    }
    const newConv = storage.createConversation();
    if (isMobile) setSidebarOpen(false);
    return newConv;
  }, [isMobile, worker, storage]);

  const deleteConversation = (id: string) => {
    storage.deleteConversation(id);
  };

  const handleSend = useCallback(
    (content: string, images?: string[]) => {
      let activeConv = storage.activeConversation;
      if (!activeConv) {
        activeConv = createNewConversation();
      }

      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        images,
      };

      const updatedMessages = [...activeConv.messages, userMsg];

      // Update title from first user message
      let title = activeConv.title;
      if (title === "New chat") {
        title = content.slice(0, 50) || "New chat";
        if (content.length > 50) title += "...";
      }

      const updatedConv: Conversation = {
        ...activeConv,
        messages: updatedMessages,
        title,
        updatedAt: Date.now(),
        modelId: DEFAULT_MODEL,
      };
      storage.updateConversation(updatedConv);

      const needsLoad = worker.status === "idle" || worker.status === "error";
      const needsSwitch = worker.loadedModel && worker.loadedModel !== DEFAULT_MODEL;

      if (needsLoad || needsSwitch) {
        setPendingGeneration({ content, images });
        setError(null);
        worker.loadModel(DEFAULT_MODEL, device);
      } else if (worker.status === "loaded") {
        const assistantMsg: ChatMessageType = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
        };

        streamingContentRef.current = "";
        streamingThinkingRef.current = "";
        isCompleteRef.current = false;

        const newMessages = [...updatedMessages, assistantMsg];
        storage.updateConversation({ ...updatedConv, messages: newMessages, updatedAt: Date.now() });

        worker.generate(
          newMessages.filter(
            (m) => m.content.length > 0 || (m.images && m.images.length > 0)
          ),
          params
        );
      }
    },
    [storage, worker, device, params, createNewConversation]
  );

  const handleStop = useCallback(() => {
    worker.interrupt();
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    isCompleteRef.current = true;
  }, [worker]);

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

  const handleSwitchConversation = (id: string) => {
    if (worker.status === "generating") {
      worker.interrupt();
      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      isCompleteRef.current = true;
    }
    storage.setActiveConversation(id);
    if (isMobile) setSidebarOpen(false);
  };

  const isLoading = worker.status === "loading";
  const isGenerating = worker.status === "generating";
  const isModelLoaded = worker.status === "loaded" || worker.status === "generating";

  const currentMessages = storage.activeConversation?.messages || [];

  return (
    <div className="flex h-dvh overflow-hidden bg-[#212121]">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        isMobile={isMobile}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={createNewConversation}
        onOpenSettings={() => setSettingsOpen(true)}
        conversations={storage.index}
        activeConversationId={storage.activeConversationId}
        onSwitchConversation={handleSwitchConversation}
        onDeleteConversation={deleteConversation}
        isLoading={isLoading}
        isGenerating={isGenerating}
        device={device}
        webgpuSupported={webgpu.supported}
        storageStats={storage.storageStats}
        storageWarning={storage.storageWarning}
        onClearOldChats={storage.clearOldChats}
      />

      {/* Main area */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2">
          {(!sidebarOpen || isMobile) && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors"
            >
              <PanelLeft size={20} />
            </button>
          )}
          <ModelSelector
            loadedModel={worker.loadedModel}
            loadedPrecision={worker.loadedPrecision}
            isLoading={isLoading}
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

        <ChatInterface
          messages={currentMessages}
          isGenerating={isGenerating}
          isModelLoaded={isModelLoaded}
          loadedModel={worker.loadedModel}
          isLoading={isLoading}
          loadingProgress={worker.progress}
          loadingMessage={worker.loadingMessage}
          onSend={handleSend}
          onStop={handleStop}
          tps={worker.tps}
          numTokens={worker.numTokens}
          device={worker.loadedDevice}
          isMobile={isMobile}
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
        contextFullness={worker.contextFullness}
        isModelLoaded={isModelLoaded}
        conversationsCount={storage.index.length}
        onClearAllChats={() => {
          storage.clearAllChats();
        }}
      />
    </div>
  );
}
