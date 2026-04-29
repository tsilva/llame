import { describe, expect, it } from "vitest";
import { MAX_IMAGE_FILE_BYTES, isAcceptedImageFile } from "@/lib/imageUtils";

function makeFile(type: string, size: number) {
  return new File([new Uint8Array(size)], "image", { type });
}

describe("isAcceptedImageFile", () => {
  it("accepts bounded raster image files", () => {
    expect(isAcceptedImageFile(makeFile("image/png", 16))).toBe(true);
    expect(isAcceptedImageFile(makeFile("image/jpeg", 16))).toBe(true);
    expect(isAcceptedImageFile(makeFile("image/webp", 16))).toBe(true);
  });

  it("rejects SVGs, empty files, and oversized files", () => {
    expect(isAcceptedImageFile(makeFile("image/svg+xml", 16))).toBe(false);
    expect(isAcceptedImageFile(makeFile("image/png", 0))).toBe(false);
    expect(isAcceptedImageFile(makeFile("image/png", MAX_IMAGE_FILE_BYTES + 1))).toBe(false);
  });
});
