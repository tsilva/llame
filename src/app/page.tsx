"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage as ChatMessageType, Conversation, GenerationParams } from "@/types";
import {
  DEFAULT_PARAMS,
  DEFAULT_MODEL,
  canToggleThinking,
  getEffectiveThinkingEnabled,
  isVlmModel,
} from "@/lib/constants";
import { useInferenceWorker } from "@/hooks/useInferenceWorker";
import { useStorage } from "@/hooks/useStorage";
import { ChatInterface } from "@/components/ChatInterface";
import { ModelBrowserModal } from "@/components/ModelBrowserModal";
import { ModelSelector } from "@/components/ModelSelector";
import { Sidebar } from "@/components/Sidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { PanelLeft, Github, X, Code2 } from "lucide-react";

interface PendingGeneration {
  conversationId: string;
  modelId: string;
  device: "webgpu" | "wasm";
}

export default function Home() {
  const [webgpuSupported, setWebgpuSupported] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      if (!navigator.gpu) { setWebgpuSupported(false); return; }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        setWebgpuSupported(!!adapter);
      } catch { setWebgpuSupported(false); }
    })();
  }, []);
  const worker = useInferenceWorker();
  const storage = useStorage();

  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(null);

  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const [device, setDevice] = useState<"webgpu" | "wasm">("webgpu");
  const [lastSelectedModel, setLastSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelBrowserOpen, setModelBrowserOpen] = useState(false);
  const [showRawConversation, setShowRawConversation] = useState(false);

  // Load thinking preference from localStorage
  useEffect(() => {
    const savedThinking = localStorage.getItem("llame-thinking-enabled");
    if (savedThinking !== null) {
      setParams((prev) => ({ ...prev, thinkingEnabled: savedThinking === "true" }));
    }

    const savedRawView = localStorage.getItem("llame-raw-conversation");
    if (savedRawView !== null) {
      setShowRawConversation(savedRawView === "true");
    }
  }, []);

  // Save thinking preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("llame-thinking-enabled", params.thinkingEnabled.toString());
  }, [params.thinkingEnabled]);

  useEffect(() => {
    localStorage.setItem("llame-raw-conversation", showRawConversation.toString());
  }, [showRawConversation]);

  const streamingContentRef = useRef("");
  const streamingThinkingRef = useRef("");
  const streamingRawOutputRef = useRef("");
  const isCompleteRef = useRef(false);
  const [thinkingComplete, setThinkingComplete] = useState(false);
  const activeConversationIdRef = useRef<string | null>(null);

  const updateLastAssistantMessage = useCallback(
    (updater: (message: ChatMessageType) => ChatMessageType) => {
      const conv = storage.activeConversation;
      if (!conv) return;

      const last = conv.messages[conv.messages.length - 1];
      if (last?.role !== "assistant") return;

      const updatedMessages = [...conv.messages.slice(0, -1), updater(last)];
      storage.updateConversation({ ...conv, messages: updatedMessages, updatedAt: Date.now() });
    },
    [storage]
  );

  // Sync ref with state
  useEffect(() => {
    activeConversationIdRef.current = storage.activeConversationId;
  }, [storage.activeConversationId]);

  // Always start with a new chat on page load, unless an empty one exists
  useEffect(() => {
    if (!storage.activeConversationId) {
      // Get most recent conversation to check if it's empty
      const sortedConvs = [...storage.index].sort((a, b) => b.updatedAt - a.updatedAt);
      const lastConv = sortedConvs[0];
      
      // Reuse last chat if it has no messages, otherwise create new
      if (lastConv && lastConv.messageCount === 0) {
        storage.setActiveConversation(lastConv.id);
      } else {
        // Create new conversation directly without callback
        storage.createConversation(lastSelectedModel);
        if (isMobile) setSidebarOpen(false);
      }
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
    if (webgpuSupported === false) {
      setDevice("wasm");
    }
  }, [webgpuSupported]);

  useEffect(() => {
    if (worker.error) {
      setPendingGeneration(null);
      setError(worker.error);
    }
  }, [worker.error]);

  // Handle pending generation after model loads
  useEffect(() => {
    if (
      pendingGeneration &&
      worker.status === "loaded" &&
      worker.loadedModel === pendingGeneration.modelId &&
      worker.loadedDevice === pendingGeneration.device &&
      storage.activeConversation?.id === pendingGeneration.conversationId
    ) {
      setPendingGeneration(null);

      const assistantMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        debug: {
          modelInput: "",
          rawOutput: "",
        },
      };

      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      streamingRawOutputRef.current = "";
      isCompleteRef.current = false;
      setThinkingComplete(false);

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
  }, [pendingGeneration, worker.status, worker.loadedModel, worker.loadedDevice, params, storage, worker]);

  // eslint-disable-next-line react-hooks/immutability
  worker.onPromptRef.current = useCallback((inputText: string) => {
    updateLastAssistantMessage((last) => ({
      ...last,
      debug: {
        ...last.debug,
        modelInput: inputText,
      },
    }));
  }, [updateLastAssistantMessage]);

  // eslint-disable-next-line react-hooks/immutability
  worker.onRawTokenRef.current = useCallback((token: string) => {
    streamingRawOutputRef.current += token;
    const rawOutput = streamingRawOutputRef.current;

    updateLastAssistantMessage((last) => ({
      ...last,
      debug: {
        ...last.debug,
        rawOutput,
      },
    }));
  }, [updateLastAssistantMessage]);

  // eslint-disable-next-line react-hooks/immutability
  worker.onTokenRef.current = useCallback(
    (token: string, isThinking?: boolean) => {
      if (isThinking) {
        streamingThinkingRef.current += token;
        const thinking = streamingThinkingRef.current;
        updateLastAssistantMessage((last) => ({ ...last, thinking }));
      } else {
        streamingContentRef.current += token;
        const content = streamingContentRef.current;
        updateLastAssistantMessage((last) => ({ ...last, content }));
      }
    },
    [updateLastAssistantMessage]
  );

  // eslint-disable-next-line react-hooks/immutability
  worker.onThinkingCompleteRef.current = useCallback((thinking: string) => {
    streamingThinkingRef.current = thinking;
    setThinkingComplete(true);
    updateLastAssistantMessage((last) => ({ ...last, thinking }));
  }, [updateLastAssistantMessage]);

  // eslint-disable-next-line react-hooks/immutability
  worker.onCompleteRef.current = useCallback(() => {
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    streamingRawOutputRef.current = "";
    isCompleteRef.current = true;
    storage.flushPendingSave();
  }, [storage]);

  const createNewConversation = useCallback(() => {
    if (worker.status === "generating") {
      worker.interrupt();
      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      streamingRawOutputRef.current = "";
      isCompleteRef.current = true;
    }
    const newConv = storage.createConversation(lastSelectedModel);
    if (isMobile) setSidebarOpen(false);
    return newConv;
  }, [isMobile, worker, storage, lastSelectedModel]);

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
        modelId: activeConv.modelId || DEFAULT_MODEL,
      };
      storage.updateConversation(updatedConv);

      const needsLoad = worker.status === "idle" || worker.status === "error";
      const needsSwitch = worker.loadedModel && worker.loadedModel !== updatedConv.modelId;

      if (needsLoad || needsSwitch) {
        setPendingGeneration({
          conversationId: updatedConv.id,
          modelId: updatedConv.modelId,
          device,
        });
        setError(null);
        worker.loadModel(updatedConv.modelId, device);
      } else if (worker.status === "loaded") {
        const assistantMsg: ChatMessageType = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          debug: {
            modelInput: "",
            rawOutput: "",
          },
        };

        streamingContentRef.current = "";
        streamingThinkingRef.current = "";
        streamingRawOutputRef.current = "";
        isCompleteRef.current = false;
        setThinkingComplete(false);

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
    streamingRawOutputRef.current = "";
    isCompleteRef.current = true;
  }, [worker]);

  const handleToggleThinking = useCallback(() => {
    const modelId = storage.activeConversation?.modelId || DEFAULT_MODEL;
    if (!canToggleThinking(modelId)) return;
    setParams((prev) => ({ ...prev, thinkingEnabled: !prev.thinkingEnabled }));
  }, [storage.activeConversation?.modelId]);

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

  const handleModelChange = useCallback(
    (modelId: string) => {
      setLastSelectedModel(modelId);
      setPendingGeneration(null);
      if (storage.activeConversation) {
        const updatedConv = { ...storage.activeConversation, modelId };
        storage.updateConversation(updatedConv);
      }
      // If a model is already loaded and it's different, unload it so next message loads new model
      if (worker.loadedModel && worker.loadedModel !== modelId) {
        worker.reset();
      }
    },
    [storage, worker]
  );

  const handleSwitchConversation = (id: string) => {
    setPendingGeneration(null);
    if (worker.status === "generating") {
      worker.interrupt();
      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      streamingRawOutputRef.current = "";
      isCompleteRef.current = true;
    }
    storage.setActiveConversation(id);
    // Update lastSelectedModel to the model of the conversation we're switching to
    const conv = storage.index.find((c) => c.id === id);
    if (conv) {
      setLastSelectedModel(conv.modelId);
    }
    if (isMobile) setSidebarOpen(false);
  };

  const isLoading = worker.status === "loading";
  const isProcessing = worker.status === "processing";
  const isGenerating = worker.status === "generating";
  const isModelLoaded = worker.status === "loaded" || worker.status === "generating";
  const activeModelId = storage.activeConversation?.modelId || DEFAULT_MODEL;
  const allowImageInputs = worker.loadedModel === activeModelId
    ? worker.loadedSupportsImages ?? isVlmModel(activeModelId)
    : isVlmModel(activeModelId);
  const thinkingEnabled = getEffectiveThinkingEnabled(activeModelId, params.thinkingEnabled);
  const showThinkingToggle = canToggleThinking(activeModelId);

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
      />

      {/* Main area */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2">
          {(!sidebarOpen || isMobile) && (
            <button
              onClick={() => setSidebarOpen(true)}
              disabled={isGenerating}
              className="rounded-lg p-2 text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PanelLeft size={20} />
            </button>
          )}
          <ModelSelector
            loadedModel={worker.loadedModel}
            loadedPrecision={worker.loadedPrecision}
            isLoading={isLoading}
            device={device}
            webgpuSupported={webgpuSupported}
            modelId={activeModelId}
            onModelChange={handleModelChange}
            onOpenModelBrowser={() => setModelBrowserOpen(true)}
            isGenerating={isGenerating}
          />
          <div className="ml-auto flex items-center gap-2">
            {isGenerating && worker.tps > 0 && (
              <span className="text-xs font-mono text-[#8e8e8e]">
                {worker.tps.toFixed(1)} t/s
              </span>
            )}
            <button
              onClick={() => setShowRawConversation((prev) => !prev)}
              className={`rounded-full p-2 transition-colors ${
                showRawConversation
                  ? "bg-[#2f2f2f] text-[#b4b4b4]"
                  : "text-[#6f6f6f] hover:bg-[#2f2f2f] hover:text-[#9a9a9a]"
              }`}
              aria-label={showRawConversation ? "Show formatted conversation" : "Show raw conversation"}
              title={showRawConversation ? "Show formatted conversation" : "Show raw conversation"}
            >
              <Code2 size={18} />
            </button>
            <a
              href="https://github.com/tsilva/llame"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full p-2 text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors"
              aria-label="GitHub repository"
            >
              <Github size={20} />
            </a>
          </div>
        </div>

        {error && (
          <div className="mx-3 mb-2 flex items-start gap-2 sm:gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 sm:px-4 sm:py-3">
            <span className="mt-0.5 text-red-400">&#x26A0;</span>
            <p className="flex-1 text-sm text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        <ChatInterface
          key={storage.activeConversationId || "no-conversation"}
          conversationId={storage.activeConversationId}
          messages={currentMessages}
          isGenerating={isGenerating}
          isProcessing={isProcessing}
          processingMessage={worker.processingMessage}
          isModelLoaded={isModelLoaded}
          modelId={activeModelId}
          isLoading={isLoading}
          loadingProgress={worker.progress}
          loadingMessage={worker.loadingMessage}
          onSend={handleSend}
          onStop={handleStop}
          tps={worker.tps}
          numTokens={worker.numTokens}
          device={worker.loadedDevice}
          isMobile={isMobile}
          allowImageInputs={allowImageInputs}
          thinkingComplete={thinkingComplete}
          thinkingEnabled={thinkingEnabled}
          showThinkingToggle={showThinkingToggle}
          onToggleThinking={handleToggleThinking}
          showRawConversation={showRawConversation}
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
        webgpuAvailable={webgpuSupported ?? false}
        storageStats={storage.storageStats}
        conversationsCount={storage.index.length}
        onClearAllChats={() => {
          storage.clearAllChats();
        }}
        isGenerating={isGenerating}
      />

      <ModelBrowserModal
        isOpen={modelBrowserOpen}
        onClose={() => setModelBrowserOpen(false)}
        onSelectModel={(modelId) => {
          handleModelChange(modelId);
          setModelBrowserOpen(false);
        }}
        currentModelId={activeModelId}
        device={device}
        webgpuSupported={webgpuSupported}
        disabled={isLoading || isGenerating}
      />
    </div>
  );
}
