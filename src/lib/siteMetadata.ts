import createGeneratedMetadata from "../../repologogen-next/web-seo-metadata";

export const siteName = "llame";
export const siteUrl = "https://llame.tsilva.eu";
export const siteTitle = "llame | Private Browser AI for Local LLM Chat";
export const siteDescription =
  "Run AI models in the privacy of your browser with WebGPU and WASM fallback.";
export const siteTagline =
  "Private browser AI with WebGPU acceleration, local model chat, and zero prompt upload.";
const generatedMetadata = createGeneratedMetadata(new URL(siteUrl));

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

export const siteKeywords = [
  "browser AI",
  "private browser AI",
  "local LLM",
  "on-device AI",
  "WebGPU LLM",
  "WebGPU chat",
  "client-side AI",
  "in-browser inference",
  "ONNX models",
  "Transformers.js",
  "Qwen browser chat",
  "Llama browser chat",
  "offline AI chat",
  "privacy-first AI",
];

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
