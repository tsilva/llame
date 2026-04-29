import { GenerationParams } from "@/types";

export type RuntimeGenerationOverrides = Partial<GenerationParams> & {
  no_repeat_ngram_size?: number;
};

function isLegacyBloomCompletionModel(modelId?: string | null) {
  return modelId === "Xenova/bloom-560m" || modelId === "Xenova/bloomz-560m";
}

export function getRuntimeGenerationOverrides(
  modelId: string | null | undefined,
  params: GenerationParams,
): RuntimeGenerationOverrides {
  if (!isLegacyBloomCompletionModel(modelId)) return {};

  return {
    repetition_penalty: Math.max(params.repetition_penalty, 1.2),
    no_repeat_ngram_size: 2,
  };
}
