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
              tags: ["onnx", "qwen3_5", "image-text-to-text"],
              pipeline_tag: "image-text-to-text",
              config: { model_type: "qwen3_5" },
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
});
