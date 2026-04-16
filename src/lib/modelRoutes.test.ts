import { describe, expect, it } from "vitest";
import {
  getModelChatPath,
  getModelIdFromRouteSlug,
  getModelRouteSlug,
} from "@/lib/modelRoutes";

describe("model route helpers", () => {
  it("keeps the Hugging Face namespace in model chat routes", () => {
    const modelId = "onnx-community/Qwen3.5-0.8B-ONNX";

    expect(getModelChatPath(modelId)).toBe("/chat/onnx-community/Qwen3.5-0.8B-ONNX");
    expect(getModelRouteSlug(modelId)).toEqual(["onnx-community", "Qwen3.5-0.8B-ONNX"]);
  });

  it("decodes model route slugs back to model ids", () => {
    expect(getModelIdFromRouteSlug(["tsilva", "unsloth_Qwen3.5-0.8B_uncensored"])).toBe(
      "tsilva/unsloth_Qwen3.5-0.8B_uncensored",
    );
  });
});
