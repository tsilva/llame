"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Conversation, ConversationMeta, ModelSelection, StorageErrorState, StorageStats } from "@/types";
import { DEFAULT_MODEL, getModelSelection } from "@/lib/constants";
import * as storage from "@/lib/storage";
import { captureTelemetryError } from "@/lib/telemetry";

export type StorageWarning = "none" | "warning" | "critical";

function createConversationRecord(model?: string | ModelSelection): Conversation {
  const selection = typeof model === "string"
    ? getModelSelection(model)
    : model ?? getModelSelection(DEFAULT_MODEL);

  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    modelId: selection.id,
    modelRevision: selection.revision ?? null,
    modelSupportsImages: selection.supportsImages ?? null,
    recommendedDevice: selection.recommendedDevice,
    supportTier: selection.supportTier,
  };
}

function getConversationSelection(conversation: Conversation | null): ModelSelection {
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

function sortByUpdatedAt(conversations: ConversationMeta[]) {
  return [...conversations].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function useStorage() {
  const [index, setIndex] = useState<ConversationMeta[]>([]);
  const [activeConversation, setActiveConvState] = useState<Conversation | null>(null);
  const [activeConversationId, setActiveIdState] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats>({
    usedBytes: 0,
    quotaBytes: 50 * 1024 * 1024,
    conversationCount: 0,
  });
  const [storageError, setStorageError] = useState<StorageErrorState | null>(null);
  const [ready, setReady] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConvRef = useRef<Conversation | null>(null);
  const indexRef = useRef<ConversationMeta[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const refreshStats = useCallback(async (idx: ConversationMeta[]) => {
    setStorageStats(await storage.getStorageStats(idx));
  }, []);

  const reportStorageError = useCallback((error: StorageErrorState, context: Record<string, string | number | boolean | null | undefined> = {}) => {
    setStorageError(error);
    captureTelemetryError(error.message, {
      ...context,
      storage_code: error.code,
    });
  }, []);

  const persistConversation = useCallback(async (conversation: Conversation) => {
    try {
      const meta = await storage.saveConversation(conversation);
      setIndex((current) => {
        const next = current.filter((item) => item.id !== conversation.id);
        next.push(meta);
        indexRef.current = next;
        return next;
      });
      await refreshStats(indexRef.current);
      setStorageError((current) => (
        current?.code === "WRITE_FAILED" || current?.code === "QUOTA_EXCEEDED"
          ? null
          : current
      ));
    } catch (error) {
      reportStorageError(error as StorageErrorState, {
        conversation_id: conversation.id,
      });
    }
  }, [refreshStats, reportStorageError]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (pendingConvRef.current) {
      const conversation = pendingConvRef.current;
      pendingConvRef.current = null;
      await persistConversation(conversation);
    }
  }, [persistConversation]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    void (async () => {
      const migrationError = await storage.migrateLegacyStorage();
      if (cancelled) return;

      if (migrationError) {
        reportStorageError(migrationError);
      }

      try {
        const nextIndex = await storage.listConversationMeta();
        if (cancelled) return;

        setIndex(nextIndex);
        indexRef.current = nextIndex;
        await refreshStats(nextIndex);

        const persistedActiveId = storage.getPersistedActiveConversationId();
        const initialActiveId = persistedActiveId && nextIndex.some((item) => item.id === persistedActiveId)
          ? persistedActiveId
          : sortByUpdatedAt(nextIndex)[0]?.id ?? null;

        if (initialActiveId) {
          const conversation = await storage.loadConversation(initialActiveId);
          if (cancelled) return;

          setActiveIdState(initialActiveId);
          setActiveConvState(conversation);
          storage.setPersistedActiveConversationId(initialActiveId);
        }

        setReady(true);
      } catch (error) {
        if (cancelled) return;
        reportStorageError(error as StorageErrorState);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      void flushPendingSave();
    };
  }, [flushPendingSave, refreshStats, reportStorageError]);

  const setActiveConversation = useCallback((id: string) => {
    void (async () => {
      await flushPendingSave();

      try {
        const conversation = await storage.loadConversation(id);
        if (!conversation) return;
        setActiveIdState(id);
        setActiveConvState(conversation);
        storage.setPersistedActiveConversationId(id);
      } catch (error) {
        reportStorageError(error as StorageErrorState, { conversation_id: id });
      }
    })();
  }, [flushPendingSave, reportStorageError]);

  const createConversation = useCallback((model?: string | ModelSelection): Conversation => {
    const conversation = createConversationRecord(model);
    const meta = storage.buildMeta(conversation);
    const nextIndex = indexRef.current.filter((item) => item.id !== conversation.id);
    nextIndex.push(meta);

    setIndex(nextIndex);
    indexRef.current = nextIndex;
    setActiveIdState(conversation.id);
    setActiveConvState(conversation);
    storage.setPersistedActiveConversationId(conversation.id);
    void refreshStats(nextIndex);
    void persistConversation(conversation);

    return conversation;
  }, [persistConversation, refreshStats]);

  const updateConversation = useCallback((conversation: Conversation) => {
    setActiveConvState(conversation);
    pendingConvRef.current = conversation;

    const meta = storage.buildMeta(conversation);
    setIndex((current) => {
      const next = current.filter((item) => item.id !== conversation.id);
      next.push(meta);
      indexRef.current = next;
      return next;
    });
    storage.setPersistedActiveConversationId(conversation.id);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (pendingConvRef.current) {
        const pendingConversation = pendingConvRef.current;
        pendingConvRef.current = null;
        void persistConversation(pendingConversation);
      }
    }, 300);
  }, [persistConversation]);

  const deleteConversation = useCallback((id: string) => {
    const isActiveConversation = activeConversationIdRef.current === id;

    if (pendingConvRef.current?.id === id) {
      pendingConvRef.current = null;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    }

    const nextIndex = indexRef.current.filter((item) => item.id !== id);

    if (isActiveConversation) {
      const replacementConversation = createConversationRecord(getConversationSelection(activeConversation));
      nextIndex.push(storage.buildMeta(replacementConversation));
      setActiveIdState(replacementConversation.id);
      setActiveConvState(replacementConversation);
      storage.setPersistedActiveConversationId(replacementConversation.id);
      void persistConversation(replacementConversation);
    }

    setIndex(nextIndex);
    indexRef.current = nextIndex;
    void refreshStats(nextIndex);

    void storage.deleteConversation(id).catch((error) => {
      reportStorageError(error as StorageErrorState, { conversation_id: id });
    });
  }, [activeConversation, persistConversation, refreshStats, reportStorageError]);

  const clearOldChats = useCallback(async () => {
    const activeId = activeConversationIdRef.current;
    const idsToDelete = indexRef.current
      .filter((item) => item.id !== activeId)
      .map((item) => item.id);

    try {
      await flushPendingSave();
      await storage.deleteConversations(idsToDelete);
      const nextIndex = indexRef.current.filter((item) => item.id === activeId);
      setIndex(nextIndex);
      indexRef.current = nextIndex;
      await refreshStats(nextIndex);
      setStorageError(null);
    } catch (error) {
      reportStorageError(error as StorageErrorState);
    }
  }, [flushPendingSave, refreshStats, reportStorageError]);

  const clearAllChats = useCallback(async (): Promise<string> => {
    try {
      await flushPendingSave();
      await storage.clearAllConversations();
      const newConversation = createConversationRecord(getModelSelection(DEFAULT_MODEL));
      await storage.saveConversation(newConversation);
      const nextIndex = [storage.buildMeta(newConversation)];
      setIndex(nextIndex);
      indexRef.current = nextIndex;
      setActiveIdState(newConversation.id);
      setActiveConvState(newConversation);
      storage.setPersistedActiveConversationId(newConversation.id);
      await refreshStats(nextIndex);
      return newConversation.id;
    } catch (error) {
      reportStorageError(error as StorageErrorState);
      return activeConversationIdRef.current ?? "";
    }
  }, [flushPendingSave, refreshStats, reportStorageError]);

  const dismissStorageError = useCallback(() => {
    setStorageError(null);
  }, []);

  const usageRatio = storageStats.quotaBytes > 0
    ? storageStats.usedBytes / storageStats.quotaBytes
    : 0;
  const storageWarning: StorageWarning =
    usageRatio > 0.95
      ? "critical"
      : usageRatio > 0.8
        ? "warning"
        : "none";

  return {
    index,
    activeConversation,
    activeConversationId,
    setActiveConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    clearOldChats,
    clearAllChats,
    storageStats,
    storageWarning,
    storageError,
    dismissStorageError,
    flushPendingSave,
    ready,
  };
}
