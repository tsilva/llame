<div align="center">
  <img src="logo.png" alt="llame" width="512"/>

  [![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)   [![Deploy](https://img.shields.io/badge/demo-live-brightgreen)](https://llame.tsilva.eu)

  **No Python. No CUDA. No server. Just a URL.**

  **🧠 Run AI models in the privacy of your browser ⚡**

  [Live Demo](https://llame.tsilva.eu)
</div>

## Overview

**The Pain:** Testing small language models means setting up Python environments, downloading weights, and wrestling with CUDA drivers — all before generating a single token.

**The Solution:** llame runs ONNX-optimized LLMs entirely in the browser using WebGPU acceleration (with WASM fallback), powered by [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js).

**The Result:** Open a URL, pick a model, and start chatting — zero setup, zero dependencies, zero server costs.

<div align="center">

| Metric | Value |
|--------|-------|
| 🖥️ Backend | None — 100% client-side |
| ⚡ Acceleration | WebGPU (fp16) / WASM (q4) |
| 📦 Smallest model | ~250MB download |
| 🔧 Setup | `npm install && npm run dev` |

</div>

## ✨ Features

- 🚀 **In-browser inference** — models run entirely on your device via Web Workers
- ⚡ **WebGPU acceleration** — fp16 precision with automatic WASM fallback for unsupported browsers, including a smaller text-only fallback preset when WebGPU is unavailable
- 🔎 **Model browser** — search ONNX Community LLMs and VLMs from the UI and inspect a local compatibility estimate before switching
- 💬 **Chat interface** — real-time token streaming with tokens/second counter
- 🧪 **Raw debug view** — toggle between formatted chat and exact model input/output for debugging
- 🖼️ **Vision capable** — supports image input for visual question answering
- 🎛️ **Tunable generation** — temperature, top-p, top-k, repetition penalty, max tokens
- 📊 **Progress tracking** — live download progress overlay when loading models
- 💾 **Durable chat storage** — conversations and image attachments persist in IndexedDB, with automatic migration from older `localStorage` installs
- 🛟 **Recovery flows** — retry network loads, switch to WASM on resource issues, and fall back to the default preset when a model is unsupported or broken
- 📈 **Production telemetry** — optional Sentry error reporting and product analytics without sending prompts, outputs, or images off-device
- 🌐 **SEO and social ready** — canonical metadata, JSON-LD, web manifest, branded icons, and share cards for richer previews
- 🔒 **Private by design** — nothing leaves your browser, ever

## 🚀 Quick Start

```bash
git clone https://github.com/tsilva/llame.git
cd llame
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — chats persist locally and the default curated preset is revision-pinned for deterministic production loads.

## 🏗️ Architecture

```
src/
├── app/              # Next.js app router (layout + page)
├── components/       # UI — ChatInterface, ModelSelector, SettingsPanel, StatusBar
├── hooks/            # useWebGPU (feature detection), useInferenceWorker (worker bridge)
├── lib/              # Constants — model presets, default generation params
├── types/            # TypeScript interfaces — messages, worker protocol
└── workers/          # Web Worker — model loading, tokenization, generation
```

All inference runs in a dedicated Web Worker (`inference.worker.ts`) using `@huggingface/transformers`, keeping the UI thread free.

## 🎛️ Supported Models

The dropdown ships with a few curated, revision-pinned presets. The in-app model browser can search additional LLM and VLM repos from the [ONNX Community](https://huggingface.co/onnx-community) on Hugging Face, sort them by downloads or recency, and filter by type, size, and current-device fit.

| Preset | Size | Download |
|--------|------|----------|
| Qwen3.5 0.8B | 0.8B params | ~850MB |
| Qwen3.5 2B | 2B params | ~2GB |
| Qwen2.5 0.5B | 0.5B params | ~538MB |
| SmolLM3 3B | 3B params | ~2.1GB |

For searched models, llame shows a best-effort compatibility badge based on the selected runtime, browser WebGPU support, reported device memory, CPU concurrency, and the model's inferred size. It is a heuristic, not a guarantee.

Curated presets are the production-supported path. Community browser results are marked experimental and may fail even when the compatibility badge looks favorable.

## 💻 Requirements

| Requirement | WebGPU (recommended) | WASM (fallback) |
|-------------|----------------------|-----------------|
| Browser | Chrome 113+, Edge 113+ | All modern browsers |
| GPU VRAM | 2GB+ | N/A |
| RAM | 4GB+ | 4GB+ |
| Precision | fp16 | q4 (quantized) |

WebGPU is detected automatically. If unavailable, the app falls back to WASM with quantized models and defaults to the smaller Qwen2.5 0.5B text preset instead of the heavier vision preset.

## 🌐 Deployment

The app is configured as a static export (`output: "export"`) with `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` for `SharedArrayBuffer` support. `credentialless` keeps the app cross-origin isolated while allowing public Hugging Face asset downloads that do not opt into CORP. Its CSP also needs to allow both standard Hugging Face hosts and the newer `*.xethub.hf.co` bridge used for model asset downloads.

Static metadata assets ship with the export: `site.webmanifest`, branded favicons/apple-touch icon, and a dedicated 1200x630 social card used by both Open Graph and Twitter metadata. The root layout also emits JSON-LD for the website and software application.

ONNX Runtime's WASM loader is pinned to same-origin assets under `public/onnxruntime/` so production CSP does not depend on jsDelivr for the `.mjs` and `.wasm` runtime bootstrap files. The CSP must also allow `blob:` in `script-src`, plus WebAssembly/eval bootstrap (`'wasm-unsafe-eval'` and `'unsafe-eval'` for worker compatibility), so ONNX Runtime can initialize in-browser.

For Google Analytics 4, set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in the build environment. The root layout injects the GA script only when that variable is present, so local development works without analytics by default.

Vercel Analytics and Speed Insights are disabled by default for this static custom-domain deployment to avoid `/_vercel/insights/*` console 404s. Enable them explicitly with `NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS=true` if you have the Vercel-side endpoint wiring in place.

For Sentry client-side error reporting, set `NEXT_PUBLIC_SENTRY_DSN`. Telemetry is enabled only in production builds and sends only metadata such as model id, revision, runtime, and error code.

Deploy to Vercel:

```bash
npm run build
```

The included `vercel.json` handles the required COOP/COEP headers and Hugging Face download CSP allowances automatically.

It also ships a CSP, referrer policy, content-type protection, and a locked-down permissions policy suitable for the fully client-side deployment model.

## ✅ Quality Gates

```bash
npm run lint
npm test
npm run test:e2e
npm run build
npm run smoke
```

`npm run smoke` verifies the built static export and the required production headers in `vercel.json`.

See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for the manual browser/device matrix and deployment checklist.

## 🛠️ Tech Stack

- [Next.js 16](https://nextjs.org/) — static export
- [React 19](https://react.dev/) — UI
- [@huggingface/transformers](https://huggingface.co/docs/transformers.js) — in-browser inference
- [Tailwind CSS 4](https://tailwindcss.com/) — styling
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [WebGPU](https://www.w3.org/TR/webgpu/) / [WebAssembly](https://webassembly.org/) — compute backends

## 📄 License

MIT

---

<div align="center">

[Try the Live Demo](https://llame.tsilva.eu) · [Read the Architecture](#%EF%B8%8F-architecture) · [Star on GitHub](https://github.com/tsilva/llame) ⭐

</div>

## License

MIT
