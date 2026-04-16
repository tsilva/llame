import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import HomeApp from "@/components/HomeApp";
import { useInferenceWorker } from "@/hooks/useInferenceWorker";
import { useStorage } from "@/hooks/useStorage";
import { Conversation, GenerationStats, ModelSelection } from "@/types";

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("@/hooks/useInferenceWorker", () => ({
  useInferenceWorker: vi.fn(),
}));

vi.mock("@/hooks/useStorage", () => ({
  useStorage: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  captureTelemetryError: vi.fn(),
  trackProductEvent: vi.fn(),
}));

vi.mock("@/components/ChatInterface", () => ({
  ChatInterface: ({
    onRegenerateLastAssistant,
    onDeleteLastAssistant,
    onEditLastMessage,
  }: {
    onRegenerateLastAssistant: () => void;
    onDeleteLastAssistant: () => void;
    onEditLastMessage: (content: string) => void;
  }) => (
    <div data-testid="chat-interface">
      <button data-testid="regenerate-answer" onClick={onRegenerateLastAssistant}>
        Regenerate
      </button>
      <button data-testid="delete-answer" onClick={onDeleteLastAssistant}>
        Delete
      </button>
      <button data-testid="edit-message" onClick={() => onEditLastMessage("Edited answer")}>
        Edit
      </button>
    </div>
  ),
}));

vi.mock("@/components/ModelSelector", () => ({
  ModelSelector: ({ onModelChange }: { onModelChange: (model: ModelSelection) => void }) => (
    <button
      data-testid="model-selector"
      onClick={() => onModelChange({
        id: "onnx-community/Llama-3.2-1B-Instruct-q4f16",
        revision: "custom-rev",
        supportsImages: false,
        recommendedDevice: "webgpu",
        supportTier: "community",
      })}
    >
      Model selector
    </button>
  ),
}));

vi.mock("@/components/Sidebar", () => ({
  Sidebar: ({
    onNewChat,
    onSwitchConversation,
  }: {
    onNewChat: () => void;
    onSwitchConversation: (id: string) => void;
  }) => (
    <div data-testid="sidebar">
      <button data-testid="new-chat" onClick={() => onNewChat()}>New chat</button>
      <button data-testid="switch-conversation" onClick={() => onSwitchConversation("conv-2")}>
        Switch conversation
      </button>
    </div>
  ),
}));

const mockedUseInferenceWorker = vi.mocked(useInferenceWorker);
const mockedUseStorage = vi.mocked(useStorage);

function buildConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-1",
    title: "Existing chat",
    messages: [
      {
        id: "user-1",
        role: "user",
        content: "Hello",
      },
    ],
    createdAt: 1,
    updatedAt: 2,
    modelId: "onnx-community/Qwen2.5-0.5B-Instruct",
    modelRevision: "rev-1",
    modelSupportsImages: false,
    recommendedDevice: "wasm",
    supportTier: "curated",
    ...overrides,
  };
}

function buildConversationMeta(conversation: Conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    modelId: conversation.modelId,
    modelRevision: conversation.modelRevision ?? null,
    modelSupportsImages: conversation.modelSupportsImages ?? null,
    recommendedDevice: conversation.recommendedDevice,
    supportTier: conversation.supportTier,
    messageCount: conversation.messages.length,
    sizeBytes: 0,
  };
}

beforeAll(() => {
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: {
      requestAdapter: vi.fn(async () => ({})),
    },
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("HomeApp", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/chat");

    mockedUseInferenceWorker.mockReturnValue({
      status: "idle",
      error: null,
      loadedModel: null,
      loadedRevision: null,
      loadedDevice: null,
      loadedPrecision: null,
      loadedSupportsImages: false,
      progress: null,
      totalProgress: null,
      loadingMessage: "",
      processingMessage: "",
      tps: 0,
      numTokens: 0,
      onPromptRef: { current: null },
      onRawTokenRef: { current: null },
      onTokenRef: { current: null },
      onThinkingCompleteRef: { current: null },
      onCompleteRef: { current: null },
      loadModel: vi.fn(),
      generate: vi.fn(),
      interrupt: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("creates a fresh conversation when /chat is opened with new=1", async () => {
    const existingConversation = buildConversation();
    const createConversation = vi.fn(() => buildConversation({
      id: "conv-2",
      title: "New chat",
      messages: [],
      createdAt: 3,
      updatedAt: 3,
    }));

    mockedUseStorage.mockReturnValue({
      index: [
        {
          id: existingConversation.id,
          title: existingConversation.title,
          createdAt: existingConversation.createdAt,
          updatedAt: existingConversation.updatedAt,
          modelId: existingConversation.modelId,
          modelRevision: existingConversation.modelRevision ?? null,
          modelSupportsImages: existingConversation.modelSupportsImages ?? null,
          recommendedDevice: existingConversation.recommendedDevice,
          supportTier: existingConversation.supportTier,
          messageCount: existingConversation.messages.length,
          sizeBytes: 0,
        },
      ],
      activeConversation: existingConversation,
      activeConversationId: existingConversation.id,
      setActiveConversation: vi.fn(),
      createConversation,
      updateConversation: vi.fn(),
      deleteConversation: vi.fn(),
      clearOldChats: vi.fn(),
      clearAllChats: vi.fn(),
      dismissStorageError: vi.fn(),
      storageStats: {
        usedBytes: 0,
        quotaBytes: 1024,
        conversationCount: 1,
      },
      storageError: null,
      ready: true,
      flushPendingSave: vi.fn(),
    });

    window.history.replaceState({}, "", "/chat?new=1");

    render(<HomeApp />);

    await waitFor(() => expect(createConversation).toHaveBeenCalledTimes(1));

    expect(createConversation).toHaveBeenCalledWith(expect.objectContaining({
      id: existingConversation.modelId,
      revision: existingConversation.modelRevision,
      supportsImages: existingConversation.modelSupportsImages,
      recommendedDevice: existingConversation.recommendedDevice,
      supportTier: existingConversation.supportTier,
    }));
    expect(window.location.pathname).toBe("/chat/onnx-community/Qwen2.5-0.5B-Instruct");
    expect(window.location.search).toBe("");
  });

  it("creates a fresh conversation with the model from a model route", async () => {
    const existingConversation = buildConversation();
    const createConversation = vi.fn(() => buildConversation({
      id: "conv-2",
      title: "New chat",
      messages: [],
      createdAt: 3,
      updatedAt: 3,
    }));

    mockedUseStorage.mockReturnValue({
      index: [
        {
          id: existingConversation.id,
          title: existingConversation.title,
          createdAt: existingConversation.createdAt,
          updatedAt: existingConversation.updatedAt,
          modelId: existingConversation.modelId,
          modelRevision: existingConversation.modelRevision ?? null,
          modelSupportsImages: existingConversation.modelSupportsImages ?? null,
          recommendedDevice: existingConversation.recommendedDevice,
          supportTier: existingConversation.supportTier,
          messageCount: existingConversation.messages.length,
          sizeBytes: 0,
        },
      ],
      activeConversation: existingConversation,
      activeConversationId: existingConversation.id,
      setActiveConversation: vi.fn(),
      createConversation,
      updateConversation: vi.fn(),
      deleteConversation: vi.fn(),
      clearOldChats: vi.fn(),
      clearAllChats: vi.fn(),
      dismissStorageError: vi.fn(),
      storageStats: {
        usedBytes: 0,
        quotaBytes: 1024,
        conversationCount: 1,
      },
      storageError: null,
      ready: true,
      flushPendingSave: vi.fn(),
    });

    render(
      <HomeApp
        forceNewChat
        initialModelId="onnx-community/Qwen3.5-2B-ONNX"
      />,
    );

    await waitFor(() => expect(createConversation).toHaveBeenCalledTimes(1));

    expect(createConversation).toHaveBeenCalledWith(expect.objectContaining({
      id: "onnx-community/Qwen3.5-2B-ONNX",
      revision: "d8ddc1cfd46bdefa6771b3a82097f3610a5b3ee4",
      supportsImages: true,
      recommendedDevice: "webgpu",
      supportTier: "curated",
    }));
  });

  it("keeps the URL synced when switching to a conversation with another model", async () => {
    const firstConversation = buildConversation();
    const secondConversation = buildConversation({
      id: "conv-2",
      title: "Second chat",
      modelId: "HuggingFaceTB/SmolLM3-3B-ONNX",
      modelRevision: "rev-2",
      modelSupportsImages: false,
      recommendedDevice: "webgpu",
      supportTier: "curated",
    });
    const setActiveConversation = vi.fn();
    const getStorageState = (activeConversation: Conversation) => ({
      index: [
        buildConversationMeta(firstConversation),
        buildConversationMeta(secondConversation),
      ],
      activeConversation,
      activeConversationId: activeConversation.id,
      setActiveConversation,
      createConversation: vi.fn(),
      updateConversation: vi.fn(),
      deleteConversation: vi.fn(),
      clearOldChats: vi.fn(),
      clearAllChats: vi.fn(),
      dismissStorageError: vi.fn(),
      storageStats: {
        usedBytes: 0,
        quotaBytes: 1024,
        conversationCount: 2,
      },
      storageError: null,
      ready: true,
      flushPendingSave: vi.fn(),
    });

    mockedUseStorage.mockReturnValue(getStorageState(firstConversation));

    const { getByTestId, rerender } = render(<HomeApp />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/chat/onnx-community/Qwen2.5-0.5B-Instruct");
    });

    fireEvent.click(getByTestId("switch-conversation"));

    expect(setActiveConversation).toHaveBeenCalledWith("conv-2");
    expect(window.location.pathname).toBe("/chat/HuggingFaceTB/SmolLM3-3B-ONNX");

    mockedUseStorage.mockReturnValue(getStorageState(secondConversation));
    rerender(<HomeApp />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/chat/HuggingFaceTB/SmolLM3-3B-ONNX");
    });
  });

  it("falls back to the default model when a restored conversation is missing model metadata", () => {
    const malformedConversation = buildConversation({
      modelId: undefined as unknown as string,
      modelRevision: undefined,
      modelSupportsImages: undefined,
      recommendedDevice: undefined,
      supportTier: undefined,
    });

    mockedUseStorage.mockReturnValue({
      index: [],
      activeConversation: malformedConversation,
      activeConversationId: malformedConversation.id,
      setActiveConversation: vi.fn(),
      createConversation: vi.fn(),
      updateConversation: vi.fn(),
      deleteConversation: vi.fn(),
      clearOldChats: vi.fn(),
      clearAllChats: vi.fn(),
      dismissStorageError: vi.fn(),
      storageStats: {
        usedBytes: 0,
        quotaBytes: 1024,
        conversationCount: 1,
      },
      storageError: null,
      ready: true,
      flushPendingSave: vi.fn(),
    });

    expect(() => render(<HomeApp />)).not.toThrow();
  });

  it("uses the last model selected from the dropdown for a new chat after switching conversations", async () => {
    localStorage.clear();

    const firstConversation = buildConversation();
    const secondConversation = buildConversation({
      id: "conv-2",
      title: "Second chat",
      modelId: "onnx-community/gemma-3-270m-it-ONNX",
      modelRevision: "rev-2",
      recommendedDevice: "webgpu",
      supportTier: "curated",
    });
    const createConversation = vi.fn();
    const updateConversation = vi.fn();

    mockedUseStorage.mockReturnValue({
      index: [
        {
          id: firstConversation.id,
          title: firstConversation.title,
          createdAt: firstConversation.createdAt,
          updatedAt: firstConversation.updatedAt,
          modelId: firstConversation.modelId,
          modelRevision: firstConversation.modelRevision ?? null,
          modelSupportsImages: firstConversation.modelSupportsImages ?? null,
          recommendedDevice: firstConversation.recommendedDevice,
          supportTier: firstConversation.supportTier,
          messageCount: firstConversation.messages.length,
          sizeBytes: 0,
        },
        {
          id: secondConversation.id,
          title: secondConversation.title,
          createdAt: secondConversation.createdAt,
          updatedAt: secondConversation.updatedAt,
          modelId: secondConversation.modelId,
          modelRevision: secondConversation.modelRevision ?? null,
          modelSupportsImages: secondConversation.modelSupportsImages ?? null,
          recommendedDevice: secondConversation.recommendedDevice,
          supportTier: secondConversation.supportTier,
          messageCount: secondConversation.messages.length,
          sizeBytes: 0,
        },
      ],
      activeConversation: firstConversation,
      activeConversationId: firstConversation.id,
      setActiveConversation: vi.fn(),
      createConversation,
      updateConversation,
      deleteConversation: vi.fn(),
      clearOldChats: vi.fn(),
      clearAllChats: vi.fn(),
      dismissStorageError: vi.fn(),
      storageStats: {
        usedBytes: 0,
        quotaBytes: 1024,
        conversationCount: 2,
      },
      storageError: null,
      ready: true,
      flushPendingSave: vi.fn(),
    });

    const { getByTestId, rerender } = render(<HomeApp />);

    fireEvent.click(getByTestId("model-selector"));

    expect(updateConversation).toHaveBeenCalledWith(expect.objectContaining({
      modelId: "onnx-community/Llama-3.2-1B-Instruct-q4f16",
      modelRevision: "custom-rev",
      recommendedDevice: "webgpu",
      supportTier: "community",
    }));
    expect(window.location.pathname).toBe("/chat/onnx-community/Llama-3.2-1B-Instruct-q4f16");

    mockedUseStorage.mockReturnValue({
      index: [
        {
          id: firstConversation.id,
          title: firstConversation.title,
          createdAt: firstConversation.createdAt,
          updatedAt: firstConversation.updatedAt,
          modelId: firstConversation.modelId,
          modelRevision: firstConversation.modelRevision ?? null,
          modelSupportsImages: firstConversation.modelSupportsImages ?? null,
          recommendedDevice: firstConversation.recommendedDevice,
          supportTier: firstConversation.supportTier,
          messageCount: firstConversation.messages.length,
          sizeBytes: 0,
        },
        {
          id: secondConversation.id,
          title: secondConversation.title,
          createdAt: secondConversation.createdAt,
          updatedAt: secondConversation.updatedAt,
          modelId: secondConversation.modelId,
          modelRevision: secondConversation.modelRevision ?? null,
          modelSupportsImages: secondConversation.modelSupportsImages ?? null,
          recommendedDevice: secondConversation.recommendedDevice,
          supportTier: secondConversation.supportTier,
          messageCount: secondConversation.messages.length,
          sizeBytes: 0,
        },
      ],
      activeConversation: secondConversation,
      activeConversationId: secondConversation.id,
      setActiveConversation: vi.fn(),
      createConversation,
      updateConversation,
      deleteConversation: vi.fn(),
      clearOldChats: vi.fn(),
      clearAllChats: vi.fn(),
      dismissStorageError: vi.fn(),
      storageStats: {
        usedBytes: 0,
        quotaBytes: 1024,
        conversationCount: 2,
      },
      storageError: null,
      ready: true,
      flushPendingSave: vi.fn(),
    });

    rerender(<HomeApp />);

    fireEvent.click(getByTestId("new-chat"));

    expect(createConversation).toHaveBeenLastCalledWith(expect.objectContaining({
      id: "onnx-community/Llama-3.2-1B-Instruct-q4f16",
      revision: "custom-rev",
      supportsImages: false,
      recommendedDevice: "webgpu",
      supportTier: "community",
    }));
  });

  it("regenerates the last assistant answer in place", () => {
    const conversation = buildConversation({
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "Hello",
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Old answer",
          thinking: "Old thinking",
          debug: {
            modelInput: "old input",
            rawOutput: "old output",
          },
        },
      ],
    });
    const updateConversation = vi.fn();
    const generate = vi.fn();

    mockedUseInferenceWorker.mockReturnValue({
      status: "loaded",
      error: null,
      loadedModel: conversation.modelId,
      loadedRevision: conversation.modelRevision ?? null,
      loadedDevice: "webgpu",
      loadedPrecision: "fp16",
      loadedSupportsImages: false,
      progress: null,
      totalProgress: null,
      loadingMessage: "",
      processingMessage: "",
      tps: 0,
      numTokens: 0,
      onPromptRef: { current: null },
      onRawTokenRef: { current: null },
      onTokenRef: { current: null },
      onThinkingCompleteRef: { current: null },
      onCompleteRef: { current: null },
      loadModel: vi.fn(),
      generate,
      interrupt: vi.fn(),
      reset: vi.fn(),
    });
    mockedUseStorage.mockReturnValue({
      index: [],
      activeConversation: conversation,
      activeConversationId: conversation.id,
      setActiveConversation: vi.fn(),
      createConversation: vi.fn(),
      updateConversation,
      deleteConversation: vi.fn(),
      clearOldChats: vi.fn(),
      clearAllChats: vi.fn(),
      dismissStorageError: vi.fn(),
      storageStats: {
        usedBytes: 0,
        quotaBytes: 1024,
        conversationCount: 1,
      },
      storageError: null,
      ready: true,
      flushPendingSave: vi.fn(),
    });

    const { getByTestId } = render(<HomeApp />);

    fireEvent.click(getByTestId("regenerate-answer"));

    expect(updateConversation).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        conversation.messages[0],
        expect.objectContaining({
          id: "assistant-1",
          role: "assistant",
          content: "",
          thinking: undefined,
          debug: {
            modelInput: "",
            rawOutput: "",
          },
        }),
      ],
    }));
    expect(generate).toHaveBeenCalledWith([conversation.messages[0]], expect.any(Object));
  });

  it("deletes only the last assistant answer", () => {
    const conversation = buildConversation({
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "Hello",
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Answer",
        },
      ],
    });
    const updateConversation = vi.fn();

    mockedUseStorage.mockReturnValue({
      index: [],
      activeConversation: conversation,
      activeConversationId: conversation.id,
      setActiveConversation: vi.fn(),
      createConversation: vi.fn(),
      updateConversation,
      deleteConversation: vi.fn(),
      clearOldChats: vi.fn(),
      clearAllChats: vi.fn(),
      dismissStorageError: vi.fn(),
      storageStats: {
        usedBytes: 0,
        quotaBytes: 1024,
        conversationCount: 1,
      },
      storageError: null,
      ready: true,
      flushPendingSave: vi.fn(),
    });

    const { getByTestId } = render(<HomeApp />);

    fireEvent.click(getByTestId("delete-answer"));

    expect(updateConversation).toHaveBeenCalledWith(expect.objectContaining({
      messages: [conversation.messages[0]],
    }));
  });

  it("edits the last message in place", () => {
    const conversation = buildConversation({
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "Hello",
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Answer",
        },
      ],
    });
    const updateConversation = vi.fn();

    mockedUseStorage.mockReturnValue({
      index: [],
      activeConversation: conversation,
      activeConversationId: conversation.id,
      setActiveConversation: vi.fn(),
      createConversation: vi.fn(),
      updateConversation,
      deleteConversation: vi.fn(),
      clearOldChats: vi.fn(),
      clearAllChats: vi.fn(),
      dismissStorageError: vi.fn(),
      storageStats: {
        usedBytes: 0,
        quotaBytes: 1024,
        conversationCount: 1,
      },
      storageError: null,
      ready: true,
      flushPendingSave: vi.fn(),
    });

    const { getByTestId } = render(<HomeApp />);

    fireEvent.click(getByTestId("edit-message"));

    expect(updateConversation).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        conversation.messages[0],
        expect.objectContaining({
          id: "assistant-1",
          role: "assistant",
          content: "Edited answer",
        }),
      ],
    }));
  });

  it("preserves streamed assistant content when completion arrives before a rerender", () => {
    const conversation = buildConversation({
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "Hello",
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: "",
          debug: {
            modelInput: "",
            rawOutput: "",
          },
        },
      ],
    });
    const updateConversation = vi.fn();
    const flushPendingSave = vi.fn();
    const onTokenRef = { current: null as ((token: string, isThinking?: boolean) => void) | null };
    const onCompleteRef = { current: null as ((stats: GenerationStats) => void) | null };

    mockedUseInferenceWorker.mockReturnValue({
      status: "generating",
      error: null,
      loadedModel: conversation.modelId,
      loadedRevision: conversation.modelRevision ?? null,
      loadedDevice: "webgpu",
      loadedPrecision: "fp16",
      loadedSupportsImages: false,
      progress: null,
      totalProgress: null,
      loadingMessage: "",
      processingMessage: "",
      tps: 0,
      numTokens: 0,
      onPromptRef: { current: null },
      onRawTokenRef: { current: null },
      onTokenRef,
      onThinkingCompleteRef: { current: null },
      onCompleteRef,
      loadModel: vi.fn(),
      generate: vi.fn(),
      interrupt: vi.fn(),
      reset: vi.fn(),
    });
    mockedUseStorage.mockReturnValue({
      index: [],
      activeConversation: conversation,
      activeConversationId: conversation.id,
      setActiveConversation: vi.fn(),
      createConversation: vi.fn(),
      updateConversation,
      deleteConversation: vi.fn(),
      clearOldChats: vi.fn(),
      clearAllChats: vi.fn(),
      dismissStorageError: vi.fn(),
      storageStats: {
        usedBytes: 0,
        quotaBytes: 1024,
        conversationCount: 1,
      },
      storageError: null,
      ready: true,
      flushPendingSave,
    });

    render(<HomeApp />);

    act(() => {
      onTokenRef.current?.("Visible answer");
      onCompleteRef.current?.({
        tps: 4,
        numTokens: 4,
        generationTime: 1.8,
        stopReason: "eos_token",
      });
    });

    expect(updateConversation).toHaveBeenLastCalledWith(expect.objectContaining({
      messages: [
        conversation.messages[0],
        expect.objectContaining({
          id: "assistant-1",
          content: "Visible answer",
          stats: {
            tps: 4,
            numTokens: 4,
            generationTime: 1.8,
            stopReason: "eos_token",
          },
        }),
      ],
    }));
    expect(flushPendingSave).toHaveBeenCalled();
  });
});
