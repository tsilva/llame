import type { Metadata } from "next";

const payload: Omit<Metadata, "metadataBase"> = {
  "title": "Private AI Chat in Your Browser | llame",
  "description": "Run local AI models in your browser. No installs, no API keys, and your chats stay on your device.",
  "keywords": [
    "private-ai-chat",
    "browser-ai",
    "local-ai",
    "run-ai-in-browser",
    "on-device-ai",
    "offline-ai",
    "local-llm",
    "browser-llm",
    "webgpu",
    "onnx",
    "transformers-js"
  ],
  "openGraph": {
    "title": "Private AI Chat in Your Browser | llame",
    "description": "Run local AI models in your browser. No installs, no API keys, and your chats stay on your device.",
    "images": [
      {
        "url": "/brand/web-seo/og-image-1200x630.png",
        "width": 1200,
        "height": 630,
        "alt": "llame social card for private AI chat that runs in your browser"
      }
    ]
  },
  "twitter": {
    "card": "summary_large_image",
    "title": "Private AI Chat in Your Browser | llame",
    "description": "Run local AI models in your browser. No installs, no API keys, and your chats stay on your device.",
    "images": [
      "/brand/web-seo/og-image-1200x630.png"
    ]
  },
  "icons": {
    "icon": [
      {
        "url": "/brand/web-seo/favicon/favicon-32.png",
        "sizes": "32x32",
        "type": "image/png"
      },
      {
        "url": "/brand/web-seo/favicon/favicon-48.png",
        "sizes": "48x48",
        "type": "image/png"
      }
    ],
    "apple": [
      {
        "url": "/brand/web-seo/apple-touch-icon.png",
        "sizes": "180x180",
        "type": "image/png"
      }
    ],
    "shortcut": [
      "/brand/web-seo/favicon/favicon.ico"
    ]
  },
  "manifest": "/brand/web-seo/site.webmanifest"
};

export function createMetadata(metadataBase: URL): Metadata {
  return {
    metadataBase,
    ...payload,
  };
}

export default createMetadata;
