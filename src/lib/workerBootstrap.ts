export interface WorkerLocationLike {
  href?: string | null;
  origin?: string | null;
}

export function getOnnxWasmAssetBaseUrl(locationLike: WorkerLocationLike | null | undefined): string | null {
  const candidates = [
    typeof locationLike?.origin === "string" && locationLike.origin !== "null"
      ? `${locationLike.origin}/`
      : null,
    typeof locationLike?.href === "string" ? locationLike.href : null,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL("/onnxruntime/", candidate).toString();
    } catch {
      // Ignore invalid worker URLs and fall through to the next candidate.
    }
  }

  return null;
}

export function getOnnxWasmAssetPaths(locationLike: WorkerLocationLike | null | undefined) {
  const baseUrl = getOnnxWasmAssetBaseUrl(locationLike);
  if (!baseUrl) return null;

  return {
    mjs: new URL("ort-wasm-simd-threaded.asyncify.mjs", baseUrl).toString(),
    wasm: new URL("ort-wasm-simd-threaded.asyncify.wasm", baseUrl).toString(),
  };
}
