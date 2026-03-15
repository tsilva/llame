export const siteName = "llame";
export const siteUrl = "https://llame.tsilva.eu";
export const siteTitle = "llame | Private Browser AI for Local LLM Chat";
export const siteDescription =
  "Run AI models in the privacy of your browser with WebGPU and WASM fallback.";
export const siteTagline =
  "Private browser AI with WebGPU acceleration, local model chat, and zero prompt upload.";
export const socialImage = {
  url: "/brand/social-card.png",
  width: 1200,
  height: 630,
  alt: "llame social card showing a private browser AI workspace with WebGPU and on-device model badges.",
};

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
