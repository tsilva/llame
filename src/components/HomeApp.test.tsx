import { render, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import HomeApp from "@/components/HomeApp";
import { useInferenceWorker } from "@/hooks/useInferenceWorker";
import { useStorage } from "@/hooks/useStorage";
import { Conversation } from "@/types";

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
  ChatInterface: () => <div data-testid="chat-interface" />,
}));

vi.mock("@/components/ModelSelector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

vi.mock("@/components/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
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

beforeAll(() => {
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
    expect(window.location.pathname).toBe("/chat");
    expect(window.location.search).toBe("");
  });
});
