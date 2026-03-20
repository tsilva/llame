import type { Metadata } from "next";
import createGeneratedMetadata from "../../web-seo-metadata";

export const siteName = "llame";
const DEFAULT_SITE_URL = "https://llame.tsilva.eu";
const FALLBACK_SITE_DESCRIPTION =
  "A client-side application for running private AI models directly in the browser using WebGPU, WASM, and Transformers.js.";
const FALLBACK_SITE_KEYWORDS = [
  "transformers.js",
  "webgpu",
  "wasm",
  "onnx-runtime",
  "local-llm",
  "browser-ai",
  "client-side-inference",
  "private-ai",
  "web-worker",
];

function resolveSiteUrl(): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredSiteUrl) {
    return DEFAULT_SITE_URL;
  }

  try {
    return new URL(configuredSiteUrl).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const siteUrl = resolveSiteUrl();
export const generatedMetadata = createGeneratedMetadata(new URL(siteUrl));

function resolveMetadataTitle(title: Metadata["title"] | undefined): string {
  if (typeof title === "string") {
    return title;
  }

  if (title && typeof title === "object" && "default" in title && typeof title.default === "string") {
    return title.default;
  }

  return siteName;
}

function resolveMetadataKeywords(keywords: Metadata["keywords"] | undefined): string[] {
  if (Array.isArray(keywords)) {
    return keywords.filter((keyword): keyword is string => typeof keyword === "string");
  }

  if (typeof keywords === "string") {
    return keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return FALLBACK_SITE_KEYWORDS;
}

export const siteTitle = resolveMetadataTitle(generatedMetadata.title);
export const siteDescription = generatedMetadata.description ?? FALLBACK_SITE_DESCRIPTION;
export const siteTagline =
  "No Python. No CUDA. No server. Just a URL for private, on-device AI chat.";

function normalizeMetadataUrl(value: string | URL): string {
  return value instanceof URL ? value.toString() : value;
}

function getGeneratedSocialImage() {
  const images = generatedMetadata.openGraph?.images;
  const firstImage = Array.isArray(images) ? images[0] : images;

  if (!firstImage) {
    return {
      url: "/brand/web-seo/og-image-1200x630.png",
      width: 1200,
      height: 630,
      alt: "llame brand card",
    };
  }

  if (typeof firstImage === "string" || firstImage instanceof URL) {
    return {
      url: normalizeMetadataUrl(firstImage),
      width: 1200,
      height: 630,
      alt: "llame brand card",
    };
  }

  return {
    url: normalizeMetadataUrl(firstImage.url),
    width: firstImage.width ?? 1200,
    height: firstImage.height ?? 630,
    alt: firstImage.alt ?? "llame brand card",
  };
}

export const socialImage = getGeneratedSocialImage();
export const metadataManifestPath =
  typeof generatedMetadata.manifest === "string"
    ? generatedMetadata.manifest
    : generatedMetadata.manifest instanceof URL
      ? generatedMetadata.manifest.toString()
      : "/brand/web-seo/site.webmanifest";
export const metadataIcons = generatedMetadata.icons;
export const siteKeywords = resolveMetadataKeywords(generatedMetadata.keywords);

export const siteLinks = {
  creator: "https://www.tsilva.eu",
  github: "https://github.com/tsilva/llame",
};

export const webApplicationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: siteName,
      url: siteUrl,
      description: siteDescription,
      keywords: siteKeywords.join(", "),
      inLanguage: "en-US",
      publisher: {
        "@type": "Person",
        name: "Tiago Silva",
        url: siteLinks.creator,
      },
    },
    {
      "@type": "SoftwareApplication",
      name: siteName,
      url: siteUrl,
      description: siteDescription,
      applicationCategory: "BrowserApplication",
      operatingSystem: "Any",
      image: `${siteUrl}${socialImage.url}`,
      screenshot: `${siteUrl}${socialImage.url}`,
      slogan: siteTagline,
      browserRequirements: "Requires JavaScript. WebGPU recommended, WASM supported.",
      isAccessibleForFree: true,
      featureList: [
        "Run ONNX large language models locally in the browser",
        "Use WebGPU acceleration with WASM fallback",
        "Chat with Qwen, Llama, and other compatible open models",
        "Keep prompts and responses on the user's device",
      ],
      creator: {
        "@type": "Person",
        name: "Tiago Silva",
        url: siteLinks.creator,
      },
      sameAs: [siteLinks.github],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};
