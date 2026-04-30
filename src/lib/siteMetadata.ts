import type { Metadata } from "next";
import { getModelChatPath } from "@/lib/modelRoutes";
import { getModelDisplayName } from "@/lib/constants";
import createGeneratedMetadata from "../../web-seo-metadata";

export const siteName = "llame";
export const siteBackgroundColor = "#212121";
export const siteThemeColor = "#10a37f";
export const socialHandle = "@tiagosilva";
export const siteLocale = "en_US";
export const siteLanguage = "en-US";
const DEFAULT_SITE_URL = "https://llame.tsilva.eu";
const FALLBACK_SITE_DESCRIPTION =
  "Run local AI models in your browser. No installs, no API keys, and your chats stay on your device.";
const FALLBACK_SITE_KEYWORDS = [
  "private-ai-chat",
  "browser-ai",
  "local-ai",
  "run-ai-in-browser",
  "on-device-ai",
  "offline-ai",
  "local-llm",
  "browser-llm",
  "private-ai",
  "webgpu",
  "onnx",
  "transformers.js",
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
const metadataBase = new URL(siteUrl);

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
export const siteTagline = "Private AI chats in your browser";
export const chatPageTitle = `llame | ${siteTagline}`;
export const chatPageDescription =
  `${siteTagline} with local models on your device.`;

function normalizeMetadataUrl(value: string | URL): string {
  return value instanceof URL ? value.toString() : value;
}

function resolveAbsoluteUrl(path: string): string {
  return new URL(path, metadataBase).toString();
}

function getGeneratedSocialImage() {
  const images = generatedMetadata.openGraph?.images;
  const firstImage = Array.isArray(images) ? images[0] : images;

  if (!firstImage) {
    return {
      url: "/brand/web-seo/og-image-1200x630.png",
      width: 1200,
      height: 630,
      alt: `llame social card for ${siteTagline}`,
    };
  }

  if (typeof firstImage === "string" || firstImage instanceof URL) {
    return {
      url: normalizeMetadataUrl(firstImage),
      width: 1200,
      height: 630,
      alt: `llame social card for ${siteTagline}`,
    };
  }

  return {
    url: normalizeMetadataUrl(firstImage.url),
    width: firstImage.width ?? 1200,
    height: firstImage.height ?? 630,
    alt: firstImage.alt ?? `llame social card for ${siteTagline}`,
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

export const sharedSiteMetadata: Metadata = {
  metadataBase,
  applicationName: siteName,
  authors: [{ name: "Tiago Silva" }],
  creator: "Tiago Silva",
  publisher: "Tiago Silva",
  manifest: metadataManifestPath,
  icons: metadataIcons,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteName,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  referrer: "strict-origin-when-cross-origin",
  category: "technology",
};

type PageMetadataOptions = {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: Metadata["robots"];
  includeLanguages?: boolean;
  keywords?: string[];
  image?: typeof socialImage;
};

function createPageMetadata({
  title,
  description,
  canonicalPath,
  robots,
  includeLanguages = false,
  keywords = siteKeywords,
  image = socialImage,
}: PageMetadataOptions): Metadata {
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalPath,
      ...(includeLanguages
        ? {
            languages: {
              [siteLanguage]: canonicalPath,
            },
          }
        : {}),
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      siteName,
      locale: siteLocale,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: socialHandle,
      site: socialHandle,
      images: [image.url],
    },
    ...(robots ? { robots } : {}),
  };
}

export const homePageMetadata = createPageMetadata({
  title: siteTitle,
  description: siteDescription,
  canonicalPath: "/",
  includeLanguages: true,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
});

export const chatPageMetadata = createPageMetadata({
  title: chatPageTitle,
  description: chatPageDescription,
  canonicalPath: "/chat",
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
});

export function createModelChatPageMetadata(modelId?: string | null): Metadata {
  const normalizedModelId = modelId?.trim();

  if (!normalizedModelId) {
    return chatPageMetadata;
  }

  const modelDisplayName = getModelDisplayName(normalizedModelId);
  const title = `Chat with ${modelDisplayName} locally | llame`;
  const description =
    `Use llame to chat privately with ${modelDisplayName} in your browser. The model runs fully locally on your device.`;
  const modelSocialImage = {
    ...socialImage,
    alt: `llame card for private local ${modelDisplayName} chats`,
  };

  return createPageMetadata({
    title,
    description,
    canonicalPath: getModelChatPath(normalizedModelId),
    image: modelSocialImage,
    keywords: [
      `${modelDisplayName} chat`,
      `${modelDisplayName} browser chat`,
      normalizedModelId,
      ...siteKeywords,
    ],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  });
}

export const homePageJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: siteName,
      url: siteUrl,
      description: siteDescription,
      keywords: siteKeywords.join(", "),
      inLanguage: siteLanguage,
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
      image: resolveAbsoluteUrl(socialImage.url),
      screenshot: resolveAbsoluteUrl(socialImage.url),
      slogan: siteTagline,
      browserRequirements: "Requires JavaScript and WebGPU.",
      isAccessibleForFree: true,
      featureList: [
        "Run local AI models directly in your browser",
        "Keep prompts and responses on your device",
        "Start chatting without installs or API keys",
        "Use popular open models including Qwen and Llama",
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
