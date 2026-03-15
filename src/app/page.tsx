"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  ChatMessage as ChatMessageType,
  Conversation,
  GenerationParams,
  ModelSelection,
} from "@/types";
import {
  DEFAULT_MODEL,
  DEFAULT_PARAMS,
  canToggleThinking,
  getEffectiveThinkingEnabled,
  getDefaultModelSelectionForDevice,
  getModelSelection,
  isVlmModel,
} from "@/lib/constants";
import { useInferenceWorker } from "@/hooks/useInferenceWorker";
import { useStorage } from "@/hooks/useStorage";
import { trackProductEvent, captureTelemetryError } from "@/lib/telemetry";
import { ChatInterface } from "@/components/ChatInterface";
import { ModelBrowserModal } from "@/components/ModelBrowserModal";
import { ModelSelector } from "@/components/ModelSelector";
import { Sidebar } from "@/components/Sidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { PanelLeft, Github, X, Code2 } from "lucide-react";

interface PendingGeneration {
  conversationId: string;
  model: ModelSelection;
  device: "webgpu" | "wasm";
  reuseLastAssistant?: boolean;
}

function createAssistantMessage(): ChatMessageType {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "",
    debug: {
      modelInput: "",
      rawOutput: "",
    },
  };
}

function buildModelSelectionFromConversation(conversation: Conversation | null): ModelSelection {
  if (!conversation) {
    return getModelSelection(DEFAULT_MODEL);
  }

  return getModelSelection(conversation.modelId, {
    revision: conversation.modelRevision ?? null,
    supportsImages: conversation.modelSupportsImages ?? null,
    recommendedDevice: conversation.recommendedDevice,
    supportTier: conversation.supportTier,
  });
}

function shouldPreferWasmFallbackModel(model: ModelSelection) {
  return model.supportsImages ?? isVlmModel(model.id);
}

export default function Home() {
  const [webgpuSupported, setWebgpuSupported] = useState<boolean | null>(null);
  const worker = useInferenceWorker();
  const storage = useStorage();

  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(null);
  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const [device, setDevice] = useState<"webgpu" | "wasm">("webgpu");
  const [lastSelectedModel, setLastSelectedModel] = useState<ModelSelection>(getModelSelection(DEFAULT_MODEL));
  const [dismissedWorkerErrorKey, setDismissedWorkerErrorKey] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelBrowserOpen, setModelBrowserOpen] = useState(false);
  const [showRawConversation, setShowRawConversation] = useState(false);
  const [thinkingComplete, setThinkingComplete] = useState(false);

  const streamingContentRef = useRef("");
  const streamingThinkingRef = useRef("");
  const streamingRawOutputRef = useRef("");
  const activeConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!navigator.gpu) {
        setWebgpuSupported(false);
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        setWebgpuSupported(Boolean(adapter));
      } catch {
        setWebgpuSupported(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (webgpuSupported === false) {
      setDevice("wasm");
      captureTelemetryError("WebGPU unavailable", { webgpu_supported: false });
      trackProductEvent("browser_webgpu_unavailable", {});
    }
  }, [webgpuSupported]);

  useEffect(() => {
    if (webgpuSupported !== false) return;

    const fallbackModel = getDefaultModelSelectionForDevice("wasm");

    setLastSelectedModel((current) => (
      shouldPreferWasmFallbackModel(current) ? fallbackModel : current
    ));

    const conversation = storage.activeConversation;
    if (!conversation || conversation.messages.length > 0) return;

    const conversationModel = buildModelSelectionFromConversation(conversation);
    if (!shouldPreferWasmFallbackModel(conversationModel)) return;

    storage.updateConversation({
      ...conversation,
      modelId: fallbackModel.id,
      modelRevision: fallbackModel.revision ?? null,
      modelSupportsImages: fallbackModel.supportsImages ?? null,
      recommendedDevice: fallbackModel.recommendedDevice,
      supportTier: fallbackModel.supportTier,
      updatedAt: Date.now(),
    });
  }, [storage, storage.activeConversation, webgpuSupported]);

  useEffect(() => {
    const savedThinking = localStorage.getItem("llame-thinking-enabled");
    if (savedThinking !== null) {
      setParams((current) => ({ ...current, thinkingEnabled: savedThinking === "true" }));
    }

    const savedRawView = localStorage.getItem("llame-raw-conversation");
    if (savedRawView !== null) {
      setShowRawConversation(savedRawView === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("llame-thinking-enabled", params.thinkingEnabled.toString());
  }, [params.thinkingEnabled]);

  useEffect(() => {
    localStorage.setItem("llame-raw-conversation", showRawConversation.toString());
  }, [showRawConversation]);

  useEffect(() => {
    activeConversationIdRef.current = storage.activeConversationId;
  }, [storage.activeConversationId]);

  const updateLastAssistantMessage = useCallback((updater: (message: ChatMessageType) => ChatMessageType) => {
    const conversation = storage.activeConversation;
    if (!conversation) return;

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage?.role !== "assistant") return;

    const updatedMessages = [...conversation.messages.slice(0, -1), updater(lastMessage)];
    storage.updateConversation({ ...conversation, messages: updatedMessages, updatedAt: Date.now() });
  }, [storage]);

  useEffect(() => {
    if (!storage.ready) return;
    if (storage.activeConversationId) return;

    const sortedConversations = [...storage.index].sort((left, right) => right.updatedAt - left.updatedAt);
    const lastConversation = sortedConversations[0];

    if (lastConversation && lastConversation.messageCount === 0) {
      storage.setActiveConversation(lastConversation.id);
      return;
    }

    const conversation = storage.createConversation(lastSelectedModel);
    setLastSelectedModel(buildModelSelectionFromConversation(conversation));
    if (isMobile) setSidebarOpen(false);
  }, [isMobile, lastSelectedModel, storage]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = (query: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(query.matches);
      if (query.matches) setSidebarOpen(false);
    };
    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!worker.error) return;

    captureTelemetryError(worker.error.message, {
      worker_code: worker.error.code,
      worker_stage: worker.error.stage,
      model_id: worker.error.modelId ?? storage.activeConversation?.modelId ?? null,
      model_revision: worker.error.revision ?? storage.activeConversation?.modelRevision ?? null,
      device: worker.error.device ?? device,
      has_images: storage.activeConversation?.messages.some((message) => Boolean(message.images?.length)) ?? false,
      webgpu_supported: webgpuSupported,
    });
  }, [device, storage.activeConversation, webgpuSupported, worker.error]);

  useEffect(() => {
    if (!pendingGeneration) return;
    if (worker.status !== "loaded") return;
    if (worker.loadedModel !== pendingGeneration.model.id) return;
    if ((worker.loadedRevision ?? null) !== (pendingGeneration.model.revision ?? null)) return;
    if (worker.loadedDevice !== pendingGeneration.device) return;
    if (storage.activeConversation?.id !== pendingGeneration.conversationId) return;

    const conversation = storage.activeConversation;
    if (!conversation) return;

    setPendingGeneration(null);

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const shouldReuseAssistant = pendingGeneration.reuseLastAssistant && lastMessage?.role === "assistant";
    const messages = shouldReuseAssistant
      ? [
          ...conversation.messages.slice(0, -1),
          {
            ...lastMessage,
            content: "",
            thinking: undefined,
            debug: { modelInput: "", rawOutput: "" },
          },
        ]
      : [...conversation.messages, createAssistantMessage()];

    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    streamingRawOutputRef.current = "";
    setThinkingComplete(false);

    const updatedConversation = {
      ...conversation,
      messages,
      updatedAt: Date.now(),
    };
    storage.updateConversation(updatedConversation);

    worker.generate(
      messages.filter((message) => message.content.length > 0 || (message.images && message.images.length > 0)),
      params,
    );
  }, [
    params,
    pendingGeneration,
    storage,
    worker,
  ]);

  useEffect(() => {
    if (worker.status === "loaded" && worker.loadedModel) {
      trackProductEvent("model_loaded", {
        model_id: worker.loadedModel,
        model_revision: worker.loadedRevision,
        device: worker.loadedDevice,
      });
    }
  }, [worker.loadedDevice, worker.loadedModel, worker.loadedRevision, worker.status]);

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
  worker.onTokenRef.current = useCallback((token: string, isThinking?: boolean) => {
    if (isThinking) {
      streamingThinkingRef.current += token;
      const thinking = streamingThinkingRef.current;
      updateLastAssistantMessage((last) => ({ ...last, thinking }));
      return;
    }

    streamingContentRef.current += token;
    const content = streamingContentRef.current;
    updateLastAssistantMessage((last) => ({ ...last, content }));
  }, [updateLastAssistantMessage]);

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
    void storage.flushPendingSave();
    trackProductEvent("generation_complete", {
      model_id: storage.activeConversation?.modelId ?? worker.loadedModel,
      device: worker.loadedDevice,
    });
  }, [storage, worker.loadedDevice, worker.loadedModel]);

  const activeModel = useMemo(
    () => buildModelSelectionFromConversation(storage.activeConversation),
    [storage.activeConversation],
  );

  useEffect(() => {
    if (storage.activeConversation) {
      setLastSelectedModel(activeModel);
    }
  }, [activeModel, storage.activeConversation]);

  const createNewConversation = useCallback(() => {
    if (worker.status === "generating") {
      worker.interrupt();
    }
    setPendingGeneration(null);
    const conversation = storage.createConversation(lastSelectedModel);
    if (isMobile) setSidebarOpen(false);
    return conversation;
  }, [isMobile, lastSelectedModel, storage, worker]);

  const deleteConversation = useCallback((id: string) => {
    storage.deleteConversation(id);
  }, [storage]);

  const handleSend = useCallback(async (content: string, images?: string[]) => {
    let conversation = storage.activeConversation;
    if (!conversation) {
      conversation = createNewConversation();
    }

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      images,
    };

    const updatedMessages = [...conversation.messages, userMessage];
    let title = conversation.title;
    if (title === "New chat") {
      title = content.slice(0, 50) || "New chat";
      if (content.length > 50) title += "...";
    }

    const updatedConversation: Conversation = {
      ...conversation,
      messages: updatedMessages,
      title,
      updatedAt: Date.now(),
      modelId: activeModel.id,
      modelRevision: activeModel.revision ?? null,
      modelSupportsImages: activeModel.supportsImages ?? null,
      recommendedDevice: activeModel.recommendedDevice,
      supportTier: activeModel.supportTier,
    };
    storage.updateConversation(updatedConversation);
    setDismissedWorkerErrorKey(null);
    trackProductEvent("generation_start", {
      model_id: updatedConversation.modelId,
      model_revision: updatedConversation.modelRevision,
      device,
      has_images: Boolean(images?.length),
    });

    const needsLoad = worker.status === "idle" || worker.status === "error";
    const needsSwitch =
      worker.loadedModel !== activeModel.id ||
      (worker.loadedRevision ?? null) !== (activeModel.revision ?? null) ||
      worker.loadedDevice !== device;

    if (needsLoad || needsSwitch) {
      setPendingGeneration({
        conversationId: updatedConversation.id,
        model: activeModel,
        device,
      });
      worker.loadModel(activeModel, device);
      return;
    }

    const messages = [...updatedMessages, createAssistantMessage()];
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    streamingRawOutputRef.current = "";
    setThinkingComplete(false);
    storage.updateConversation({ ...updatedConversation, messages, updatedAt: Date.now() });
    worker.generate(
      messages.filter((message) => message.content.length > 0 || (message.images && message.images.length > 0)),
      params,
    );
  }, [activeModel, createNewConversation, device, params, storage, worker]);

  const handleStop = useCallback(() => {
    worker.interrupt();
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    streamingRawOutputRef.current = "";
  }, [worker]);

  const handleToggleThinking = useCallback(() => {
    if (!canToggleThinking(activeModel.id)) return;
    setParams((current) => ({ ...current, thinkingEnabled: !current.thinkingEnabled }));
  }, [activeModel.id]);

  const handleModelChange = useCallback((selection: ModelSelection) => {
    setLastSelectedModel(selection);
    setPendingGeneration(null);

    if (storage.activeConversation) {
      storage.updateConversation({
        ...storage.activeConversation,
        modelId: selection.id,
        modelRevision: selection.revision ?? null,
        modelSupportsImages: selection.supportsImages ?? null,
        recommendedDevice: selection.recommendedDevice,
        supportTier: selection.supportTier,
      });
    }

    if (
      worker.loadedModel &&
      (worker.loadedModel !== selection.id || (worker.loadedRevision ?? null) !== (selection.revision ?? null))
    ) {
      worker.reset();
    }
  }, [storage, worker]);

  const handleDeviceChange = useCallback((nextDevice: "webgpu" | "wasm") => {
    const nextModel = nextDevice === "wasm" && shouldPreferWasmFallbackModel(activeModel)
      ? getDefaultModelSelectionForDevice("wasm")
      : activeModel;

    setDevice(nextDevice);
    setDismissedWorkerErrorKey(null);
    if (nextModel.id !== activeModel.id || (nextModel.revision ?? null) !== (activeModel.revision ?? null)) {
      handleModelChange(nextModel);
    }
    if (worker.loadedModel || storage.activeConversation) {
      worker.loadModel(nextModel, nextDevice);
    }
  }, [activeModel, handleModelChange, storage.activeConversation, worker]);

  const handleSwitchConversation = useCallback((id: string) => {
    setPendingGeneration(null);
    if (worker.status === "generating") {
      worker.interrupt();
    }
    storage.setActiveConversation(id);
    const conversationMeta = storage.index.find((conversation) => conversation.id === id);
    if (conversationMeta) {
      setLastSelectedModel(getModelSelection(conversationMeta.modelId, {
        revision: conversationMeta.modelRevision ?? null,
        supportsImages: conversationMeta.modelSupportsImages ?? null,
        recommendedDevice: conversationMeta.recommendedDevice,
        supportTier: conversationMeta.supportTier,
      }));
    }
    if (isMobile) setSidebarOpen(false);
  }, [isMobile, storage, worker]);

  const retryLoad = useCallback(() => {
    const targetModel = pendingGeneration?.model ?? activeModel;
    const targetDevice = pendingGeneration?.device ?? device;
    setDismissedWorkerErrorKey(null);
    worker.loadModel(targetModel, targetDevice);
    trackProductEvent("recovery_retry_load", {
      model_id: targetModel.id,
      device: targetDevice,
    });
  }, [activeModel, device, pendingGeneration, worker]);

  const fallbackToDefaultModel = useCallback(() => {
    const fallbackDevice = webgpuSupported === false ? "wasm" : device;
    const fallbackModel = getDefaultModelSelectionForDevice(fallbackDevice);
    handleModelChange(fallbackModel);
    setPendingGeneration((current) => (
      current
        ? { ...current, model: fallbackModel, device: fallbackDevice }
        : current
    ));
    worker.loadModel(fallbackModel, fallbackDevice);
    trackProductEvent("recovery_fallback_default_model", {
      model_id: fallbackModel.id,
      device: fallbackDevice,
    });
  }, [device, handleModelChange, webgpuSupported, worker]);

  const switchToWasmAndRetry = useCallback(() => {
    const targetModel = pendingGeneration?.model ?? activeModel;
    const nextModel = shouldPreferWasmFallbackModel(targetModel)
      ? getDefaultModelSelectionForDevice("wasm")
      : targetModel;

    setDevice("wasm");
    setDismissedWorkerErrorKey(null);
    if (nextModel.id !== activeModel.id || (nextModel.revision ?? null) !== (activeModel.revision ?? null)) {
      handleModelChange(nextModel);
    }
    if (pendingGeneration) {
      setPendingGeneration({ ...pendingGeneration, model: nextModel, device: "wasm" });
      worker.loadModel(nextModel, "wasm");
    } else {
      worker.loadModel(nextModel, "wasm");
    }
    trackProductEvent("recovery_switch_wasm", {
      model_id: nextModel.id,
    });
  }, [activeModel, handleModelChange, pendingGeneration, worker]);

  const retryLastPrompt = useCallback(() => {
    if (!storage.activeConversation) return;
    const lastMessage = storage.activeConversation.messages[storage.activeConversation.messages.length - 1];
    const reuseLastAssistant = lastMessage?.role === "assistant";
    setDismissedWorkerErrorKey(null);
    setPendingGeneration({
      conversationId: storage.activeConversation.id,
      model: activeModel,
      device,
      reuseLastAssistant,
    });
    worker.reset();
    worker.loadModel(activeModel, device);
    trackProductEvent("recovery_retry_prompt", {
      model_id: activeModel.id,
      device,
    });
  }, [activeModel, device, storage.activeConversation, worker]);

  const isLoading = worker.status === "loading";
  const isProcessing = worker.status === "processing";
  const isGenerating = worker.status === "generating";
  const isModelLoaded = worker.status === "loaded" || worker.status === "generating";
  const allowImageInputs = worker.loadedModel === activeModel.id
    ? worker.loadedSupportsImages ?? activeModel.supportsImages ?? isVlmModel(activeModel.id)
    : activeModel.supportsImages ?? isVlmModel(activeModel.id);
  const thinkingEnabled = getEffectiveThinkingEnabled(activeModel.id, params.thinkingEnabled);
  const showThinkingToggle = canToggleThinking(activeModel.id);
  const currentMessages = storage.activeConversation?.messages ?? [];
  const currentWorkerErrorKey = worker.error
    ? `${worker.error.stage}:${worker.error.code}:${worker.error.modelId ?? "unknown"}:${worker.error.revision ?? "none"}:${worker.error.device ?? "unknown"}`
    : null;
  const visibleWorkerError = worker.error && currentWorkerErrorKey !== dismissedWorkerErrorKey ? worker.error : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-[#212121]">
      <Sidebar
        isOpen={sidebarOpen}
        isMobile={isMobile}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={createNewConversation}
        onOpenSettings={() => setSettingsOpen(true)}
        onClearAllChats={() => {
          void storage.clearAllChats();
        }}
        conversations={storage.index}
        activeConversationId={storage.activeConversationId}
        onSwitchConversation={handleSwitchConversation}
        onDeleteConversation={deleteConversation}
        isLoading={isLoading}
        isGenerating={isGenerating}
      />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          {(!sidebarOpen || isMobile) && (
            <button
              onClick={() => setSidebarOpen(true)}
              disabled={isGenerating}
              className="rounded-lg p-2 text-[#b4b4b4] transition-colors hover:bg-[#2f2f2f] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Open sidebar"
            >
              <PanelLeft size={20} />
            </button>
          )}
          <ModelSelector
            loadedModel={worker.loadedModel}
            loadedPrecision={worker.loadedPrecision}
            device={device}
            webgpuSupported={webgpuSupported}
            isLoading={isLoading}
            model={activeModel}
            onModelChange={handleModelChange}
            onOpenModelBrowser={() => setModelBrowserOpen(true)}
            isGenerating={isGenerating}
          />
          <div className="ml-auto flex items-center gap-2">
            {isGenerating && worker.tps > 0 && (
              <span className="text-xs font-mono text-[#8e8e8e]" aria-live="polite">
                {worker.tps.toFixed(1)} t/s
              </span>
            )}
            <button
              onClick={() => setShowRawConversation((current) => !current)}
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
              className="rounded-full p-2 text-[#b4b4b4] transition-colors hover:bg-[#2f2f2f]"
              aria-label="GitHub repository"
            >
              <Github size={20} />
            </a>
          </div>
        </div>

        {storage.storageError && (
          <div
            className="mx-3 mb-2 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3"
            role="alert"
            aria-live="assertive"
          >
            <span className="mt-0.5 text-red-400">&#x26A0;</span>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-red-200">
                {storage.storageError.code === "QUOTA_EXCEEDED"
                  ? "Conversation storage is full. Clear older chats to keep saving the current session."
                  : storage.storageError.message}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void storage.clearOldChats()}
                  className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-100 transition-colors hover:bg-red-500/25"
                >
                  Clear older chats
                </button>
                <button
                  onClick={storage.dismissStorageError}
                  className="rounded-lg px-3 py-1.5 text-sm text-red-100/80 transition-colors hover:bg-red-500/10 hover:text-red-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {visibleWorkerError && (
          <div
            className="mx-3 mb-2 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3"
            role="alert"
            aria-live="assertive"
          >
            <span className="mt-0.5 text-red-400">&#x26A0;</span>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-red-200">{visibleWorkerError.message}</p>
              <div className="flex flex-wrap gap-2">
                {visibleWorkerError.code === "NETWORK_ERROR" && (
                  <button
                    onClick={retryLoad}
                    className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-100 transition-colors hover:bg-red-500/25"
                  >
                    Retry
                  </button>
                )}
                {visibleWorkerError.code === "INSUFFICIENT_RESOURCES" && device === "webgpu" && (
                  <button
                    onClick={switchToWasmAndRetry}
                    className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-100 transition-colors hover:bg-red-500/25"
                  >
                    Switch to WASM
                  </button>
                )}
                {(visibleWorkerError.code === "MODEL_ARTIFACT_ERROR" || visibleWorkerError.code === "UNSUPPORTED_MODEL") && (
                  <button
                    onClick={fallbackToDefaultModel}
                    className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-100 transition-colors hover:bg-red-500/25"
                  >
                    Switch to default model
                  </button>
                )}
                {visibleWorkerError.stage === "generate" && (
                  <button
                    onClick={retryLastPrompt}
                    className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-100 transition-colors hover:bg-red-500/25"
                  >
                    Reset worker and retry
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setDismissedWorkerErrorKey(currentWorkerErrorKey)}
              className="text-red-400 transition-colors hover:text-red-300"
              aria-label="Dismiss error"
            >
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
          modelId={activeModel.id}
          isLoading={isLoading}
          loadingProgress={worker.progress}
          loadingTotalProgress={worker.totalProgress}
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

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        params={params}
        onChange={setParams}
        device={device}
        onDeviceChange={handleDeviceChange}
        webgpuAvailable={webgpuSupported ?? false}
        storageStats={storage.storageStats}
        isGenerating={isGenerating}
      />

      <ModelBrowserModal
        isOpen={modelBrowserOpen}
        onClose={() => setModelBrowserOpen(false)}
        onSelectModel={(selection) => {
          handleModelChange(selection);
          setModelBrowserOpen(false);
        }}
        currentModelId={activeModel.id}
        device={device}
        webgpuSupported={webgpuSupported}
        disabled={isLoading || isGenerating}
      />
    </div>
  );
}
