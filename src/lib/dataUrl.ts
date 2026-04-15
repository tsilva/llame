function decodeBase64Payload(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  if (!dataUrl.startsWith("data:")) return null;

  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex === -1) return null;

  const metadata = dataUrl.slice(5, separatorIndex);
  const payload = dataUrl.slice(separatorIndex + 1);
  const metadataParts = metadata.split(";");
  const mimeType = metadataParts[0] || "application/octet-stream";

  try {
    if (metadataParts.includes("base64")) {
      return new Blob([decodeBase64Payload(payload)], { type: mimeType });
    }

    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  } catch {
    return null;
  }
}
