import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatMessage } from "@/components/ChatMessage";

describe("ChatMessage", () => {
  it("shows assistant action buttons when requested", () => {
    const onRegenerate = vi.fn();
    const onDelete = vi.fn();

    render(
      <ChatMessage
        message={{
          id: "assistant-1",
          role: "assistant",
          content: "Answer",
        }}
        showActions
        onRegenerate={onRegenerate}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Regenerate answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete answer" }));

    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("shows an edit button when requested and saves the edited content", () => {
    const onEdit = vi.fn();

    render(
      <ChatMessage
        message={{
          id: "assistant-1",
          role: "assistant",
          content: "Answer",
        }}
        showEditAction
        onEdit={onEdit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit message content" }), {
      target: { value: "Edited answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save edited message" }));

    expect(onEdit).toHaveBeenCalledWith("Edited answer");
  });

  it("does not show action buttons by default", () => {
    render(
      <ChatMessage
        message={{
          id: "assistant-1",
          role: "assistant",
          content: "Answer",
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Regenerate answer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete answer" })).not.toBeInTheDocument();
  });

  it("shows generation time and stop reason in assistant stats", () => {
    render(
      <ChatMessage
        message={{
          id: "assistant-1",
          role: "assistant",
          content: "Answer",
          stats: {
            tps: 47.85,
            numTokens: 116,
            generationTime: 0.28,
            stopReason: "eos_token",
          },
        }}
        isComplete
      />,
    );

    expect(screen.getByText("116 tokens")).toBeInTheDocument();
    expect(screen.getByText("47.9 tokens/sec")).toBeInTheDocument();
    expect(screen.getByText("Generation time: 0.28s")).toBeInTheDocument();
    expect(screen.getByText("Stop reason: EOS token found")).toBeInTheDocument();
  });
});
