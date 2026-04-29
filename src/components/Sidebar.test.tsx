import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/Sidebar";
import { ConversationMeta } from "@/types";

function buildConversation(overrides: Partial<ConversationMeta> = {}): ConversationMeta {
  return {
    id: "conv-1",
    title: "New chat",
    createdAt: 1,
    updatedAt: 1,
    modelId: "test-model",
    modelRevision: null,
    modelSupportsImages: null,
    recommendedDevice: "webgpu",
    supportTier: "curated",
    messageCount: 0,
    sizeBytes: 0,
    ...overrides,
  };
}

function renderSidebar(conversations: ConversationMeta[], overrides: Partial<ComponentProps<typeof Sidebar>> = {}) {
  render(
    <Sidebar
      isOpen
      onToggle={vi.fn()}
      onNewChat={vi.fn()}
      onOpenSettings={vi.fn()}
      onClearAllChats={vi.fn()}
      conversations={conversations}
      activeConversationId={conversations[0]?.id ?? null}
      onSwitchConversation={vi.fn()}
      onDeleteConversation={vi.fn()}
      isLoading={false}
      isGenerating={false}
      {...overrides}
    />,
  );
}

describe("Sidebar", () => {
  it("shows a delete button for an empty draft conversation", () => {
    renderSidebar([buildConversation()]);

    expect(screen.getAllByLabelText("Delete conversation New chat")).not.toHaveLength(0);
  });

  it("calls the new chat callback without leaking the click event", () => {
    const onNewChat = vi.fn();
    renderSidebar([buildConversation()], { onNewChat });

    fireEvent.click(screen.getAllByLabelText("Start a new chat")[0]);

    expect(onNewChat).toHaveBeenCalledWith();
  });

  it("shows a delete button for a conversation with messages", () => {
    renderSidebar([
      buildConversation({
        id: "conv-2",
        title: "Hello world",
        messageCount: 1,
      }),
    ]);

    expect(screen.getAllByLabelText("Delete conversation Hello world")).not.toHaveLength(0);
  });

  it("keeps the delete button faint until hover or focus", () => {
    renderSidebar([
      buildConversation({
        id: "conv-3",
        title: "Touch chat",
        messageCount: 2,
      }),
    ]);

    expect(screen.getAllByLabelText("Delete conversation Touch chat")[0]).toHaveClass(
      "opacity-25",
      "md:opacity-20",
      "md:group-hover:opacity-100",
    );
  });
});
