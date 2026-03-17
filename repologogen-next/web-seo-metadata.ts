import type { Metadata } from "next";

const payload: Omit<Metadata, "metadataBase"> = {
  "title": "llame | Privacy-First Browser-Based AI with WebGPU",
  "description": "Run ONNX-optimized LLMs and vision models entirely in your browser. Zero-setup, client-side inference featuring WebGPU acceleration, WASM fallback, and Transformer.js.",
  "keywords": [
    "WebGPU",
    "Transformers.js",
    "Local LLM",
    "ONNX-Runtime",
    "In-browser AI",
    "Next.js",
    "TypeScript",
    "Privacy-focused AI",
    "Vision Models",
    "WASM"
  ],
  "openGraph": {
    "title": "llame | Privacy-First Browser-Based AI with WebGPU",
    "description": "Run ONNX-optimized LLMs and vision models entirely in your browser. Zero-setup, client-side inference featuring WebGPU acceleration, WASM fallback, and Transformer.js.",
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
    "title": "llame | Privacy-First Browser-Based AI with WebGPU",
    "description": "Run ONNX-optimized LLMs and vision models entirely in your browser. Zero-setup, client-side inference featuring WebGPU acceleration, WASM fallback, and Transformer.js.",
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
