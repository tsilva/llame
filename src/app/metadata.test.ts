import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { metadata as chatMetadata } from "@/app/chat/layout";
import { generateMetadata as generateModelChatMetadata } from "@/app/chat/[...modelSlug]/page";
import { metadata as homeMetadata } from "@/app/page";
import sitemap from "@/app/sitemap";
import { MODEL_PRESETS } from "@/lib/constants";
import { getModelChatPath } from "@/lib/modelRoutes";
import {
  chatPageDescription,
  homePageJsonLd,
  siteDescription,
  siteTagline,
  siteKeywords,
  siteTitle,
  socialImage,
  siteUrl,
} from "@/lib/siteMetadata";

const generatedMetadataJson = JSON.parse(
  readFileSync(join(process.cwd(), "web-seo-metadata.json"), "utf8"),
);
const webManifest = JSON.parse(
  readFileSync(join(process.cwd(), "public/brand/web-seo/site.webmanifest"), "utf8"),
);
const brandManifest = JSON.parse(
  readFileSync(join(process.cwd(), "public/brand/manifest.json"), "utf8"),
);
const stackFirstTermsPattern = /\b(transformers(?:\.js|-js)?|onnx|webgpu|wasm|webassembly|typescript)\b/i;

describe("SEO metadata", () => {
  it("exports homepage metadata with value-first copy, canonical, and meaningful OG alt text", () => {
    expect(homeMetadata.title).toBe("Private AI chats in your browser | llame");
    expect(homeMetadata.description).toBe(
      "Run local AI models in your browser. No installs, no API keys, and your chats stay on your device.",
    );
    expect(homeMetadata.alternates?.canonical).toBe("/");

    const homeImages = Array.isArray(homeMetadata.openGraph?.images)
      ? homeMetadata.openGraph.images
      : [homeMetadata.openGraph?.images];
    const firstHomeImage = homeImages[0];

    expect(firstHomeImage).toMatchObject({
      alt: `llame social card for ${siteTagline}`,
    });
    expect(String(homeMetadata.title)).not.toMatch(stackFirstTermsPattern);
    expect(homeMetadata.description).not.toMatch(stackFirstTermsPattern);
  });

  it("exports noindex metadata for the chat workspace", () => {
    expect(chatMetadata.title).toBe(`llame | ${siteTagline}`);
    expect(chatMetadata.description).toBe(chatPageDescription);
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

  it("exports model-specific metadata for model chat routes", async () => {
    const modelMetadata = await generateModelChatMetadata({
      params: Promise.resolve({
        modelSlug: ["onnx-community", "Qwen3.5-0.8B-ONNX"],
      }),
    });

    expect(modelMetadata.title).toBe(`Qwen3.5 0.8B | ${siteTagline}`);
    expect(modelMetadata.description).toBe(
      `Start ${siteTagline} with Qwen3.5 0.8B on llame. Run the model on your device with no installs or API keys.`,
    );
    expect(modelMetadata.alternates?.canonical).toBe("/chat/onnx-community/Qwen3.5-0.8B-ONNX");
    expect(modelMetadata.robots).toMatchObject({
      index: true,
      follow: true,
    });
    expect(modelMetadata.openGraph).toMatchObject({
      title: `Qwen3.5 0.8B | ${siteTagline}`,
      description:
        `Start ${siteTagline} with Qwen3.5 0.8B on llame. Run the model on your device with no installs or API keys.`,
      url: "/chat/onnx-community/Qwen3.5-0.8B-ONNX",
      images: [
        expect.objectContaining({
          url: socialImage.url,
          alt: `Qwen3.5 0.8B chat card for ${siteTagline} on llame`,
        }),
      ],
    });
    expect(modelMetadata.twitter).toMatchObject({
      title: `Qwen3.5 0.8B | ${siteTagline}`,
      description:
        `Start ${siteTagline} with Qwen3.5 0.8B on llame. Run the model on your device with no installs or API keys.`,
      images: [socialImage.url],
    });
    expect(modelMetadata.title).not.toBe(chatMetadata.title);
    expect(modelMetadata.description).not.toBe(chatMetadata.description);
  });

  it("keeps generated metadata and manifest surfaces aligned with the homepage copy", () => {
    expect(generatedMetadataJson.title).toBe(siteTitle);
    expect(generatedMetadataJson.description).toBe(siteDescription);
    expect(generatedMetadataJson.openGraph.title).toBe(siteTitle);
    expect(generatedMetadataJson.openGraph.description).toBe(siteDescription);
    expect(generatedMetadataJson.openGraph.images[0].alt).toBe(socialImage.alt);
    expect(generatedMetadataJson.twitter.title).toBe(siteTitle);
    expect(generatedMetadataJson.twitter.description).toBe(siteDescription);

    expect(webManifest.name).toBe(siteTitle);
    expect(webManifest.description).toBe(siteDescription);

    expect(brandManifest.metadata.title).toBe(siteTitle);
    expect(brandManifest.metadata.short_description).toBe(siteDescription);
    expect(brandManifest.metadata.social_title).toBe(siteTitle);
    expect(brandManifest.metadata.social_description).toBe(siteDescription);

    expect(generatedMetadataJson.title).not.toMatch(stackFirstTermsPattern);
    expect(generatedMetadataJson.description).not.toMatch(stackFirstTermsPattern);
    expect(webManifest.name).not.toMatch(stackFirstTermsPattern);
    expect(webManifest.description).not.toMatch(stackFirstTermsPattern);
  });

  it("keeps schema descriptions and keyword ordering focused on user intent first", () => {
    expect(homePageJsonLd["@graph"][0].description).toBe(siteDescription);
    expect(homePageJsonLd["@graph"][1].description).toBe(siteDescription);
    expect(siteKeywords.slice(0, 8)).toEqual([
      "private-ai-chat",
      "browser-ai",
      "local-ai",
      "run-ai-in-browser",
      "on-device-ai",
      "offline-ai",
      "local-llm",
      "browser-llm",
    ]);
  });
});

describe("sitemap", () => {
  it("lists the homepage and every dropdown model route", () => {
    const entries = sitemap();

    expect(entries).toEqual([
      {
        url: siteUrl,
        lastModified: expect.any(Date),
        changeFrequency: "weekly",
        priority: 1,
      },
      ...MODEL_PRESETS.map((preset) => ({
        url: new URL(getModelChatPath(preset.id), siteUrl).toString(),
        lastModified: expect.any(Date),
        changeFrequency: "weekly",
        priority: 0.8,
      })),
    ]);
    expect(entries).toHaveLength(MODEL_PRESETS.length + 1);
  });
});
