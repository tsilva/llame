import { dataUrlToBlob } from "@/lib/dataUrl";

export const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_COMPRESSED_IMAGE_BYTES = 512 * 1024;
export const MAX_PENDING_IMAGES = 5;

export function isAcceptedImageMimeType(type: string) {
  return ACCEPTED_IMAGE_MIME_TYPES.includes(type.toLowerCase() as typeof ACCEPTED_IMAGE_MIME_TYPES[number]);
}

export function isAcceptedImageFile(file: File) {
  return isAcceptedImageMimeType(file.type) && file.size > 0 && file.size <= MAX_IMAGE_FILE_BYTES;
}

export async function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxSize = 1024;
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      // Try JPEG at decreasing quality levels
      const qualities = [0.8, 0.7, 0.5, 0.3];

      for (const quality of qualities) {
        const result = canvas.toDataURL("image/jpeg", quality);
        const blob = dataUrlToBlob(result, {
          allowedMimeTypes: ACCEPTED_IMAGE_MIME_TYPES,
          maxBytes: MAX_COMPRESSED_IMAGE_BYTES,
        });
        if (blob) {
          resolve(result);
          return;
        }
      }

      resolve("");
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}
