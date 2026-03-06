import { Conversation, ConversationMeta, StorageStats } from "@/types";

const KEYS = {
  INDEX: "llame-conversations-index",
  VERSION: "llame-storage-version",
  SELECTED_MODEL: "llame-selected-model",
  OLD_CONVERSATIONS: "llame-conversations",
};

const CURRENT_VERSION = "2";

function conversationKey(id: string): string {
  return `llame-conversation-${id}`;
}

function buildMeta(conv: Conversation): ConversationMeta {
  const serialized = JSON.stringify(conv);
  return {
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    modelId: conv.modelId,
    messageCount: conv.messages.length,
    sizeBytes: new Blob([serialized]).size,
  };
}

export function ensureMigrated(): void {
  if (typeof window === "undefined") return;

  const version = localStorage.getItem(KEYS.VERSION);
  if (version === CURRENT_VERSION) return;

  const oldData = localStorage.getItem(KEYS.OLD_CONVERSATIONS);
  if (!oldData) {
    // No old data, just set version
    localStorage.setItem(KEYS.VERSION, CURRENT_VERSION);
    saveIndex([]);
    return;
  }

  try {
    const conversations: Conversation[] = JSON.parse(oldData);
    const index: ConversationMeta[] = [];

    // Write individual conversations first
    for (const conv of conversations) {
      localStorage.setItem(conversationKey(conv.id), JSON.stringify(conv));
      index.push(buildMeta(conv));
    }

    // Write index
    saveIndex(index);

    // Set version flag (marks migration as complete)
    localStorage.setItem(KEYS.VERSION, CURRENT_VERSION);

    // Only delete old key after version flag is set
    localStorage.removeItem(KEYS.OLD_CONVERSATIONS);
  } catch {
    // Partial failure is safe — old key preserved until version flag set
  }
}

export function loadIndex(): ConversationMeta[] {
  try {
    const data = localStorage.getItem(KEYS.INDEX);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveIndex(index: ConversationMeta[]): void {
  localStorage.setItem(KEYS.INDEX, JSON.stringify(index));
}

export function loadConversation(id: string): Conversation | null {
  try {
    const data = localStorage.getItem(conversationKey(id));
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveConversation(conv: Conversation, index: ConversationMeta[]): ConversationMeta[] {
  const meta = buildMeta(conv);
  const newIndex = index.filter((m) => m.id !== conv.id);
  newIndex.push(meta);

  safeSave(conversationKey(conv.id), JSON.stringify(conv), conv.id, newIndex);
  saveIndex(newIndex);
  return newIndex;
}

export function deleteConversation(id: string, index: ConversationMeta[]): ConversationMeta[] {
  localStorage.removeItem(conversationKey(id));
  const newIndex = index.filter((m) => m.id !== id);
  saveIndex(newIndex);
  return newIndex;
}

export function getStorageStats(index: ConversationMeta[]): StorageStats {
  let usedBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("llame-")) {
        const value = localStorage.getItem(key);
        if (value) {
          usedBytes += new Blob([key + value]).size;
        }
      }
    }
  } catch {
    // Ignore
  }

  return {
    usedBytes,
    quotaBytes: 5 * 1024 * 1024, // 5MB estimate
    conversationCount: index.length,
  };
}

function safeSave(key: string, value: string, activeId: string, index: ConversationMeta[]): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      evictOldestConversations(new Blob([value]).size, activeId, index);
      try {
        localStorage.setItem(key, value);
      } catch {
        // Give up
      }
    }
  }
}

function evictOldestConversations(targetFreeBytes: number, activeId: string, index: ConversationMeta[]): void {
  const sortedByAge = [...index]
    .filter((m) => m.id !== activeId)
    .sort((a, b) => a.updatedAt - b.updatedAt);

  let freed = 0;
  for (const meta of sortedByAge) {
    if (freed >= targetFreeBytes) break;
    localStorage.removeItem(conversationKey(meta.id));
    freed += meta.sizeBytes;
    // Remove from index in place
    const idx = index.findIndex((m) => m.id === meta.id);
    if (idx !== -1) index.splice(idx, 1);
  }
  saveIndex(index);
}
