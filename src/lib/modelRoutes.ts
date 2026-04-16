const CHAT_ROUTE_PREFIX = "/chat";

function normalizeModelRouteSegments(modelId: string) {
  return modelId
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export function getModelChatPath(modelId: string) {
  const segments = normalizeModelRouteSegments(modelId);
  if (segments.length === 0) {
    return CHAT_ROUTE_PREFIX;
  }

  return [
    CHAT_ROUTE_PREFIX,
    ...segments.map((segment) => encodeURIComponent(segment)),
  ].join("/");
}

export function getModelIdFromRouteSlug(modelSlug?: string | string[] | null) {
  const segments = Array.isArray(modelSlug)
    ? modelSlug
    : typeof modelSlug === "string"
      ? [modelSlug]
      : [];

  return segments
    .map((segment) => decodeURIComponent(segment).trim())
    .filter((segment) => segment.length > 0)
    .join("/");
}

export function getModelRouteSlug(modelId: string) {
  return normalizeModelRouteSegments(modelId);
}
