import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsModal } from "@/components/SettingsModal";
import { DEFAULT_PARAMS } from "@/lib/constants";

describe("SettingsModal", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("locks body scroll while open and restores it on close", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <SettingsModal
        isOpen
        onClose={onClose}
        params={DEFAULT_PARAMS}
        onChange={vi.fn()}
        device="webgpu"
        onDeviceChange={vi.fn()}
        webgpuAvailable
        storageStats={{
          usedBytes: 1024,
          quotaBytes: 1024 * 1024,
          conversationCount: 1,
        }}
        isGenerating={false}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <SettingsModal
        isOpen={false}
        onClose={onClose}
        params={DEFAULT_PARAMS}
        onChange={vi.fn()}
        device="webgpu"
        onDeviceChange={vi.fn()}
        webgpuAvailable
        storageStats={{
          usedBytes: 1024,
          quotaBytes: 1024 * 1024,
          conversationCount: 1,
        }}
        isGenerating={false}
      />,
    );

    expect(document.body.style.overflow).toBe("");
  });
});
