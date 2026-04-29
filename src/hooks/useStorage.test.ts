import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStorage } from "@/hooks/useStorage";
import {
  __resetStorageForTests,
  loadConversation,
  saveConversation,
  setPersistedActiveConversationId,
} from "@/lib/storage";

vi.mock("@/lib/telemetry", () => ({
  captureTelemetryError: vi.fn(),
}));

function deleteDatabase(name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe("useStorage", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    localStorage.clear();
    __resetStorageForTests();
    await deleteDatabase("llame");
  });

  it("creates a fresh draft when deleting the active conversation", async () => {
    const { result } = renderHook(() => useStorage());

    await waitFor(() => expect(result.current.ready).toBe(true));

    let firstId = "";
    let deletedId = "";

    act(() => {
      firstId = result.current.createConversation().id;
    });

    act(() => {
      const conversation = result.current.activeConversation;
      if (!conversation) {
        throw new Error("Expected an active conversation before updating it.");
      }

      result.current.updateConversation({
        ...conversation,
        title: "First chat",
        updatedAt: Date.now(),
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "Hello",
          },
        ],
      });
    });

    act(() => {
      deletedId = result.current.createConversation().id;
    });

    act(() => {
      result.current.deleteConversation(deletedId);
    });

    await waitFor(() => expect(result.current.activeConversationId).not.toBe(deletedId));

    expect(result.current.activeConversationId).not.toBe(firstId);
    expect(result.current.activeConversation?.title).toBe("New chat");
    expect(result.current.activeConversation?.messages).toEqual([]);
    expect(result.current.index.map((item) => item.id)).toContain(firstId);
    expect(result.current.index.map((item) => item.id)).not.toContain(deletedId);
  });

  it("reuses the active draft instead of creating a second empty conversation", async () => {
    const { result } = renderHook(() => useStorage());

    await waitFor(() => expect(result.current.ready).toBe(true));

    let firstId = "";
    let secondId = "";

    act(() => {
      firstId = result.current.createConversation().id;
    });

    act(() => {
      secondId = result.current.createConversation().id;
    });

    expect(secondId).toBe(firstId);
    expect(result.current.index.filter((item) => item.messageCount === 0)).toHaveLength(1);
    expect(result.current.activeConversationId).toBe(firstId);
  });

  it("preserves the active model when creating a new conversation without an explicit model", async () => {
    const { result } = renderHook(() => useStorage());

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.createConversation({
        id: "onnx-community/Qwen2.5-0.5B-Instruct",
        revision: "cc5cc01a65cc3ff17bdb73a7de33d879f62599b0",
        supportsImages: false,
        recommendedDevice: "webgpu",
        supportTier: "curated",
      });
    });

    act(() => {
      const conversation = result.current.activeConversation;
      if (!conversation) {
        throw new Error("Expected an active conversation before updating it.");
      }

      result.current.updateConversation({
        ...conversation,
        title: "Existing chat",
        updatedAt: Date.now(),
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "Hello",
          },
        ],
      });
    });

    act(() => {
      result.current.createConversation();
    });

    expect(result.current.activeConversation?.title).toBe("New chat");
    expect(result.current.activeConversation?.messages).toEqual([]);
    expect(result.current.activeConversation?.modelId).toBe("onnx-community/Qwen2.5-0.5B-Instruct");
    expect(result.current.activeConversation?.recommendedDevice).toBe("webgpu");
    expect(result.current.activeConversation?.supportTier).toBe("curated");
  });

  it("does not restore a deleted active conversation from the pending save timer", async () => {
    const { result } = renderHook(() => useStorage());

    await waitFor(() => expect(result.current.ready).toBe(true));

    let deletedId = "";

    act(() => {
      deletedId = result.current.createConversation().id;
    });

    await waitFor(() => expect(result.current.activeConversationId).toBe(deletedId));

    act(() => {
      const conversation = result.current.activeConversation;
      expect(conversation?.id).toBe(deletedId);
      if (!conversation) {
        throw new Error("Expected an active conversation before deleting it.");
      }

      result.current.updateConversation({
        ...conversation,
        title: "Draft to delete",
        updatedAt: Date.now(),
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "Hello",
          },
        ],
      });
    });

    act(() => {
      result.current.deleteConversation(deletedId);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    await waitFor(() => expect(result.current.activeConversationId).not.toBe(deletedId));
    await expect(loadConversation(deletedId)).resolves.toBeNull();
  });

  it("deduplicates restored empty drafts on load", async () => {
    const keptDraft = {
      id: "draft-keep",
      title: "New chat",
      messages: [],
      createdAt: 10,
      updatedAt: 20,
      modelId: "onnx-community/Qwen2.5-0.5B-Instruct",
      modelRevision: "rev-1",
      modelSupportsImages: false,
      recommendedDevice: "webgpu" as const,
      supportTier: "curated" as const,
    };
    const deletedDraft = {
      ...keptDraft,
      id: "draft-delete",
      createdAt: 30,
      updatedAt: 40,
    };

    await saveConversation(keptDraft);
    await saveConversation(deletedDraft);
    setPersistedActiveConversationId(keptDraft.id);

    const { result } = renderHook(() => useStorage());

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.index.filter((item) => item.messageCount === 0)).toHaveLength(1);
    expect(result.current.activeConversationId).toBe(keptDraft.id);
    await expect(loadConversation(keptDraft.id)).resolves.toEqual(expect.objectContaining({ id: keptDraft.id }));
    await expect(loadConversation(deletedDraft.id)).resolves.toBeNull();
  });

  it("preserves the current model when clearing all chats", async () => {
    const { result } = renderHook(() => useStorage());

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.createConversation({
        id: "onnx-community/Qwen2.5-0.5B-Instruct",
        revision: "cc5cc01a65cc3ff17bdb73a7de33d879f62599b0",
        supportsImages: false,
        recommendedDevice: "webgpu",
        supportTier: "curated",
      });
    });

    await waitFor(() => expect(result.current.activeConversation?.modelId).toBe("onnx-community/Qwen2.5-0.5B-Instruct"));

    await act(async () => {
      await result.current.clearAllChats();
    });

    expect(result.current.index).toHaveLength(1);
    expect(result.current.activeConversation?.title).toBe("New chat");
    expect(result.current.activeConversation?.modelId).toBe("onnx-community/Qwen2.5-0.5B-Instruct");
    expect(result.current.activeConversation?.recommendedDevice).toBe("webgpu");
    expect(result.current.activeConversation?.supportTier).toBe("curated");
  });
});
