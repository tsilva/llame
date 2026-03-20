import type { Metadata } from "next";

const payload: Omit<Metadata, "metadataBase"> = {
  "title": "llame | Private In-Browser AI with WebGPU & Transformers.js",
  "description": "A client-side Next.js application for running ONNX language models locally using WebGPU and WebAssembly. No server-side inference or API keys required.",
  "keywords": [
    "nextjs",
    "webgpu",
    "transformers-js",
    "onnx-runtime",
    "client-side-ai",
    "webassembly",
    "private-gpt",
    "llm-browser",
    "wasm-inference",
    "typescript"
  ],
  "openGraph": {
    "title": "llame | Private In-Browser AI with WebGPU & Transformers.js",
    "description": "A client-side Next.js application for running ONNX language models locally using WebGPU and WebAssembly. No server-side inference or API keys required.",
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
    "title": "llame | Private In-Browser AI with WebGPU & Transformers.js",
    "description": "A client-side Next.js application for running ONNX language models locally using WebGPU and WebAssembly. No server-side inference or API keys required.",
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
