"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  ChatMessage as ChatMessageType,
  Conversation,
  GenerationParams,
  GenerationStats,
  InferenceDevice,
  ModelInteractionMode,
  ModelSelection,
} from "@/types";
import { getVerifiedModelGenerationParams } from "@/config/verifiedModels";
import {
  DEFAULT_MODEL,
  DEFAULT_PARAMS,
  canToggleThinking,
  getDefaultParamsForModel,
  getEffectiveThinkingEnabled,
  getModelSelection,
  isVlmModel,
} from "@/lib/constants";
import { useInferenceWorker } from "@/hooks/useInferenceWorker";
import { useStorage } from "@/hooks/useStorage";
import { getModelChatPath, getModelIdFromChatPath } from "@/lib/modelRoutes";
import { getModelInteractionMode } from "@/lib/modelInteraction";
import { trackProductEvent, captureTelemetryError } from "@/lib/telemetry";
import { removeEmptyTrailingAssistantMessage } from "@/lib/conversation";
import { ChatInterface } from "@/components/ChatInterface";
import { ModelSelector } from "@/components/ModelSelector";
import { Sidebar } from "@/components/Sidebar";
import { Tooltip } from "@/components/Tooltip";
import { PanelLeft, Github, X, Code2, ScanText } from "lucide-react";

const SettingsModal = dynamic(
  () => import("@/components/SettingsModal").then((mod) => mod.SettingsModal),
);
const ModelBrowserModal = dynamic(
  () => import("@/components/ModelBrowserModal").then((mod) => mod.ModelBrowserModal),
);

interface PendingGeneration {
  conversationId: string;
  model: ModelSelection;
  device: InferenceDevice;
  reuseLastAssistant?: boolean;
}

const LAST_SELECTED_MODEL_KEY = "llame-last-selected-model";

interface HomeAppProps {
  initialModelId?: string | null;
  forceNewChat?: boolean;
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

function getConversationTitle(content: string, images?: string[]) {
  const trimmed = content.trim();
  const imageCount = images?.length ?? 0;

  if (trimmed.length > 0) {
    let title = trimmed.slice(0, 50);
    if (trimmed.length > 50) title += "...";
    return title;
  }

  if (imageCount > 0) {
    return imageCount === 1 ? "Image analysis" : `Image analysis (${imageCount})`;
  }

  return "New chat";
}

function getGeneratableMessages(messages: ChatMessageType[]) {
  return messages.filter((message) => message.content.length > 0 || (message.images && message.images.length > 0));
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
    interactionMode: conversation.modelInteractionMode ?? null,
    chatFormat: conversation.modelChatFormat ?? null,
  });
}

function getModelSelectionKey(model: ModelSelection) {
  return `${model.id}\0${model.revision ?? ""}`;
}

function loadLastSelectedModel(): ModelSelection | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(LAST_SELECTED_MODEL_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ModelSelection>;
    if (typeof parsed.id !== "string" || parsed.id.trim().length === 0) {
      return null;
    }

    return getModelSelection(parsed.id, {
      revision: parsed.revision ?? null,
      supportsImages: parsed.supportsImages ?? null,
      recommendedDevice: parsed.recommendedDevice,
      supportTier: parsed.supportTier,
      interactionMode: parsed.interactionMode ?? null,
      chatFormat: parsed.chatFormat ?? null,
    });
  } catch {
    return null;
  }
}

function persistLastSelectedModel(selection: ModelSelection) {
  if (typeof window === "undefined") return;

  localStorage.setItem(LAST_SELECTED_MODEL_KEY, JSON.stringify({
    id: selection.id,
    revision: selection.revision ?? null,
    supportsImages: selection.supportsImages ?? null,
    recommendedDevice: selection.recommendedDevice,
    supportTier: selection.supportTier,
    interactionMode: selection.interactionMode ?? null,
    chatFormat: selection.chatFormat ?? null,
  }));
}

function clearNewChatRequestFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("new");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function syncUrlToModel(modelId: string) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.pathname = getModelChatPath(modelId);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

export default function HomeApp({
  initialModelId = null,
  forceNewChat = false,
}: HomeAppProps = {}) {
  const [webgpuSupported, setWebgpuSupported] = useState<boolean | null>(null);
  const worker = useInferenceWorker();
  const storage = useStorage();
  const [clientRouteModelId, setClientRouteModelId] = useState<string | null>(null);
  const routeModelId = initialModelId ?? clientRouteModelId;
  const routeForceNewChat = forceNewChat || clientRouteModelId !== null;
  const initialRouteModel = useMemo(
    () => routeModelId ? getModelSelection(routeModelId) : null,
    [routeModelId],
  );
  const initialRouteModelKey = initialRouteModel
    ? `${initialRouteModel.id}\0${initialRouteModel.revision ?? ""}`
    : null;

  const [launchNewChatRequested, setLaunchNewChatRequested] = useState<boolean | null>(null);
  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(null);
  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const device: InferenceDevice = "webgpu";
  const [lastSelectedModel, setLastSelectedModel] = useState<ModelSelection>(() => (
    initialRouteModel ?? loadLastSelectedModel() ?? getModelSelection(DEFAULT_MODEL)
  ));
  const [hasExplicitLastSelectedModel, setHasExplicitLastSelectedModel] = useState(() => (
    initialRouteModel !== null || loadLastSelectedModel() !== null
  ));
  const [dismissedWorkerErrorKey, setDismissedWorkerErrorKey] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelBrowserOpen, setModelBrowserOpen] = useState(false);
  const [showRawConversation, setShowRawConversation] = useState(false);
  const [showTokenization, setShowTokenization] = useState(false);
  const [thinkingComplete, setThinkingComplete] = useState(false);

  const streamingContentRef = useRef("");
  const streamingThinkingRef = useRef("");
  const streamingRawOutputRef = useRef("");
  const activeConversationRef = useRef<Conversation | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const launchNewChatHandledRef = useRef(false);
  const modelRouteChatHandledRef = useRef<string | null>(null);
  const appliedVerifiedParamsModelKeyRef = useRef<string | null>(null);
  const pendingUrlModelKeyRef = useRef<string | null>(null);

  const updateActiveConversation = useCallback((conversation: Conversation) => {
    activeConversationRef.current = conversation;
    storage.updateConversation(conversation);
  }, [storage]);

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
    const searchParams = new URLSearchParams(window.location.search);
    if (!initialModelId) {
      const modelIdFromPath = getModelIdFromChatPath(window.location.pathname);
      if (modelIdFromPath) {
        setClientRouteModelId(modelIdFromPath);
      }
    }
    setLaunchNewChatRequested(searchParams.get("new") === "1");
  }, [initialModelId]);

  useEffect(() => {
    if (webgpuSupported === false) {
      captureTelemetryError("WebGPU unavailable", { webgpu_supported: false });
      trackProductEvent("browser_webgpu_unavailable", {});
    }
  }, [webgpuSupported]);

  useEffect(() => {
    const savedThinking = localStorage.getItem("llame-thinking-enabled");
    if (savedThinking !== null) {
      setParams((current) => ({ ...current, thinkingEnabled: savedThinking === "true" }));
    }

    const savedRawView = localStorage.getItem("llame-raw-conversation");
    if (savedRawView !== null) {
      setShowRawConversation(savedRawView === "true");
    }

    const savedTokenization = localStorage.getItem("llame-tokenization-enabled");
    if (savedTokenization !== null) {
      setShowTokenization(savedTokenization === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("llame-thinking-enabled", params.thinkingEnabled.toString());
  }, [params.thinkingEnabled]);

  useEffect(() => {
    localStorage.setItem("llame-raw-conversation", showRawConversation.toString());
  }, [showRawConversation]);

  useEffect(() => {
    localStorage.setItem("llame-tokenization-enabled", showTokenization.toString());
  }, [showTokenization]);

  useEffect(() => {
    activeConversationIdRef.current = storage.activeConversationId;
  }, [storage.activeConversationId]);

  useEffect(() => {
    activeConversationRef.current = storage.activeConversation;
  }, [storage.activeConversation]);

  useEffect(() => {
    if (!initialRouteModel) return;

    setLastSelectedModel(initialRouteModel);
    setHasExplicitLastSelectedModel(true);
    persistLastSelectedModel(initialRouteModel);
  }, [initialRouteModel, initialRouteModelKey]);

  const updateLastAssistantMessage = useCallback((updater: (message: ChatMessageType) => ChatMessageType) => {
    const conversation = activeConversationRef.current;
    if (!conversation) return;

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage?.role !== "assistant") return;

    const updatedMessages = [...conversation.messages.slice(0, -1), updater(lastMessage)];
    updateActiveConversation({ ...conversation, messages: updatedMessages, updatedAt: Date.now() });
  }, [updateActiveConversation]);

  useEffect(() => {
    if (!storage.ready) return;
    if (launchNewChatRequested === null) return;
    if (launchNewChatRequested) return;
    if (routeForceNewChat && initialRouteModel) return;
    if (storage.activeConversationId) return;

    const sortedConversations = [...storage.index].sort((left, right) => right.updatedAt - left.updatedAt);
    const lastConversation = sortedConversations[0];

    if (lastConversation && lastConversation.messageCount === 0) {
      storage.setActiveConversation(lastConversation.id);
      return;
    }

    const conversation = storage.createConversation(lastSelectedModel);
    activeConversationRef.current = conversation;
    setLastSelectedModel(buildModelSelectionFromConversation(conversation));
    if (isMobile) setSidebarOpen(false);
  }, [initialRouteModel, isMobile, lastSelectedModel, launchNewChatRequested, routeForceNewChat, storage]);

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
            stats: undefined,
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
    updateActiveConversation(updatedConversation);

    worker.generate(getGeneratableMessages(messages), params);
  }, [
    params,
    pendingGeneration,
    storage,
    updateActiveConversation,
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
  worker.onCompleteRef.current = useCallback((stats: GenerationStats) => {
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    streamingRawOutputRef.current = "";
    updateLastAssistantMessage((last) => ({ ...last, stats }));
    void storage.flushPendingSave();
    trackProductEvent("generation_complete", {
      model_id: storage.activeConversation?.modelId ?? worker.loadedModel,
      device: worker.loadedDevice,
      generation_time: stats.generationTime,
      stop_reason: stats.stopReason,
    });
  }, [storage, updateLastAssistantMessage, worker.loadedDevice, worker.loadedModel]);

  const activeModel = useMemo(
    () => buildModelSelectionFromConversation(storage.activeConversation),
    [storage.activeConversation],
  );

  const applyVerifiedParamsForModel = useCallback((model: ModelSelection) => {
    appliedVerifiedParamsModelKeyRef.current = getModelSelectionKey(model);
    setParams((current) => ({
      ...getVerifiedModelGenerationParams(model.id, getDefaultParamsForModel(model)),
      thinkingEnabled: current.thinkingEnabled,
    }));
  }, []);

  useEffect(() => {
    const modelKey = getModelSelectionKey(activeModel);
    if (appliedVerifiedParamsModelKeyRef.current === modelKey) return;

    applyVerifiedParamsForModel(activeModel);
  }, [activeModel, applyVerifiedParamsForModel]);

  useEffect(() => {
    if (!hasExplicitLastSelectedModel && storage.activeConversation) {
      setLastSelectedModel(activeModel);
    }
  }, [activeModel, hasExplicitLastSelectedModel, storage.activeConversation]);

  const interruptActiveGeneration = useCallback(() => {
    worker.interrupt();

    const conversation = storage.activeConversation;
    if (!conversation) return;

    const nextConversation = removeEmptyTrailingAssistantMessage(conversation);
    if (nextConversation !== conversation) {
      updateActiveConversation(nextConversation);
    }

    void storage.flushPendingSave();
  }, [storage, updateActiveConversation, worker]);

  const createNewConversation = useCallback((model?: ModelSelection) => {
    const selectedModel = model ?? lastSelectedModel;

    if (worker.status === "generating") {
      interruptActiveGeneration();
    }
    setPendingGeneration(null);
    applyVerifiedParamsForModel(selectedModel);
    pendingUrlModelKeyRef.current = getModelSelectionKey(selectedModel);
    syncUrlToModel(selectedModel.id);
    const conversation = storage.createConversation(selectedModel);
    activeConversationRef.current = conversation;
    if (isMobile) setSidebarOpen(false);
    return conversation;
  }, [applyVerifiedParamsForModel, interruptActiveGeneration, isMobile, lastSelectedModel, storage, worker.status]);

  useEffect(() => {
    if (!routeForceNewChat) return;
    if (!initialRouteModel || !initialRouteModelKey) return;
    if (!storage.ready) return;

    if (launchNewChatRequested) {
      clearNewChatRequestFromUrl();
      setLaunchNewChatRequested(false);
    }

    if (modelRouteChatHandledRef.current === initialRouteModelKey) return;

    modelRouteChatHandledRef.current = initialRouteModelKey;
    createNewConversation(initialRouteModel);
  }, [
    createNewConversation,
    initialRouteModel,
    initialRouteModelKey,
    launchNewChatRequested,
    routeForceNewChat,
    storage.ready,
  ]);

  useEffect(() => {
    if (!storage.ready) return;
    if (launchNewChatRequested !== true) return;
    if (routeForceNewChat && initialRouteModel) return;
    if (launchNewChatHandledRef.current) return;

    launchNewChatHandledRef.current = true;
    createNewConversation(buildModelSelectionFromConversation(storage.activeConversation));

    clearNewChatRequestFromUrl();
    setLaunchNewChatRequested(false);
  }, [
    createNewConversation,
    initialRouteModel,
    launchNewChatRequested,
    routeForceNewChat,
    storage.activeConversation,
    storage.ready,
  ]);

  useEffect(() => {
    if (!storage.ready) return;
    if (launchNewChatRequested !== false) return;
    if (
      routeForceNewChat &&
      initialRouteModelKey &&
      modelRouteChatHandledRef.current !== initialRouteModelKey
    ) {
      return;
    }

    const activeModelKey = getModelSelectionKey(activeModel);
    if (pendingUrlModelKeyRef.current) {
      if (pendingUrlModelKeyRef.current !== activeModelKey) return;
      pendingUrlModelKeyRef.current = null;
    }

    syncUrlToModel(activeModel.id);
  }, [
    activeModel,
    initialRouteModelKey,
    launchNewChatRequested,
    routeForceNewChat,
    storage.ready,
  ]);

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
      title = getConversationTitle(content, images);
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
      modelInteractionMode: activeModel.interactionMode ?? null,
      modelChatFormat: activeModel.chatFormat ?? null,
    };
    updateActiveConversation(updatedConversation);
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
    updateActiveConversation({ ...updatedConversation, messages, updatedAt: Date.now() });
    worker.generate(getGeneratableMessages(messages), params);
  }, [activeModel, createNewConversation, device, params, storage, updateActiveConversation, worker]);

  const handleStop = useCallback(() => {
    interruptActiveGeneration();
    setPendingGeneration(null);
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    streamingRawOutputRef.current = "";
  }, [interruptActiveGeneration]);

  const handleRegenerateLastAssistant = useCallback(() => {
    const conversation = storage.activeConversation;
    if (!conversation) return;
    if (worker.status === "loading" || worker.status === "processing" || worker.status === "generating") return;

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage?.role !== "assistant") return;

    const messages = [
      ...conversation.messages.slice(0, -1),
      {
        ...lastMessage,
        content: "",
        thinking: undefined,
        stats: undefined,
        debug: { modelInput: "", rawOutput: "" },
      },
    ];

    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    streamingRawOutputRef.current = "";
    setThinkingComplete(false);
    setDismissedWorkerErrorKey(null);

    const updatedConversation = {
      ...conversation,
      messages,
      updatedAt: Date.now(),
      modelId: activeModel.id,
      modelRevision: activeModel.revision ?? null,
      modelSupportsImages: activeModel.supportsImages ?? null,
      recommendedDevice: activeModel.recommendedDevice,
      supportTier: activeModel.supportTier,
      modelInteractionMode: activeModel.interactionMode ?? null,
      modelChatFormat: activeModel.chatFormat ?? null,
    };
    updateActiveConversation(updatedConversation);

    trackProductEvent("generation_regenerate_start", {
      model_id: updatedConversation.modelId,
      model_revision: updatedConversation.modelRevision,
      device,
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
        reuseLastAssistant: true,
      });
      worker.loadModel(activeModel, device);
      return;
    }

    worker.generate(getGeneratableMessages(messages), params);
  }, [activeModel, device, params, storage, updateActiveConversation, worker]);

  const handleDeleteLastMessage = useCallback(() => {
    const conversation = storage.activeConversation;
    if (!conversation) return;
    if (worker.status === "loading" || worker.status === "processing" || worker.status === "generating") return;

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (!lastMessage) return;

    updateActiveConversation({
      ...conversation,
      messages: conversation.messages.slice(0, -1),
      updatedAt: Date.now(),
    });
    trackProductEvent("message_delete", {
      model_id: conversation.modelId,
      role: lastMessage.role,
    });
  }, [storage, updateActiveConversation, worker.status]);

  const handleEditLastMessage = useCallback((content: string) => {
    const conversation = storage.activeConversation;
    if (!conversation) return;
    if (worker.status === "loading" || worker.status === "processing" || worker.status === "generating") return;

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (!lastMessage) return;
    if (content.trim().length === 0 && !lastMessage.images?.length) return;
    if (lastMessage.content === content) return;

    const messages = [
      ...conversation.messages.slice(0, -1),
      {
        ...lastMessage,
        content,
      },
    ];

    const shouldRetitle =
      conversation.messages.length === 1 &&
      lastMessage.role === "user" &&
      conversation.title === getConversationTitle(lastMessage.content, lastMessage.images);

    updateActiveConversation({
      ...conversation,
      title: shouldRetitle ? getConversationTitle(content, lastMessage.images) : conversation.title,
      messages,
      updatedAt: Date.now(),
    });

    trackProductEvent("message_edit", {
      model_id: conversation.modelId,
      role: lastMessage.role,
    });
  }, [storage, updateActiveConversation, worker.status]);

  const handleToggleThinking = useCallback(() => {
    if (!canToggleThinking(activeModel.id)) return;
    setParams((current) => ({ ...current, thinkingEnabled: !current.thinkingEnabled }));
  }, [activeModel.id]);

  const handleModelChange = useCallback((selection: ModelSelection) => {
    setLastSelectedModel(selection);
    setHasExplicitLastSelectedModel(true);
    persistLastSelectedModel(selection);
    setPendingGeneration(null);
    applyVerifiedParamsForModel(selection);
    pendingUrlModelKeyRef.current = getModelSelectionKey(selection);
    syncUrlToModel(selection.id);

    if (storage.activeConversation) {
      updateActiveConversation({
        ...storage.activeConversation,
        modelId: selection.id,
        modelRevision: selection.revision ?? null,
        modelSupportsImages: selection.supportsImages ?? null,
        recommendedDevice: selection.recommendedDevice,
        supportTier: selection.supportTier,
        modelInteractionMode: selection.interactionMode ?? null,
        modelChatFormat: selection.chatFormat ?? null,
      });
    }

    if (
      worker.loadedModel &&
      (worker.loadedModel !== selection.id || (worker.loadedRevision ?? null) !== (selection.revision ?? null))
    ) {
      worker.reset();
    }
  }, [applyVerifiedParamsForModel, storage, updateActiveConversation, worker]);

  const handleSwitchConversation = useCallback((id: string) => {
    setPendingGeneration(null);
    pendingUrlModelKeyRef.current = null;
    if (worker.status === "generating") {
      interruptActiveGeneration();
    }
    const conversationMeta = storage.index.find((conversation) => conversation.id === id);
    if (conversationMeta) {
      syncUrlToModel(conversationMeta.modelId);
    }
    storage.setActiveConversation(id);
    if (isMobile) setSidebarOpen(false);
  }, [interruptActiveGeneration, isMobile, storage, worker.status]);

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
    const fallbackModel = getModelSelection(DEFAULT_MODEL);
    handleModelChange(fallbackModel);
    setPendingGeneration((current) => (
      current
        ? { ...current, model: fallbackModel, device }
        : current
    ));
    worker.loadModel(fallbackModel, device);
    trackProductEvent("recovery_fallback_default_model", {
      model_id: fallbackModel.id,
      device,
    });
  }, [device, handleModelChange, worker]);

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
  const canRequestTokenization = worker.status === "loaded";
  const loadedActiveModel =
    worker.loadedModel === activeModel.id &&
    (worker.loadedRevision ?? null) === (activeModel.revision ?? null);
  const activeInteractionMode: ModelInteractionMode = loadedActiveModel
    ? worker.loadedInteractionMode ?? activeModel.interactionMode ?? getModelInteractionMode({
        modelId: activeModel.id,
        supportsImages: activeModel.supportsImages,
      })
    : activeModel.interactionMode ?? getModelInteractionMode({
        modelId: activeModel.id,
        supportsImages: activeModel.supportsImages,
      });
  const modelSupportsImages = loadedActiveModel
    ? worker.loadedSupportsImages ?? activeModel.supportsImages ?? isVlmModel(activeModel.id)
    : activeModel.supportsImages ?? isVlmModel(activeModel.id);
  const allowImageInputs = activeInteractionMode === "chat" && modelSupportsImages;
  const thinkingEnabled = activeInteractionMode === "chat" && getEffectiveThinkingEnabled(activeModel.id, params.thinkingEnabled);
  const showThinkingToggle = activeInteractionMode === "chat" && canToggleThinking(activeModel.id);
  const currentMessages = storage.activeConversation?.messages ?? [];
  const currentWorkerErrorKey = worker.error
    ? `${worker.error.stage}:${worker.error.code}:${worker.error.modelId ?? "unknown"}:${worker.error.revision ?? "none"}:${worker.error.device ?? "unknown"}`
    : null;
  const visibleWorkerError = worker.error && currentWorkerErrorKey !== dismissedWorkerErrorKey ? worker.error : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-[#212121]">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={() => {
          createNewConversation();
        }}
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

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          {!sidebarOpen && (
            <Tooltip label="Open sidebar" side="bottom" align="start">
              <button
                onClick={() => setSidebarOpen(true)}
                disabled={isGenerating}
                className="rounded-lg p-2 text-[#b4b4b4] transition-colors hover:bg-[#2f2f2f] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Open sidebar"
              >
                <PanelLeft size={20} />
              </button>
            </Tooltip>
          )}
          <ModelSelector
            loadedModel={worker.loadedModel}
            loadedPrecision={worker.loadedPrecision}
            device={device}
            webgpuSupported={webgpuSupported}
            isLoading={isLoading}
            model={activeModel}
            interactionMode={activeInteractionMode}
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
            <Tooltip
              label={!isModelLoaded
                ? "Load a model to show tokenization"
                : showTokenization
                  ? "Disable tokenization view"
                  : "Enable tokenization view"}
              side="bottom"
            >
              <button
                onClick={() => setShowTokenization((current) => !current)}
                disabled={!isModelLoaded}
                className={`rounded-full p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  showTokenization
                    ? "bg-[#2f2f2f] text-[#10a37f]"
                    : "text-[#6f6f6f] hover:bg-[#2f2f2f] hover:text-[#9a9a9a]"
                }`}
                aria-label={showTokenization ? "Disable tokenization view" : "Enable tokenization view"}
              >
                <ScanText size={18} />
              </button>
            </Tooltip>
            <Tooltip
              label={showRawConversation ? "Show formatted conversation" : "Show raw source conversation"}
              side="bottom"
            >
              <button
                onClick={() => setShowRawConversation((current) => !current)}
                className={`rounded-full p-2 transition-colors ${
                  showRawConversation
                    ? "bg-[#2f2f2f] text-[#b4b4b4]"
                    : "text-[#6f6f6f] hover:bg-[#2f2f2f] hover:text-[#9a9a9a]"
                }`}
                aria-label={showRawConversation ? "Show formatted conversation" : "Show raw conversation"}
              >
                <Code2 size={18} />
              </button>
            </Tooltip>
            <Tooltip label="GitHub repository" side="bottom" align="end">
              <a
                href="https://github.com/tsilva/llame"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full p-2 text-[#b4b4b4] transition-colors hover:bg-[#2f2f2f]"
                aria-label="GitHub repository"
              >
                <Github size={20} />
              </a>
            </Tooltip>
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
                  title="Clear older chats"
                  className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-100 transition-colors hover:bg-red-500/25"
                >
                  Clear older chats
                </button>
                <button
                  onClick={storage.dismissStorageError}
                  title="Dismiss storage error"
                  className="rounded-lg px-3 py-1.5 text-sm text-red-100/80 transition-colors hover:bg-red-500/10 hover:text-red-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {webgpuSupported === false && (
          <div
            className="mx-3 mb-2 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3"
            role="alert"
            aria-live="polite"
          >
            <span className="mt-0.5 text-amber-300">&#x26A0;</span>
            <p className="text-sm text-amber-100">
              WebGPU is unavailable in this browser. Local inference requires a WebGPU-capable browser.
            </p>
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
            <Tooltip label="Dismiss error">
              <button
                onClick={() => setDismissedWorkerErrorKey(currentWorkerErrorKey)}
                className="text-red-400 transition-colors hover:text-red-300"
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </Tooltip>
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
          interactionMode={activeInteractionMode}
          isLoading={isLoading}
          loadingProgress={worker.progress}
          loadingTotalProgress={worker.totalProgress}
          loadingMessage={worker.loadingMessage}
          onSend={handleSend}
          onStop={handleStop}
          tps={worker.tps}
          numTokens={worker.numTokens}
          generationTime={worker.generationTime}
          stopReason={worker.stopReason}
          device={worker.loadedDevice}
          isMobile={isMobile}
          allowImageInputs={allowImageInputs}
          thinkingComplete={thinkingComplete}
          thinkingEnabled={thinkingEnabled}
          showThinkingToggle={showThinkingToggle}
          onToggleThinking={handleToggleThinking}
          showRawConversation={showRawConversation}
          showTokenization={showTokenization && isModelLoaded}
          canRequestTokenization={canRequestTokenization}
          tokenize={worker.tokenize}
          onRegenerateLastAssistant={handleRegenerateLastAssistant}
          onDeleteLastMessage={handleDeleteLastMessage}
          onEditLastMessage={handleEditLastMessage}
        />
      </main>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        params={params}
        onChange={setParams}
        defaultParams={getDefaultParamsForModel(activeModel)}
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
