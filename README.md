<div align="center">
  <img src="./public/brand/logo/logo-1024.png" alt="llame" width="512" />

  [![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
  [![Live Demo](https://img.shields.io/badge/demo-live-10a37f)](https://llame.tsilva.eu)

  **🦙 Private AI chat, running on your device 🦙**

  [Live Demo](https://llame.tsilva.eu) · [GitHub](https://github.com/tsilva/llame)
</div>

## Overview

**The Punchline:** llame is a fully client-side chat app for running ONNX language and vision-language models in the browser. It uses [Transformers.js](https://huggingface.co/docs/transformers.js), WebGPU when available, and WASM as a fallback.

**The Pain:** local LLM tools usually ask users to install Python, CUDA, model runners, or API keys before they can try a model privately.

**The Solution:** llame turns the browser into the runtime. Open a URL, pick a model, download the model artifacts from Hugging Face, and chat without a backend inference service.

**The Result:** prompts, responses, image attachments, and saved conversations stay on the user's device. Hosting is static, while inference happens inside a Web Worker.

<div align="center">

| Fact | Value |
|------|-------|
| Architecture | Static, fully client-side app |
| Runtime | WebGPU fp16/q4f16 / WASM q4 |
| Curated presets | 5 browser-ready model presets |
| Default model download | ~850MB |

</div>

## Features

- **Private browser inference** - prompts and generations run locally in a dedicated Web Worker.
- **WebGPU-first runtime** - uses accelerated browser GPU execution when available and switches to WASM when needed.
- **Curated model presets** - ships with revision-pinned Qwen3.5, Gemma 4, and SmolLM3 ONNX presets.
- **Hugging Face model browser** - searches browser-ready ONNX chat and vision models, then filters by compatibility signals.
- **Streaming chat workspace** - streams tokens, tokens-per-second, stop reasons, and model loading progress.
- **Vision-capable chats** - accepts up to 5 compressed image attachments for supported multimodal models.
- **Reasoning controls** - parses `<think>`-style reasoning blocks and exposes model-specific thinking toggles.
- **Local conversation history** - stores chats and images in IndexedDB with `llame-` local keys for lightweight preferences.
- **Debug visibility** - includes raw prompt/output inspection for validating templates and model behavior.

## Quick Start

### Use Online

Open [llame.tsilva.eu](https://llame.tsilva.eu), launch the app, and start a new chat. The first message loads the selected model in the browser.

### Run Locally

```bash
git clone https://github.com/tsilva/llame.git
cd llame
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

This repo is pinned to `pnpm@10.27.0`; the `preinstall` script rejects other package managers.

### Check Changes

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm smoke
```

`pnpm smoke` expects a completed static export in `out/`, so run it after `pnpm build`.

## Usage

1. Open the app and choose a curated model or search the Hugging Face model browser.
2. Send a prompt. If the model is not loaded yet, llame downloads and warms it up first.
3. Attach images when the selected model supports vision input.
4. Tune generation settings such as max tokens, temperature, top-p, min-p, top-k, repetition penalty, and thinking mode.
5. Use the raw debug view when you need to inspect the exact chat template and model output.

Direct model routes are supported with the full Hugging Face namespace:

```text
/chat/onnx-community/Qwen3.5-0.8B-ONNX
/chat/tsilva/unsloth_Qwen3.5-0.8B_uncensored
```

Opening a model route starts a fresh chat with that model selected, and the URL updates when the selected model changes.

## Supported Models

llame ships with curated, revision-pinned presets from `src/lib/constants.ts`.

| Preset | Params | Quantization | Download | Images |
|--------|--------|--------------|----------|--------|
| Qwen3.5 0.8B | 0.8B | q4+fp16 | ~850MB | Yes |
| Qwen3.5 0.8B Uncensored | 0.8B | q4+fp16 | ~1.1GB | Yes |
| Qwen3.5 2B | 2B | q4+fp16 | ~2GB | Yes |
| Gemma 4 E2B | 2B | q4f16 | ~44GB | Yes |
| SmolLM3 3B | 3B | q4/q4f16 | ~2.1GB | No |

Models in `src/config/verifiedModels.ts` are marked as verified after personal testing and can define model-specific sampling defaults. Search results from the model browser are best-effort and may still fail depending on browser support, repo packaging, and device limits.

## Requirements

| Requirement | WebGPU path | WASM path |
|-------------|-------------|-----------|
| Browser | Chrome 113+ or Edge 113+ | Modern browsers |
| GPU memory | 2GB+ recommended | Not required |
| System memory | 4GB+ recommended | 4GB+ recommended |
| Precision policy | fp16 / q4f16 by model | q4 fallback |

WebGPU support is detected on load. When unavailable, llame switches to WASM and prefers the smaller text-only fallback model.

## Architecture

```text
src/
├── app/          # Next.js routes, metadata, robots, sitemap, global styles
├── components/   # Chat UI, model browser, model selector, settings, sidebar
├── config/       # Verified model metadata and sampling defaults
├── hooks/        # Worker lifecycle and storage hooks
├── lib/          # Model policy, storage, telemetry, prompts, parsing, helpers
├── types/        # Worker protocol and app data types
└── workers/      # Browser inference worker
```

The core boundary is a typed Web Worker protocol:

- `src/types/index.ts` defines `WorkerRequest` and `WorkerResponse` discriminated unions.
- `src/hooks/useInferenceWorker.ts` owns Worker creation, lifecycle state, streaming callbacks, interruption, and reset behavior.
- `src/workers/inference.worker.ts` loads tokenizers/processors/models, handles image inputs, streams tokens, tracks stop reasons, and parses reasoning blocks.
- `src/lib/storage.ts` persists conversations in IndexedDB and migrates older localStorage-backed data.

There is no application backend. Model discovery and model downloads call Hugging Face directly from the browser.

## Deployment

llame builds as a static export with `output: "export"` in `next.config.ts`.

```bash
pnpm build
pnpm smoke
```

Production hosting must keep the cross-origin isolation headers needed by ONNX Runtime and `SharedArrayBuffer`. The included `vercel.json` sets:

- `Cross-Origin-Embedder-Policy: credentialless`
- `Cross-Origin-Opener-Policy: same-origin`
- a CSP that allows same-origin workers/WASM plus Hugging Face model downloads
- standard referrer, content type, and permissions policies

ONNX Runtime WASM bootstrap files are served from `public/onnxruntime/`, so production does not depend on a third-party CDN for those runtime assets.

## Environment Variables

All runtime variables are optional.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, Open Graph, Twitter cards, robots, and sitemap |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 measurement ID |
| `NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS` | Enables Vercel Analytics and Speed Insights when set to `true` |
| `NEXT_PUBLIC_SENTRY_DSN` | Enables browser Sentry reporting when allowed by environment |
| `SENTRY_DSN` | Server/edge Sentry DSN for future runtime handlers |
| `NEXT_PUBLIC_SENTRY_ENABLED` | Forces Sentry on or off outside the default production behavior |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Overrides the default production trace sample rate of `0.1` |

For source map uploads, copy `.env.sentry-build-plugin.example` to `.env.sentry-build-plugin` locally or set the same values in CI/CD:

```bash
SENTRY_AUTH_TOKEN=
SENTRY_ORG=tsilva
SENTRY_PROJECT=llame
```

For read-only issue lookups, copy `.env.sentry-mcp.example` to `.env.sentry-mcp` and run:

```bash
pnpm sentry:issues --days 7 --limit 10 --status unresolved
```

Use a token with `org:read`, `project:read`, and `event:read`.

## Privacy And Telemetry

llame is designed so prompts, generated text, conversations, and image attachments stay in the browser unless the user manually shares them elsewhere.

Optional analytics and error reporting are production-gated. Sentry is configured with `sendDefaultPii: false`, removes request bodies, and scrubs fields named like prompts, outputs, conversations, messages, images, and attachments before events are sent.

## Custom ONNX Conversion

The repo includes Qwen3.5 multimodal export tooling in `tools/onnx/` for building Transformers.js-style ONNX packages compatible with llame.

```bash
pnpm onnx:export:qwen35 -- --model-id tsilva/unsloth_Qwen3.5-0.8B_uncensored
```

By default, the exporter writes to `build/onnx-transformersjs/` with:

- `onnx/embed_tokens_fp16.onnx`
- `onnx/vision_encoder_fp16.onnx`
- `onnx/decoder_model_merged_q4f16.onnx`

See `tools/onnx/README.md` for scope, optional flags, and packaging details.

## Tech Stack

- [Next.js 16](https://nextjs.org/) - static export shell, routing, metadata, robots, and sitemap.
- [React 19](https://react.dev/) - chat workspace, modals, streaming state, and client-side interaction.
- [TypeScript](https://www.typescriptlang.org/) - typed worker protocol and app data model.
- [Tailwind CSS 4](https://tailwindcss.com/) - dark interface styling and responsive layout.
- [Transformers.js](https://huggingface.co/docs/transformers.js) - tokenizer, processor, and ONNX model loading in the browser.
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) - WebGPU and WASM execution through Transformers.js.
- [Vitest](https://vitest.dev/) and [Playwright](https://playwright.dev/) - unit, component, and browser-level checks.
- [Sentry](https://sentry.io/) and [Vercel Analytics](https://vercel.com/docs/analytics) - optional production observability.

## Notes

- First model load can be large because artifacts are downloaded from Hugging Face.
- Larger vision models can exceed browser, GPU, or device memory limits.
- `Gemma 4 E2B` is listed because the app recognizes the packaging, but its download size is much larger than the small default presets.
- `RELEASE_CHECKLIST.md` covers manual release checks across browsers and devices.

## License

[MIT](LICENSE)

## Support

Star the repo if llame is useful, open an issue for reproducible model or browser problems, and include the model ID, browser, device path, and console output when reporting failures.
