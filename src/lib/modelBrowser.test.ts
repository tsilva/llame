import { afterEach, describe, expect, it, vi } from "vitest";
import { searchOnnxCommunityModels } from "@/lib/modelBrowser";

describe("model browser search", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hides Hub models whose model_type is unsupported by the worker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "onnx-community/Qwen3.5-0.8B-ONNX",
              sha: "qwen-rev",
              tags: ["onnx", "qwen3_5", "image-text-to-text", "conversational"],
              pipeline_tag: "image-text-to-text",
              config: {
                model_type: "qwen3_5",
                tokenizer_config: {
                  chat_template: "<|im_start|>user\n{{ message }}<|im_end|>",
                },
              },
            },
            {
              id: "onnx-community/LFM2-VL-450M-ONNX",
              sha: "lfm-rev",
              tags: ["onnx", "lfm2_vl", "image-text-to-text"],
              pipeline_tag: "image-text-to-text",
              config: { model_type: "lfm2_vl" },
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    const page = await searchOnnxCommunityModels("");

    expect(page.models).toHaveLength(1);
    expect(page.models[0]).toMatchObject({
      id: "onnx-community/Qwen3.5-0.8B-ONNX",
      isVisionModel: true,
    });
  });

  it("hides embedding models even when they reuse a supported decoder architecture", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "onnx-community/Qwen3-Embedding-0.6B-ONNX",
              sha: "embed-rev",
              tags: ["onnx", "qwen3", "text-generation", "feature-extraction"],
              pipeline_tag: "feature-extraction",
              config: { model_type: "qwen3" },
            },
            {
              id: "onnx-community/ONNX_Qwen3-Embedding-0.6B",
              sha: "embed-name-rev",
              tags: ["onnx", "qwen3", "region:us"],
              config: { model_type: "qwen3" },
            },
            {
              id: "onnx-community/Qwen2.5-0.5B-Instruct",
              sha: "chat-rev",
              tags: ["onnx", "qwen2", "text-generation"],
              pipeline_tag: "text-generation",
              config: { model_type: "qwen2" },
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    const page = await searchOnnxCommunityModels("");

    expect(page.models).toHaveLength(1);
    expect(page.models[0]).toMatchObject({
      id: "onnx-community/Qwen2.5-0.5B-Instruct",
      isVisionModel: false,
    });
  });

  it("hides vision models that are task-specific rather than conversational", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "onnx-community/Florence-2-base-ft",
              sha: "florence-rev",
              tags: ["onnx", "florence2", "image-text-to-text", "vision"],
              pipeline_tag: "image-text-to-text",
              config: {
                model_type: "florence2",
                tokenizer_config: {},
              },
            },
            {
              id: "onnx-community/granite-docling-258M-ONNX",
              sha: "granite-rev",
              tags: ["onnx", "idefics3", "image-text-to-text", "vision", "conversational"],
              pipeline_tag: "image-text-to-text",
              config: {
                model_type: "idefics3",
                tokenizer_config: {
                  chat_template: "<|start_of_role|>user<|end_of_role|>{{ message }}",
                },
              },
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    const page = await searchOnnxCommunityModels("");

    expect(page.models).toHaveLength(1);
    expect(page.models[0]).toMatchObject({
      id: "onnx-community/granite-docling-258M-ONNX",
      isVisionModel: true,
    });
  });
});
