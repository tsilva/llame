import { describe, expect, it } from "vitest";
import { dataUrlToBlob } from "@/lib/dataUrl";

describe("dataUrlToBlob", () => {
  it("decodes base64 data URLs into blobs", async () => {
    const blob = dataUrlToBlob("data:text/plain;base64,SGVsbG8=");

    expect(blob).not.toBeNull();
    expect(blob?.type).toBe("text/plain");
    await expect(blob?.text()).resolves.toBe("Hello");
  });

  it("decodes percent-encoded data URLs into blobs", async () => {
    const blob = dataUrlToBlob("data:text/plain,Hello%20world");

    expect(blob).not.toBeNull();
    expect(blob?.type).toBe("text/plain");
    await expect(blob?.text()).resolves.toBe("Hello world");
  });

  it("returns null for non-data URLs or malformed payloads", () => {
    expect(dataUrlToBlob("https://example.com/image.png")).toBeNull();
    expect(dataUrlToBlob("data:image/png;base64,%%%")).toBeNull();
  });
});
