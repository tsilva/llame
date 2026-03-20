# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build (static export via `next build --webpack`)
- `npm run lint` — ESLint (flat config with core-web-vitals + TypeScript rules)
- `npm start` — serve production build

## Architecture

llame is a **fully client-side** app that runs ONNX LLMs in the browser via WebGPU/WASM. There is no backend — all inference happens on the user's device.

### Key design pattern: Web Worker message protocol

The core architecture is a typed message-passing protocol between the main thread and a Web Worker:

- **`src/types/index.ts`** — defines `WorkerRequest` (main→worker) and `WorkerResponse` (worker→main) discriminated unions. All worker communication flows through these types.
- **`src/workers/inference.worker.ts`** — the Web Worker that loads models via `@huggingface/transformers`, runs tokenization/generation, and streams tokens back. Contains a `ThinkingParser` class that handles `<think>`/`<thinking>`/`<thought>`/`<reasoning>` tag formats from reasoning models.
- **`src/hooks/useInferenceWorker.ts`** — React hook that manages the Worker lifecycle and exposes `loadModel()`, `generate()`, `interrupt()`, `reset()`. Uses callback refs (`onTokenRef`, `onThinkingCompleteRef`, `onCompleteRef`) for streaming updates to avoid re-renders.

### Page structure

Single-page app with one route (`src/app/page.tsx`). The `Home` component orchestrates all state: conversations (persisted to localStorage), model selection, generation params, and worker coordination. Models auto-load on first message send.

### Model handling

- Standard causal LMs use `AutoTokenizer` + `AutoModelForCausalLM`
- Qwen3.5 VLM uses `AutoProcessor` + `AutoModelForImageTextToText` (detected by checking if modelId contains "Qwen3.5")
- WebGPU uses fp16 precision; WASM falls back to q4
- Model presets and generation defaults are in `src/lib/constants.ts`

### Static export & COOP/COEP

The app is configured as `output: "export"` in `next.config.ts`. `vercel.json` sets `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` headers required for `SharedArrayBuffer` (needed by ONNX runtime). The webpack config aliases `sharp` and `onnxruntime-node` to `false` to prevent server-side imports.

### Path aliases

`@/*` maps to `./src/*` (configured in tsconfig.json).

## Conventions

- README.md must be kept up to date with any significant project changes
- Tailwind CSS 4 for styling (dark theme, hardcoded color values like `#212121`, `#2f2f2f`, `#10a37f`)
- Icons from `lucide-react`
- Markdown rendering uses `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-highlight`
- localStorage keys prefixed with `llame-`
