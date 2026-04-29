import type { DataType } from "@huggingface/transformers";
import { InferenceDevice } from "@/types";
import { pickDtypeForModel } from "@/lib/modelDtype";

export const CAUSAL_LM_MODEL_FILE_CANDIDATES = [
  null,
  "decoder_model_merged",
] as const;

export type CausalLmModelFileName = (typeof CAUSAL_LM_MODEL_FILE_CANDIDATES)[number];

export interface AvailableCausalLmArtifact {
  modelFileName: CausalLmModelFileName;
  dtypes: DataType[];
}

export interface CausalLmLoadArtifact {
  modelFileName: CausalLmModelFileName;
  dtype: DataType;
}

const CAUSAL_LM_DTYPE_FALLBACK_ORDER: DataType[] = [
  "q4f16",
  "q4",
  "fp16",
  "q8",
  "int8",
  "uint8",
  "fp32",
  "q2f16",
  "q2",
  "q1f16",
  "q1",
  "bnb4",
];

function uniqueDtypes(dtypes: DataType[]) {
  return Array.from(new Set(dtypes));
}

export function selectCausalLmLoadArtifact(
  modelId: string,
  device: InferenceDevice,
  artifacts: AvailableCausalLmArtifact[],
): CausalLmLoadArtifact | null {
  const preferredDtype = pickDtypeForModel(modelId, device) as DataType;
  const dtypeOrder = uniqueDtypes([preferredDtype, ...CAUSAL_LM_DTYPE_FALLBACK_ORDER]);

  for (const artifact of artifacts) {
    for (const dtype of dtypeOrder) {
      if (artifact.dtypes.includes(dtype)) {
        return {
          modelFileName: artifact.modelFileName,
          dtype,
        };
      }
    }
  }

  return null;
}
