import { describe, expect, it } from "vitest";
import { metadata as chatMetadata } from "@/app/chat/layout";
import { metadata as homeMetadata } from "@/app/page";
import sitemap from "@/app/sitemap";
import { socialImage, siteUrl } from "@/lib/siteMetadata";

describe("SEO metadata", () => {
  it("exports homepage metadata with the CTR title, description, canonical, and OG alt text", () => {
    expect(homeMetadata.title).toBe("Run Private AI Models in Your Browser | llame");
    expect(homeMetadata.description).toBe(
      "Chat with local ONNX models in your browser using WebGPU or WASM. No server inference, no API keys, and prompts stay on your device.",
    );
    expect(homeMetadata.alternates?.canonical).toBe("/");

    const homeImages = Array.isArray(homeMetadata.openGraph?.images)
      ? homeMetadata.openGraph.images
      : [homeMetadata.openGraph?.images];
    const firstHomeImage = homeImages[0];

    expect(firstHomeImage).toMatchObject({
      alt: "llame social card for private in-browser AI with WebGPU acceleration",
    });
  });

  it("exports noindex metadata for the chat workspace", () => {
    expect(chatMetadata.title).toBe("llame Chat | Local Browser AI Workspace");
    expect(chatMetadata.description).toBe(
      "Launch llame's local chat workspace to run ONNX models on-device with WebGPU or WASM.",
    );
    expect(chatMetadata.alternates?.canonical).toBe("/chat");
    expect(chatMetadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
    expect(chatMetadata.openGraph).toMatchObject({
      url: "/chat",
      images: [socialImage],
    });
  });
});

describe("sitemap", () => {
  it("lists only the homepage route", () => {
    expect(sitemap()).toEqual([
      {
        url: siteUrl,
        lastModified: expect.any(Date),
        changeFrequency: "weekly",
        priority: 1,
      },
    ]);
  });
});
