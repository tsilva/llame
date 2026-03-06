"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage as ChatMessageType, Conversation, GenerationParams } from "@/types";
import { DEFAULT_PARAMS, DEFAULT_MODEL } from "@/lib/constants";
import { useWebGPU } from "@/hooks/useWebGPU";
import { useInferenceWorker } from "@/hooks/useInferenceWorker";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ChatInterface } from "@/components/ChatInterface";
import { ModelSelector } from "@/components/ModelSelector";
import { Sidebar } from "@/components/Sidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { PanelLeft } from "lucide-react";

const STORAGE_KEYS = {
  CONVERSATIONS: "llame-conversations",
  SELECTED_MODEL: "llame-selected-model",
};

export default function Home() {
  const webgpu = useWebGPU();
  const worker = useInferenceWorker();

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
  // Model selection (separate from loaded model)
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [pendingGeneration, setPendingGeneration] = useState<{ content: string; images?: string[] } | null>(null);

  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const [device, setDevice] = useState<"webgpu" | "wasm">("webgpu");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const streamingContentRef = useRef("");
  const streamingThinkingRef = useRef("");
  const isCompleteRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const savedConversations = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (savedConversations) {
        const parsed = JSON.parse(savedConversations);
        setConversations(parsed);
        // Set most recent as active if exists
        if (parsed.length > 0) {
          const sorted = [...parsed].sort((a: Conversation, b: Conversation) => b.updatedAt - a.updatedAt);
          setActiveConversationId(sorted[0].id);
          setSelectedModel(sorted[0].modelId);
        }
      }
      
      const savedModel = localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
      if (savedModel) {
        setSelectedModel(savedModel);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save to localStorage on conversations change
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch {
      // Ignore localStorage errors
    }
  }, [conversations]);

  // Save selected model to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, selectedModel);
    } catch {
      // Ignore localStorage errors
    }
  }, [selectedModel]);

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
      const { content, images } = pendingGeneration;
      setPendingGeneration(null);
      
      // Now generate the response
      const assistantMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      isCompleteRef.current = false;

      const activeConv = getActiveConversation();
      if (activeConv) {
        const newMessages = [...activeConv.messages, assistantMsg];
        updateActiveConversation(newMessages);

        worker.generate(
          newMessages.filter(
            (m) => m.content.length > 0 || (m.images && m.images.length > 0)
          ),
          params
        );
      }
    }
  }, [pendingGeneration, worker.status, params, worker]);

  // eslint-disable-next-line react-hooks/immutability
  worker.onTokenRef.current = useCallback(
    (token: string, isThinking?: boolean) => {
      if (isThinking) {
        streamingThinkingRef.current += token;
        const thinking = streamingThinkingRef.current;
        setConversations((prev) => {
          const convIndex = prev.findIndex(c => c.id === activeConversationId);
          if (convIndex === -1) return prev;
          
          const conv = prev[convIndex];
          const last = conv.messages[conv.messages.length - 1];
          if (last?.role === "assistant") {
            const updatedMessages = [...conv.messages.slice(0, -1), { ...last, thinking }];
            const updatedConv = { ...conv, messages: updatedMessages, updatedAt: Date.now() };
            return [...prev.slice(0, convIndex), updatedConv, ...prev.slice(convIndex + 1)];
          }
          return prev;
        });
      } else {
        streamingContentRef.current += token;
        const content = streamingContentRef.current;
        setConversations((prev) => {
          const convIndex = prev.findIndex(c => c.id === activeConversationId);
          if (convIndex === -1) return prev;
          
          const conv = prev[convIndex];
          const last = conv.messages[conv.messages.length - 1];
          if (last?.role === "assistant") {
            const updatedMessages = [...conv.messages.slice(0, -1), { ...last, content }];
            const updatedConv = { ...conv, messages: updatedMessages, updatedAt: Date.now() };
            return [...prev.slice(0, convIndex), updatedConv, ...prev.slice(convIndex + 1)];
          }
          return prev;
        });
      }
    },
    [activeConversationId]
  );

  // eslint-disable-next-line react-hooks/immutability
  worker.onThinkingCompleteRef.current = useCallback((thinking: string) => {
    streamingThinkingRef.current = thinking;
    setConversations((prev) => {
      const convIndex = prev.findIndex(c => c.id === activeConversationId);
      if (convIndex === -1) return prev;
      
      const conv = prev[convIndex];
      const last = conv.messages[conv.messages.length - 1];
      if (last?.role === "assistant") {
        const updatedMessages = [...conv.messages.slice(0, -1), { ...last, thinking }];
        const updatedConv = { ...conv, messages: updatedMessages, updatedAt: Date.now() };
        return [...prev.slice(0, convIndex), updatedConv, ...prev.slice(convIndex + 1)];
      }
      return prev;
    });
  }, [activeConversationId]);

  // eslint-disable-next-line react-hooks/immutability
  worker.onCompleteRef.current = useCallback(() => {
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    isCompleteRef.current = true;
  }, []);

  const getActiveConversation = (): Conversation | null => {
    if (!activeConversationId) return null;
    return conversations.find(c => c.id === activeConversationId) || null;
  };

  const createNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelId: selectedModel,
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    return newConv;
  }, [selectedModel]);

  const updateActiveConversation = (messages: ChatMessageType[]) => {
    if (!activeConversationId) return;
    
    setConversations(prev => {
      const convIndex = prev.findIndex(c => c.id === activeConversationId);
      if (convIndex === -1) return prev;
      
      const conv = prev[convIndex];
      // Update title from first user message if it's still "New chat"
      let title = conv.title;
      if (title === "New chat") {
        const firstUserMessage = messages.find(m => m.role === "user");
        if (firstUserMessage) {
          title = firstUserMessage.content.slice(0, 50) || "New chat";
          if (firstUserMessage.content.length > 50) title += "...";
        }
      }
      
      const updatedConv = { 
        ...conv, 
        messages, 
        title,
        updatedAt: Date.now(),
        modelId: selectedModel // Track which model was used
      };
      return [...prev.slice(0, convIndex), updatedConv, ...prev.slice(convIndex + 1)];
    });
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      // Switch to next available or null
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        const sorted = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt);
        setActiveConversationId(sorted[0].id);
        setSelectedModel(sorted[0].modelId);
      } else {
        setActiveConversationId(null);
      }
    }
  };

  const handleSend = useCallback(
    (content: string, images?: string[]) => {
      // Get or create active conversation
      let activeConv = getActiveConversation();
      if (!activeConv) {
        activeConv = createNewConversation();
      }

      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        images,
      };

      // Add user message immediately
      const updatedMessages = [...activeConv.messages, userMsg];
      updateActiveConversation(updatedMessages);

      // Check if model needs to be loaded or switched
      const needsLoad = worker.status === "idle" || worker.status === "error";
      const needsSwitch = worker.loadedModel && worker.loadedModel !== selectedModel;

      if (needsLoad || needsSwitch) {
        // Queue the generation for after model loads
        setPendingGeneration({ content, images });
        // Load the model
        setError(null);
        worker.loadModel(selectedModel, device);
      } else if (worker.status === "loaded") {
        // Model is ready, generate immediately
        const assistantMsg: ChatMessageType = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
        };

        streamingContentRef.current = "";
        streamingThinkingRef.current = "";
        isCompleteRef.current = false;

        const newMessages = [...updatedMessages, assistantMsg];
        updateActiveConversation(newMessages);

        worker.generate(
          newMessages.filter(
            (m) => m.content.length > 0 || (m.images && m.images.length > 0)
          ),
          params
        );
      }
      // If status is "loading", the useEffect will handle pendingGeneration when it becomes "loaded"
    },
    [conversations, activeConversationId, selectedModel, worker, device, params, createNewConversation]
  );

  const handleStop = useCallback(() => {
    worker.interrupt();
  }, [worker]);

  const handleLoadModel = useCallback(
    (modelId: string) => {
      setSelectedModel(modelId);
      // Only actually load if explicitly requested (not on select)
      // The model will auto-load on first message instead
    },
    []
  );

  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModel(modelId);
  }, []);

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
    setActiveConversationId(id);
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setSelectedModel(conv.modelId);
    }
  };

  const isLoading = worker.status === "loading";
  const isGenerating = worker.status === "generating";
  const isModelLoaded = worker.status === "loaded" || worker.status === "generating";

  const activeConversation = getActiveConversation();
  const currentMessages = activeConversation?.messages || [];

  return (
    <div className="flex h-screen overflow-hidden bg-[#212121]">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={createNewConversation}
        onOpenSettings={() => setSettingsOpen(true)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSwitchConversation={handleSwitchConversation}
        onDeleteConversation={deleteConversation}
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
            selectedModel={selectedModel}
            loadedModel={worker.loadedModel}
            isLoading={isLoading}
            disabled={isGenerating}
            onSelect={handleModelSelect}
            onLoad={handleLoadModel}
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
          selectedModel={selectedModel}
          loadedModel={worker.loadedModel}
          isLoading={isLoading}
          loadingProgress={worker.progress}
          loadingMessage={worker.loadingMessage}
          onSend={handleSend}
          onStop={handleStop}
          tps={worker.tps}
          numTokens={worker.numTokens}
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
