interface DataUrlToBlobOptions {
  allowedMimeTypes?: readonly string[];
  maxBytes?: number;
}

function decodeBase64Payload(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function isAllowedMimeType(mimeType: string, allowedMimeTypes?: readonly string[]) {
  if (!allowedMimeTypes) return true;
  return allowedMimeTypes.includes(mimeType.toLowerCase());
}

export function dataUrlToBlob(dataUrl: string, options: DataUrlToBlobOptions = {}): Blob | null {
  if (!dataUrl.startsWith("data:")) return null;

  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex === -1) return null;

  const metadata = dataUrl.slice(5, separatorIndex);
  const payload = dataUrl.slice(separatorIndex + 1);
  const metadataParts = metadata.split(";");
  const mimeType = (metadataParts[0] || "application/octet-stream").toLowerCase();
  if (!isAllowedMimeType(mimeType, options.allowedMimeTypes)) return null;

  try {
    if (metadataParts.includes("base64")) {
      const bytes = decodeBase64Payload(payload);
      if (options.maxBytes !== undefined && bytes.byteLength > options.maxBytes) return null;
      return new Blob([bytes], { type: mimeType });
    }

    const decoded = decodeURIComponent(payload);
    const blob = new Blob([decoded], { type: mimeType });
    if (options.maxBytes !== undefined && blob.size > options.maxBytes) return null;
    return blob;
  } catch {
    return null;
  }
}
