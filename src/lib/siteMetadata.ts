import type { Metadata } from "next";
import createGeneratedMetadata from "../../web-seo-metadata";

export const siteName = "llame";
export const siteBackgroundColor = "#212121";
export const siteThemeColor = "#10a37f";
export const socialHandle = "@tiagosilva";
export const siteLocale = "en_US";
export const siteLanguage = "en-US";
const DEFAULT_SITE_URL = "https://llame.tsilva.eu";
const FALLBACK_SITE_DESCRIPTION =
  "Chat with local ONNX models in your browser using WebGPU or WASM. No server inference, no API keys, and prompts stay on your device.";
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
export const siteTagline =
  "No Python. No CUDA. No server. Just a URL for private, on-device AI chat.";
export const chatPageTitle = "llame Chat | Local Browser AI Workspace";
export const chatPageDescription =
  "Launch llame's local chat workspace to run ONNX models on-device with WebGPU or WASM.";

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
      alt: "llame social card for private in-browser AI with WebGPU acceleration",
    };
  }

  if (typeof firstImage === "string" || firstImage instanceof URL) {
    return {
      url: normalizeMetadataUrl(firstImage),
      width: 1200,
      height: 630,
      alt: "llame social card for private in-browser AI with WebGPU acceleration",
    };
  }

  return {
    url: normalizeMetadataUrl(firstImage.url),
    width: firstImage.width ?? 1200,
    height: firstImage.height ?? 630,
    alt: firstImage.alt ?? "llame social card for private in-browser AI with WebGPU acceleration",
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
  canonicalPath: "/" | "/chat";
  robots?: Metadata["robots"];
  includeLanguages?: boolean;
};

function createPageMetadata({
  title,
  description,
  canonicalPath,
  robots,
  includeLanguages = false,
}: PageMetadataOptions): Metadata {
  return {
    title,
    description,
    keywords: siteKeywords,
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
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: socialHandle,
      site: socialHandle,
      images: [socialImage.url],
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
