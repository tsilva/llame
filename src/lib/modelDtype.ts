function parseModelParameterCountB(modelId: string) {
  const match = modelId.match(/(\d+(?:\.\d+)?)B/i);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function pickDtypeForModel(modelId: string, device: "webgpu" | "wasm") {
  if (device !== "webgpu") return "q4";

  const parameterCountB = parseModelParameterCountB(modelId);
  const isLargeQwen2Family = /(?:^|\/)Qwen2(?:\.5)?-/i.test(modelId) && parameterCountB !== null && parameterCountB >= 1;

  // Larger Qwen2/Qwen2.5 WebGPU q4f16 exports can decode into corrupted ASCII soup in live browser runs.
  // Plain q4 stays stable for these checkpoints, so prefer that variant when available.
  if (isLargeQwen2Family) return "q4";

  if (parameterCountB !== null && parameterCountB >= 1.0) return "q4f16";
  return "fp16";
}
