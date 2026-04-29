import { describe, expect, it } from "vitest";
import { COMPLETION_PARAMS } from "@/lib/constants";
import { getRuntimeGenerationOverrides } from "@/lib/generationRuntime";

describe("getRuntimeGenerationOverrides", () => {
  it("adds repetition controls for legacy Bloom q8 browser exports", () => {
    expect(getRuntimeGenerationOverrides("Xenova/bloom-560m", {
      ...COMPLETION_PARAMS,
      repetition_penalty: 1,
    })).toEqual({
      repetition_penalty: 1.2,
      no_repeat_ngram_size: 2,
    });
  });

  it("preserves stronger user repetition penalties for Bloom", () => {
    expect(getRuntimeGenerationOverrides("Xenova/bloom-560m", {
      ...COMPLETION_PARAMS,
      repetition_penalty: 1.5,
    })).toEqual({
      repetition_penalty: 1.5,
      no_repeat_ngram_size: 2,
    });
  });

  it("leaves other models unchanged", () => {
    expect(getRuntimeGenerationOverrides("Xenova/distilgpt2", COMPLETION_PARAMS)).toEqual({});
  });
});
