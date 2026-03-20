import type { Metadata } from "next";

const payload: Omit<Metadata, "metadataBase"> = {
  "title": "llame: Private Browser-Based AI with WebGPU & Next.js",
  "description": "A serverless Next.js application for running private AI models directly in the browser using WebGPU, WASM, and Transformers.js.",
  "keywords": [
    "transformers.js",
    "webgpu",
    "wasm",
    "onnx-runtime",
    "nextjs",
    "local-llm",
    "browser-ai",
    "client-side-inference",
    "private-ai",
    "web-worker"
  ],
  "openGraph": {
    "title": "llame: Private Browser-Based AI with WebGPU & Next.js",
    "description": "A serverless Next.js application for running private AI models directly in the browser using WebGPU, WASM, and Transformers.js.",
    "images": [
      {
        "url": "/brand/web-seo/og-image-1200x630.png",
        "width": 1200,
        "height": 630,
        "alt": "llame brand card"
      }
    ]
  },
  "twitter": {
    "card": "summary_large_image",
    "title": "llame: Private Browser-Based AI with WebGPU & Next.js",
    "description": "A serverless Next.js application for running private AI models directly in the browser using WebGPU, WASM, and Transformers.js.",
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
