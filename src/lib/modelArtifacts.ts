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

const ONNX_DTYPE_SUFFIXES: Record<string, DataType> = {
  "": "fp32",
  quantized: "q8",
  fp16: "fp16",
  q8: "q8",
  int8: "int8",
  uint8: "uint8",
  q4f16: "q4f16",
  q4: "q4",
  q2f16: "q2f16",
  q2: "q2",
  q1f16: "q1f16",
  q1: "q1",
  bnb4: "bnb4",
};

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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getArtifactBaseName(modelFileName: CausalLmModelFileName) {
  return modelFileName ?? "model";
}

function getDtypeFromOnnxPath(path: string, baseName: string) {
  const match = path.match(new RegExp(`^onnx/${escapeRegex(baseName)}(?:_([a-z0-9]+))?\\.onnx$`, "i"));
  if (!match) return null;

  return ONNX_DTYPE_SUFFIXES[(match[1] ?? "").toLowerCase()] ?? null;
}

export function inferAvailableOnnxDtypesForBaseName(paths: string[], baseName: string) {
  return uniqueDtypes(
    paths
      .map((path) => getDtypeFromOnnxPath(path, baseName))
      .filter((dtype): dtype is DataType => dtype !== null),
  );
}

export function selectOnnxDtypeForBaseName(
  paths: string[],
  baseName: string,
  preferredDtype: DataType,
) {
  const availableDtypes = inferAvailableOnnxDtypesForBaseName(paths, baseName);
  const dtypeOrder = uniqueDtypes([preferredDtype, ...CAUSAL_LM_DTYPE_FALLBACK_ORDER]);
  return dtypeOrder.find((dtype) => availableDtypes.includes(dtype)) ?? null;
}

export function inferAvailableCausalLmArtifactsFromSiblingPaths(
  paths: string[],
): AvailableCausalLmArtifact[] {
  return CAUSAL_LM_MODEL_FILE_CANDIDATES.map((modelFileName) => ({
    modelFileName,
    dtypes: inferAvailableOnnxDtypesForBaseName(paths, getArtifactBaseName(modelFileName)),
  }));
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
