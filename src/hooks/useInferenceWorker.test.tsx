import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInferenceWorker } from "@/hooks/useInferenceWorker";
import { WorkerRequest, WorkerResponse } from "@/types";

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  messages: WorkerRequest[] = [];
  terminate = vi.fn();

  postMessage(message: WorkerRequest) {
    this.messages.push(message);
  }

  emit(message: WorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>);
  }
}

describe("useInferenceWorker tokenization", () => {
  const workers: FakeWorker[] = [];

  beforeEach(() => {
    workers.length = 0;
    window.__LLAME_WORKER_FACTORY__ = () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    };
  });

  afterEach(() => {
    delete window.__LLAME_WORKER_FACTORY__;
    vi.restoreAllMocks();
  });

  it("does not tokenize before a model is loaded", () => {
    const { result } = renderHook(() => useInferenceWorker());
    const onTokenized = vi.fn();

    expect(result.current.tokenize([{ id: "input", text: "hello" }], onTokenized)).toBe(false);
    expect(workers[0].messages).toEqual([]);
  });

  it("ignores stale tokenization responses", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("request-1")
      .mockReturnValueOnce("request-2");

    const { result } = renderHook(() => useInferenceWorker());
    const worker = workers[0];

    act(() => {
      worker.emit({
        status: "loaded",
        modelId: "owner/model",
        revision: null,
        device: "webgpu",
        precision: "fp16",
        supportsImages: false,
        interactionMode: "chat",
      });
    });

    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    act(() => {
      expect(result.current.tokenize([{ id: "input", text: "first" }], firstCallback)).toBe(true);
      expect(result.current.tokenize([{ id: "input", text: "second" }], secondCallback)).toBe(true);
    });

    act(() => {
      worker.emit({
        status: "tokenized",
        requestId: "request-1",
        items: [{ id: "input", tokens: [{ index: 0, id: 1, text: "first" }] }],
      });
      worker.emit({
        status: "tokenized",
        requestId: "request-2",
        items: [{ id: "input", tokens: [{ index: 0, id: 2, text: "second" }] }],
      });
    });

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledWith([
      { id: "input", tokens: [{ index: 0, id: 2, text: "second" }] },
    ]);
  });
});
