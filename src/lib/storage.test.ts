import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetStorageForTests,
  buildMeta,
  listConversationMeta,
  loadConversation,
  migrateLegacyStorage,
  saveConversation,
} from "@/lib/storage";
import { Conversation } from "@/types";

function deleteDatabase(name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

const legacyConversation: Conversation = {
  id: "legacy-1",
  title: "Legacy chat",
  messages: [
    {
      id: "m-1",
      role: "user",
      content: "Hello",
    },
  ],
  createdAt: 1,
  updatedAt: 2,
  modelId: "onnx-community/Qwen3.5-0.8B-ONNX",
  modelRevision: "rev-1",
  modelSupportsImages: true,
  recommendedDevice: "webgpu",
  supportTier: "curated",
};

describe("storage adapter", () => {
  beforeEach(async () => {
    localStorage.clear();
    __resetStorageForTests();
    await deleteDatabase("llame");
  });

  it("migrates legacy localStorage conversations into IndexedDB", async () => {
    localStorage.setItem("llame-storage-version", "2");
    localStorage.setItem("llame-conversations-index", JSON.stringify([buildMeta(legacyConversation)]));
    localStorage.setItem(`llame-conversation-${legacyConversation.id}`, JSON.stringify(legacyConversation));

    expect(await migrateLegacyStorage()).toBeNull();

    const migrated = await loadConversation(legacyConversation.id);
    expect(migrated).toEqual(legacyConversation);
    expect(localStorage.getItem("llame-storage-version")).toBe("3");
  });

  it("lists saved IndexedDB conversations as index metadata", async () => {
    await saveConversation(legacyConversation);

    await expect(listConversationMeta()).resolves.toEqual([buildMeta(legacyConversation)]);
  });

  it("returns an explicit failure when IndexedDB is unavailable", async () => {
    const originalIndexedDb = globalThis.indexedDB;
    // @ts-expect-error Test-only override
    delete globalThis.indexedDB;

    await expect(saveConversation(legacyConversation)).rejects.toMatchObject({
      code: "IDB_UNAVAILABLE",
    });

    globalThis.indexedDB = originalIndexedDb;
  });
});
