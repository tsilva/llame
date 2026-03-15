import { getPreferredDtypePolicy } from "@/lib/modelPolicies";

function parseModelParameterCountB(modelId: string) {
  const match = modelId.match(/(\d+(?:\.\d+)?)B/i);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function pickDtypeForModel(modelId: string, device: "webgpu" | "wasm") {
  if (device !== "webgpu") return "q4";

  const parameterCountB = parseModelParameterCountB(modelId);
  const policyDtype = getPreferredDtypePolicy(
    {
      id: modelId,
      parameterCountB,
      isVisionModel: false,
    },
    device,
  );
  if (policyDtype) return policyDtype;

  if (parameterCountB !== null && parameterCountB >= 1.0) return "q4f16";
  return "fp16";
}
