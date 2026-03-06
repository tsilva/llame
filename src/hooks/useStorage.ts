"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Conversation, ConversationMeta, StorageStats } from "@/types";
import * as storage from "@/lib/storage";

export type StorageWarning = "none" | "warning" | "critical";

export function useStorage() {
  const [index, setIndex] = useState<ConversationMeta[]>([]);
  const [activeConversation, setActiveConvState] = useState<Conversation | null>(null);
  const [activeConversationId, setActiveIdState] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats>({
    usedBytes: 0,
    quotaBytes: 5 * 1024 * 1024,
    conversationCount: 0,
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConvRef = useRef<Conversation | null>(null);
  const indexRef = useRef<ConversationMeta[]>([]);

  // Keep ref in sync
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const refreshStats = useCallback((idx: ConversationMeta[]) => {
    setStorageStats(storage.getStorageStats(idx));
  }, []);

  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (pendingConvRef.current) {
      const conv = pendingConvRef.current;
      pendingConvRef.current = null;
      const newIndex = storage.saveConversation(conv, indexRef.current);
      setIndex(newIndex);
      indexRef.current = newIndex;
      refreshStats(newIndex);
    }
  }, [refreshStats]);

  // Initialize on mount — setState is intentional for one-time hydration from localStorage
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;

    storage.ensureMigrated();
    const idx = storage.loadIndex();
    setIndex(idx);
    indexRef.current = idx;
    refreshStats(idx);

    // Set most recent as active
    if (idx.length > 0) {
      const sorted = [...idx].sort((a, b) => b.updatedAt - a.updatedAt);
      const conv = storage.loadConversation(sorted[0].id);
      if (conv) {
        setActiveIdState(sorted[0].id);
        setActiveConvState(conv);
      }
    }

    return () => {
      // Flush on unmount
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingConvRef.current) {
        storage.saveConversation(pendingConvRef.current, indexRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const setActiveConversation = useCallback(
    (id: string) => {
      // Flush any pending save for the previous conversation
      flushPendingSave();

      const conv = storage.loadConversation(id);
      if (conv) {
        setActiveIdState(id);
        setActiveConvState(conv);
      }
    },
    [flushPendingSave]
  );

  const createConversation = useCallback(
    (modelId: string): Conversation => {
      // Flush any pending save
      flushPendingSave();

      const conv: Conversation = {
        id: crypto.randomUUID(),
        title: "New chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        modelId,
      };

      const newIndex = storage.saveConversation(conv, indexRef.current);
      setIndex(newIndex);
      indexRef.current = newIndex;
      setActiveIdState(conv.id);
      setActiveConvState(conv);
      refreshStats(newIndex);
      return conv;
    },
    [flushPendingSave, refreshStats]
  );

  const updateConversation = useCallback(
    (conv: Conversation) => {
      // Immediate in-memory update
      setActiveConvState(conv);
      pendingConvRef.current = conv;

      // Update index immediately in memory for sidebar
      setIndex((prev) => {
        const serialized = JSON.stringify(conv);
        const meta: ConversationMeta = {
          id: conv.id,
          title: conv.title,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          modelId: conv.modelId,
          messageCount: conv.messages.length,
          sizeBytes: new Blob([serialized]).size,
        };
        const newIndex = prev.filter((m) => m.id !== conv.id);
        newIndex.push(meta);
        indexRef.current = newIndex;
        return newIndex;
      });

      // Debounced localStorage write
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        if (pendingConvRef.current) {
          const pending = pendingConvRef.current;
          pendingConvRef.current = null;
          const newIndex = storage.saveConversation(pending, indexRef.current);
          setIndex(newIndex);
          indexRef.current = newIndex;
          refreshStats(newIndex);
        }
      }, 300);
    },
    [refreshStats]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      // Cancel pending save if it's for this conversation
      if (pendingConvRef.current?.id === id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        pendingConvRef.current = null;
      }

      const newIndex = storage.deleteConversation(id, indexRef.current);
      setIndex(newIndex);
      indexRef.current = newIndex;
      refreshStats(newIndex);

      if (activeConversationId === id) {
        if (newIndex.length > 0) {
          const sorted = [...newIndex].sort((a, b) => b.updatedAt - a.updatedAt);
          const conv = storage.loadConversation(sorted[0].id);
          if (conv) {
            setActiveIdState(sorted[0].id);
            setActiveConvState(conv);
            return sorted[0].modelId;
          }
        }
        setActiveIdState(null);
        setActiveConvState(null);
      }
      return null;
    },
    [activeConversationId, refreshStats]
  );

  const clearOldChats = useCallback(() => {
    // Delete all except active conversation
    const toDelete = index.filter((m) => m.id !== activeConversationId);
    let currentIndex = indexRef.current;
    for (const meta of toDelete) {
      currentIndex = storage.deleteConversation(meta.id, currentIndex);
    }
    setIndex(currentIndex);
    indexRef.current = currentIndex;
    refreshStats(currentIndex);
  }, [index, activeConversationId, refreshStats]);

  const clearAllChats = useCallback(
    (modelId: string): string => {
      // Cancel any pending save
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingConvRef.current = null;

      // Delete all conversations from storage
      const currentIndex = indexRef.current;
      for (const meta of currentIndex) {
        storage.deleteConversation(meta.id, currentIndex);
      }

      // Create a fresh conversation
      const newConv: Conversation = {
        id: crypto.randomUUID(),
        title: "New chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        modelId,
      };

      const newIndex = storage.saveConversation(newConv, []);
      setIndex(newIndex);
      indexRef.current = newIndex;
      setActiveIdState(newConv.id);
      setActiveConvState(newConv);
      refreshStats(newIndex);

      return newConv.id;
    },
    [refreshStats]
  );

  const storageWarning: StorageWarning =
    storageStats.usedBytes / storageStats.quotaBytes > 0.95
      ? "critical"
      : storageStats.usedBytes / storageStats.quotaBytes > 0.8
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
    flushPendingSave,
  };
}
