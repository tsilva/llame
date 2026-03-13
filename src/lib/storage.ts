import { Conversation, ConversationMeta, StorageErrorCode, StorageErrorState, StorageStats } from "@/types";

const DB_NAME = "llame";
const DB_VERSION = 1;
const CONVERSATION_STORE = "conversations";

const KEYS = {
  INDEX: "llame-conversations-index",
  VERSION: "llame-storage-version",
  LEGACY_CONVERSATIONS: "llame-conversations",
  ACTIVE_CONVERSATION: "llame-active-conversation",
};

const CURRENT_VERSION = "3";

let dbPromise: Promise<IDBDatabase> | null = null;
let dbInstance: IDBDatabase | null = null;

function makeStorageError(code: StorageErrorCode, message: string): StorageErrorState {
  return { code, message };
}

function supportsIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function conversationKey(id: string): string {
  return `llame-conversation-${id}`;
}

export function buildMeta(conv: Conversation): ConversationMeta {
  const serialized = JSON.stringify(conv);
  return {
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    modelId: conv.modelId,
    modelRevision: conv.modelRevision ?? null,
    modelSupportsImages: conv.modelSupportsImages ?? null,
    recommendedDevice: conv.recommendedDevice,
    supportTier: conv.supportTier,
    messageCount: conv.messages.length,
    sizeBytes: new Blob([serialized]).size,
  };
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

async function getDb() {
  if (!supportsIndexedDb()) {
    throw makeStorageError("IDB_UNAVAILABLE", "IndexedDB is unavailable in this browser.");
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CONVERSATION_STORE)) {
          db.createObjectStore(CONVERSATION_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
    });
  }

  return dbPromise;
}

function readLegacyIndexedConversations(): Conversation[] {
  const indexed = localStorage.getItem(KEYS.INDEX);
  if (!indexed) return [];

  try {
    const index = JSON.parse(indexed) as ConversationMeta[];
    return index
      .map((meta) => {
        const raw = localStorage.getItem(conversationKey(meta.id));
        return raw ? (JSON.parse(raw) as Conversation) : null;
      })
      .filter((value): value is Conversation => value !== null);
  } catch {
    return [];
  }
}

function readLegacySingleBlob(): Conversation[] {
  const raw = localStorage.getItem(KEYS.LEGACY_CONVERSATIONS);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

function clearLegacyConversationKeys(conversations: Conversation[]) {
  localStorage.removeItem(KEYS.INDEX);
  localStorage.removeItem(KEYS.LEGACY_CONVERSATIONS);
  conversations.forEach((conversation) => {
    localStorage.removeItem(conversationKey(conversation.id));
  });
}

export async function migrateLegacyStorage(): Promise<StorageErrorState | null> {
  if (typeof window === "undefined") return null;

  const version = localStorage.getItem(KEYS.VERSION);
  if (version === CURRENT_VERSION) return null;

  const legacyConversations = readLegacyIndexedConversations();
  const conversations = legacyConversations.length > 0
    ? legacyConversations
    : readLegacySingleBlob();

  try {
    if (conversations.length > 0) {
      const db = await getDb();
      const transaction = db.transaction(CONVERSATION_STORE, "readwrite");
      const store = transaction.objectStore(CONVERSATION_STORE);

      conversations.forEach((conversation) => {
        store.put(conversation);
      });

      await transactionDone(transaction);

      for (const conversation of conversations) {
        const storedConversation = await loadConversation(conversation.id);
        if (!storedConversation) {
          throw new Error(`Failed to verify migrated conversation ${conversation.id}`);
        }
      }
    }

    localStorage.setItem(KEYS.VERSION, CURRENT_VERSION);
    clearLegacyConversationKeys(conversations);
    return null;
  } catch (error) {
    return makeStorageError(
      "MIGRATION_FAILED",
      error instanceof Error ? error.message : "Failed to migrate existing conversations.",
    );
  }
}

export async function listConversationMeta(): Promise<ConversationMeta[]> {
  try {
    const db = await getDb();
    const transaction = db.transaction(CONVERSATION_STORE, "readonly");
    const store = transaction.objectStore(CONVERSATION_STORE);
    const conversations = await requestToPromise(store.getAll());
    return (conversations as Conversation[]).map(buildMeta);
  } catch (error) {
    throw makeStorageError(
      "READ_FAILED",
      error instanceof Error ? error.message : "Failed to load conversations.",
    );
  }
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  try {
    const db = await getDb();
    const transaction = db.transaction(CONVERSATION_STORE, "readonly");
    const store = transaction.objectStore(CONVERSATION_STORE);
    const result = await requestToPromise(store.get(id));
    return (result as Conversation | undefined) ?? null;
  } catch (error) {
    throw makeStorageError(
      "READ_FAILED",
      error instanceof Error ? error.message : "Failed to load the selected conversation.",
    );
  }
}

function asStorageError(error: unknown, fallbackCode: StorageErrorCode, fallbackMessage: string): StorageErrorState {
  if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
    return error as StorageErrorState;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  if (message.toLowerCase().includes("quota")) {
    return makeStorageError("QUOTA_EXCEEDED", message);
  }

  return makeStorageError(fallbackCode, message);
}

export async function saveConversation(conv: Conversation): Promise<ConversationMeta> {
  try {
    const db = await getDb();
    const transaction = db.transaction(CONVERSATION_STORE, "readwrite");
    transaction.objectStore(CONVERSATION_STORE).put(conv);
    await transactionDone(transaction);
    return buildMeta(conv);
  } catch (error) {
    throw asStorageError(error, "WRITE_FAILED", "Failed to save the conversation.");
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    const db = await getDb();
    const transaction = db.transaction(CONVERSATION_STORE, "readwrite");
    transaction.objectStore(CONVERSATION_STORE).delete(id);
    await transactionDone(transaction);
  } catch (error) {
    throw asStorageError(error, "DELETE_FAILED", "Failed to delete the conversation.");
  }
}

export async function deleteConversations(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  try {
    const db = await getDb();
    const transaction = db.transaction(CONVERSATION_STORE, "readwrite");
    const store = transaction.objectStore(CONVERSATION_STORE);
    ids.forEach((id) => {
      store.delete(id);
    });
    await transactionDone(transaction);
  } catch (error) {
    throw asStorageError(error, "DELETE_FAILED", "Failed to delete one or more conversations.");
  }
}

export async function clearAllConversations(): Promise<void> {
  try {
    const db = await getDb();
    const transaction = db.transaction(CONVERSATION_STORE, "readwrite");
    transaction.objectStore(CONVERSATION_STORE).clear();
    await transactionDone(transaction);
  } catch (error) {
    throw asStorageError(error, "DELETE_FAILED", "Failed to clear conversations.");
  }
}

export async function getStorageStats(index: ConversationMeta[]): Promise<StorageStats> {
  let usedBytes = index.reduce((total, meta) => total + meta.sizeBytes, 0);
  let quotaBytes = 50 * 1024 * 1024;

  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usedBytes = estimate.usage ?? usedBytes;
      quotaBytes = estimate.quota ?? quotaBytes;
    } catch {
      // Keep the fallback estimate.
    }
  }

  return {
    usedBytes,
    quotaBytes,
    conversationCount: index.length,
  };
}

export function getPersistedActiveConversationId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.ACTIVE_CONVERSATION);
}

export function setPersistedActiveConversationId(id: string | null) {
  if (typeof window === "undefined") return;

  if (id) {
    localStorage.setItem(KEYS.ACTIVE_CONVERSATION, id);
  } else {
    localStorage.removeItem(KEYS.ACTIVE_CONVERSATION);
  }
}

export function __resetStorageForTests() {
  dbInstance?.close();
  dbInstance = null;
  dbPromise = null;
}
