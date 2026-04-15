import { afterEach, describe, expect, it, vi } from "vitest";
import { assessModelCompatibility, searchBrowserReadyModels } from "@/lib/modelBrowser";

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

    const page = await searchBrowserReadyModels("");

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

    const page = await searchBrowserReadyModels("");

    expect(page.models).toHaveLength(1);
    expect(page.models[0]).toMatchObject({
      id: "onnx-community/Qwen2.5-0.5B-Instruct",
      isVisionModel: false,
    });
  });

  it("hides models that only ship a generic onnx/model.onnx artifact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "onnx-community/tiny-random-jais",
              sha: "jais-rev",
              tags: ["onnx", "jais"],
              config: { model_type: "jais" },
              siblings: [{ rfilename: "onnx/model.onnx" }],
            },
            {
              id: "onnx-community/Llama-3.2-1B-Instruct-ONNX",
              sha: "llama-rev",
              tags: ["onnx", "llama", "text-generation", "conversational"],
              pipeline_tag: "text-generation",
              config: {
                model_type: "llama",
                tokenizer_config: {
                  chat_template: "<|begin_of_text|>{{ message }}",
                },
              },
              siblings: [
                { rfilename: "onnx/model.onnx" },
                { rfilename: "onnx/model_fp16.onnx" },
                { rfilename: "onnx/model_q4.onnx" },
              ],
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    const page = await searchBrowserReadyModels("");

    expect(page.models).toHaveLength(1);
    expect(page.models[0]).toMatchObject({
      id: "onnx-community/Llama-3.2-1B-Instruct-ONNX",
      isVisionModel: false,
    });
  });

  it("hides tiny-random checkpoints even when they look structurally compatible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "onnx-community/tiny-random-LlamaForCausalLM-ONNX",
              sha: "llama-rev",
              tags: ["onnx", "llama", "text-generation", "conversational"],
              pipeline_tag: "text-generation",
              config: {
                model_type: "llama",
                tokenizer_config: {
                  chat_template: "<|begin_of_text|>{{ message }}",
                },
              },
              siblings: [
                { rfilename: "onnx/model.onnx" },
                { rfilename: "onnx/model_fp16.onnx" },
                { rfilename: "onnx/model_q4.onnx" },
              ],
            },
            {
              id: "onnx-community/Llama-3.2-1B-Instruct-ONNX",
              sha: "llama-instruct-rev",
              tags: ["onnx", "llama", "text-generation", "conversational"],
              pipeline_tag: "text-generation",
              config: {
                model_type: "llama",
                tokenizer_config: {
                  chat_template: "<|begin_of_text|>{{ message }}",
                },
              },
              siblings: [
                { rfilename: "onnx/model.onnx" },
                { rfilename: "onnx/model_fp16.onnx" },
                { rfilename: "onnx/model_q4.onnx" },
              ],
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    const page = await searchBrowserReadyModels("");

    expect(page.models).toHaveLength(1);
    expect(page.models[0]).toMatchObject({
      id: "onnx-community/Llama-3.2-1B-Instruct-ONNX",
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
            {
              id: "onnx-community/Qwen3.5-0.8B-ONNX",
              sha: "qwen-rev",
              tags: ["onnx", "qwen3_5", "image-text-to-text", "vision", "conversational"],
              pipeline_tag: "image-text-to-text",
              config: {
                model_type: "qwen3_5",
                tokenizer_config: {
                  chat_template: "<|im_start|>user\n{{ message }}<|im_end|>",
                },
              },
              siblings: [
                { rfilename: "preprocessor_config.json" },
                { rfilename: "onnx/embed_tokens_q4.onnx" },
                { rfilename: "onnx/vision_encoder_fp16.onnx" },
                { rfilename: "onnx/decoder_model_merged_q4.onnx" },
              ],
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    const page = await searchBrowserReadyModels("");

    expect(page.models).toHaveLength(1);
    expect(page.models[0]).toMatchObject({
      id: "onnx-community/Qwen3.5-0.8B-ONNX",
      isVisionModel: true,
    });
  });

  it("requires preprocessor_config.json for vision repos and allows them once present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "tsilva/unsloth_Qwen3.5-0.8B_uncensored",
              sha: "custom-rev",
              tags: ["onnx", "qwen3_5", "vision-language-model", "conversational"],
              pipeline_tag: "image-text-to-text",
              config: {
                model_type: "qwen3_5",
                tokenizer_config: {
                  chat_template: "<|im_start|>user\n{{ message }}<|im_end|>",
                },
              },
              siblings: [
                { rfilename: "onnx/embed_tokens_fp16.onnx" },
                { rfilename: "onnx/vision_encoder_fp16.onnx" },
                { rfilename: "onnx/decoder_model_merged_q4f16.onnx" },
                { rfilename: "processor_config.json" },
              ],
            },
            {
              id: "tsilva/unsloth_Qwen3.5-0.8B_uncensored-fixed",
              sha: "good-rev",
              tags: ["onnx", "qwen3_5", "vision-language-model", "conversational"],
              pipeline_tag: "image-text-to-text",
              config: {
                model_type: "qwen3_5",
                tokenizer_config: {
                  chat_template: "<|im_start|>user\n{{ message }}<|im_end|>",
                },
              },
              siblings: [
                { rfilename: "onnx/embed_tokens_fp16.onnx" },
                { rfilename: "onnx/vision_encoder_fp16.onnx" },
                { rfilename: "onnx/decoder_model_merged_q4f16.onnx" },
                { rfilename: "preprocessor_config.json" },
              ],
            },
            {
              id: "someone/random-onnx-vision-model",
              sha: "bad-rev",
              tags: ["onnx", "image-segmentation"],
              pipeline_tag: "image-segmentation",
              config: { model_type: "briaai" },
              siblings: [{ rfilename: "onnx/model.onnx" }],
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    const page = await searchBrowserReadyModels("uncensored");

    expect(page.models).toHaveLength(1);
    expect(page.models[0]).toMatchObject({
      id: "tsilva/unsloth_Qwen3.5-0.8B_uncensored-fixed",
      isVisionModel: true,
    });
  });

  it("downgrades larger Qwen2 WebGPU models on 8 GB devices", () => {
    const compatibility = assessModelCompatibility(
      {
        id: "onnx-community/Qwen2.5-1.5B-Instruct",
        revision: null,
        name: "Qwen2.5-1.5B-Instruct",
        downloads: 1028,
        likes: 6,
        tags: ["onnx", "qwen2", "text-generation", "conversational"],
        pipelineTag: "text-generation",
        lastModified: "2025-03-06T17:18:53.000Z",
        parameterCountB: 1.5,
        estimatedDownloadGb: 1.4,
        isVisionModel: false,
      },
      {
        device: "webgpu",
        webgpuSupported: true,
        deviceMemoryGb: 8,
        hardwareConcurrency: 8,
      },
    );

    expect(compatibility.label).toBe("Maybe");
    expect(compatibility.summary).toContain("Borderline");
  });
});
