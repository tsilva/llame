import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

if (
  typeof globalThis.localStorage === "undefined" ||
  typeof globalThis.localStorage?.getItem !== "function" ||
  typeof globalThis.localStorage?.setItem !== "function" ||
  typeof globalThis.localStorage?.removeItem !== "function" ||
  typeof globalThis.localStorage?.clear !== "function"
) {
  let storage = new Map<string, string>();

  const localStorageMock: Storage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage = new Map<string, string>();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(storage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, String(value));
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
}
