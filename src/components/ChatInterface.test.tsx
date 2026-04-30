import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInterface } from "@/components/ChatInterface";
import { ChatMessage, ProgressInfo, TokenizationResultItem, TotalProgressInfo } from "@/types";

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

const baseMessages: ChatMessage[] = [
  {
    id: "user-1",
    role: "user",
    content: "Hello",
  },
  {
    id: "assistant-1",
    role: "assistant",
    content: "Rendered answer",
    debug: {
      modelInput: "<s>Hello",
      rawOutput: "**Raw** answer",
    },
  },
];

function renderChatInterface({
  messages = baseMessages,
  showRawConversation = false,
  showTokenization = false,
  tokenize = vi.fn(),
}: {
  messages?: ChatMessage[];
  showRawConversation?: boolean;
  showTokenization?: boolean;
  tokenize?: (
    items: { id: string; text: string }[],
    onTokenized: (items: TokenizationResultItem[]) => void,
    onError?: (error: string) => void,
  ) => boolean;
} = {}) {
  return render(
    <ChatInterface
      conversationId="conv-1"
      messages={messages}
      isGenerating={false}
      isProcessing={false}
      processingMessage=""
      isModelLoaded
      modelId="onnx-community/Qwen2.5-0.5B-Instruct"
      interactionMode="chat"
      isLoading={false}
      loadingProgress={new Map<string, ProgressInfo>()}
      loadingTotalProgress={null as TotalProgressInfo | null}
      loadingMessage=""
      onSend={vi.fn()}
      onStop={vi.fn()}
      tps={0}
      numTokens={0}
      generationTime={0}
      stopReason={null}
      device="webgpu"
      isMobile={false}
      allowImageInputs={false}
      thinkingComplete
      thinkingEnabled={false}
      showThinkingToggle={false}
      onToggleThinking={vi.fn()}
      showRawConversation={showRawConversation}
      showTokenization={showTokenization}
      canRequestTokenization
      tokenize={tokenize}
      onRegenerateLastAssistant={vi.fn()}
      onDeleteLastMessage={vi.fn()}
      onEditLastMessage={vi.fn()}
    />,
  );
}

describe("ChatInterface", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("not loaded"))));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("requests tokenization for source-mode debug fields", async () => {
    const tokenize = vi.fn(() => true);

    renderChatInterface({
      showRawConversation: true,
      showTokenization: true,
      tokenize,
    });

    await act(async () => {
      vi.advanceTimersByTime(151);
    });

    expect(tokenize).toHaveBeenCalledTimes(1);
    expect(tokenize).toHaveBeenCalledWith(
      [
        { id: "user-1", text: "Hello" },
        { id: "assistant-1::raw::modelInput", text: "<s>Hello" },
        { id: "assistant-1::raw::rawOutput", text: "**Raw** answer" },
      ],
      expect.any(Function),
    );
  });
});
