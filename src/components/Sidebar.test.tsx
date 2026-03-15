import { render, screen } from "@testing-library/react";
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

function renderSidebar(conversations: ConversationMeta[]) {
  render(
    <Sidebar
      isOpen
      isMobile={false}
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
    />,
  );
}

describe("Sidebar", () => {
  it("does not show a delete button for an empty draft conversation", () => {
    renderSidebar([buildConversation()]);

    expect(screen.queryByLabelText("Delete conversation New chat")).not.toBeInTheDocument();
  });

  it("shows a delete button for a conversation with messages", () => {
    renderSidebar([
      buildConversation({
        id: "conv-2",
        title: "Hello world",
        messageCount: 1,
      }),
    ]);

    expect(screen.getByLabelText("Delete conversation Hello world")).toBeInTheDocument();
  });

  it("keeps the delete button visible on touch layouts while preserving desktop hover behavior", () => {
    renderSidebar([
      buildConversation({
        id: "conv-3",
        title: "Touch chat",
        messageCount: 2,
      }),
    ]);

    expect(screen.getByLabelText("Delete conversation Touch chat")).toHaveClass(
      "opacity-100",
      "md:opacity-0",
      "md:group-hover:opacity-100",
    );
  });
});
