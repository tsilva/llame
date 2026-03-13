import { describe, expect, it } from "vitest";
import { classifyWorkerGenerationError, classifyWorkerLoadError } from "@/lib/workerErrors";

describe("worker error classification", () => {
  it("maps network-style load failures to NETWORK_ERROR", () => {
    expect(classifyWorkerLoadError(new Error("Failed to fetch config.json"))).toBe("NETWORK_ERROR");
  });

  it("maps unsupported model types to UNSUPPORTED_MODEL", () => {
    expect(classifyWorkerLoadError(new Error("Unsupported model type: speech"))).toBe("UNSUPPORTED_MODEL");
  });

  it("maps generation failures without a loaded model to NO_MODEL_LOADED", () => {
    expect(classifyWorkerGenerationError(new Error("No model loaded"))).toBe("NO_MODEL_LOADED");
  });
});
