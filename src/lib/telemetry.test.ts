import { describe, expect, it, vi, afterEach } from "vitest";

import {
  installSentryTestHook,
  SENTRY_TEST_EXCEPTION_MESSAGE,
} from "./telemetry";

describe("installSentryTestHook", () => {
  afterEach(() => {
    delete window.__sentryTest;
    vi.restoreAllMocks();
  });

  it("registers window.__sentryTest and throws the synthetic error", async () => {
    vi.spyOn(window, "setTimeout").mockImplementation(((handler: TimerHandler) => {
      if (typeof handler === "function") {
        handler();
      }

      return 0 as ReturnType<typeof setTimeout>;
    }) as typeof window.setTimeout);

    installSentryTestHook();

    await expect(window.__sentryTest?.()).rejects.toThrow(
      SENTRY_TEST_EXCEPTION_MESSAGE,
    );
  });

  it("removes the hook during cleanup", () => {
    const cleanup = installSentryTestHook();

    expect(window.__sentryTest).toBeTypeOf("function");

    cleanup();

    expect(window.__sentryTest).toBeUndefined();
  });
});
