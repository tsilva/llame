<div align="center">
  <img src="logo.png" alt="llame" width="512"/>

  [![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Deploy](https://img.shields.io/badge/demo-live-brightgreen)](https://llame.vercel.app)

  **No Python. No CUDA. No server. Just a URL.**

  **🧠 Run LLMs directly in your browser — no server, no API keys, just WebGPU ⚡**

  [Live Demo](https://llame.vercel.app)
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
- ⚡ **WebGPU acceleration** — fp16 precision with automatic WASM fallback for unsupported browsers
- 🔎 **Model browser** — search ONNX Community LLMs and VLMs from the UI and inspect a local compatibility estimate before switching
- 💬 **Chat interface** — real-time token streaming with tokens/second counter
- 🧪 **Raw debug view** — toggle between formatted chat and exact model input/output for debugging
- 🖼️ **Vision capable** — supports image input for visual question answering
- 🎛️ **Tunable generation** — temperature, top-p, top-k, repetition penalty, max tokens
- 📊 **Progress tracking** — live download progress overlay when loading models
- 🔒 **Private by design** — nothing leaves your browser, ever

## 🚀 Quick Start

```bash
git clone https://github.com/tsilva/llame.git
cd llame
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the Qwen3.5 0.8B model loads automatically.

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

The dropdown ships with a few curated presets, and the in-app model browser can search additional LLM and VLM repos from the [ONNX Community](https://huggingface.co/onnx-community) on Hugging Face.

| Preset | Size | Download |
|--------|------|----------|
| Qwen3.5 0.8B | 0.8B params | ~850MB |
| Qwen3.5 2B | 2B params | ~2GB |
| SmolLM3 3B | 3B params | ~2.1GB |

For searched models, llame shows a best-effort compatibility badge based on the selected runtime, browser WebGPU support, reported device memory, CPU concurrency, and the model's inferred size. It is a heuristic, not a guarantee.

## 💻 Requirements

| Requirement | WebGPU (recommended) | WASM (fallback) |
|-------------|----------------------|-----------------|
| Browser | Chrome 113+, Edge 113+ | All modern browsers |
| GPU VRAM | 2GB+ | N/A |
| RAM | 4GB+ | 4GB+ |
| Precision | fp16 | q4 (quantized) |

WebGPU is detected automatically. If unavailable, the app falls back to WASM with quantized models.

## 🌐 Deployment

The app is configured as a static export (`output: "export"`) with required `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers for `SharedArrayBuffer` support.

Deploy to Vercel:

```bash
npm run build
```

The included `vercel.json` handles the required COOP/COEP headers automatically.

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

[Try the Live Demo](https://llame.vercel.app) · [Read the Architecture](#%EF%B8%8F-architecture) · [Star on GitHub](https://github.com/tsilva/llame) ⭐

</div>

## License

MIT
