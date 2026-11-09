<p align="center">
  <img src="./logo.png" alt="llame logo" width="300" />
  <br />
  <!-- repo-tagline:start -->
  <strong>💬 Private AI chats in your browser 🔒</strong>
  <!-- repo-tagline:end -->
</p>

**Private AI chats in your browser**

  [Live Demo](https://llame.tsilva.eu)

llame is a fully client-side chat app for running ONNX language and vision models with WebGPU. No backend, no API key, and no hosted inference.

Pick a model, wait for the browser download, and chat locally on your device.
Chat-tuned models use their tokenizer chat template when available. Base causal language models such as GPT-2 run as text-completion models with plain continuation prompts.

## Install

```bash
git clone https://github.com/tsilva/llame.git
cd llame
pnpm install
pnpm dev --port auto
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
pnpm dev      # start local dev server
pnpm build    # build static export
pnpm lint     # run ESLint
pnpm test     # run unit tests
pnpm run check:verified-model-sitemap
```

## Notes

The sitemap lists the homepage and model chat pages. Preset and verified model pages use the same route list for the static build and the sitemap.

- Local builds skip Sentry source-map uploads. Hosted Vercel builds handle uploads.
- This repo enforces pnpm for installs.
- The browser-only inference dependency graph excludes `onnxruntime-node`. Next lint keeps its rules and uses a compatible `tinyglobby` registry alias for project-directory discovery; `pnpm test:dependency-security` verifies both boundaries.
- `pnpm install` configures the repo-managed pre-commit hook in `githooks/`.
- Models are downloaded from Hugging Face into the browser.
- Browser-tested model status lives in `src/config/verifiedModels.ts`; models that load and answer plausibly are marked verified, while known failing presets are marked broken with a reason.
- WebGPU is the supported inference device.
- Tokenization view can colorize the prompt input and visible chat messages after the selected model is loaded, using that model's tokenizer in the inference worker.
- Conversations, including uploaded images, are stored in IndexedDB, with `llame-` localStorage keys for settings and migration state.
- The Vercel deployment serves a static export with COOP/COEP and CSP headers for browser inference.

## Architecture

![llame architecture diagram](./architecture.png)

## License

[MIT](LICENSE)

Production delivery runs on pushes to `main` and supports manual secret rotations. See [production delivery](docs/production-delivery.md) for destinations, access boundaries and failure behavior.

Production secrets are delivered through the pinned shared GitHub Actions workflow. The standalone signed Infisical relay triggers synchronization and deployment; see [production delivery](docs/production-delivery.md) for scope and recovery.

Production delivery keeps Vercel secret isolation enabled and distinguishes public configuration from private credentials; see [production delivery](docs/production-delivery.md).

Dependency security checks pin the fixed matcher and traversal packages. The seven-day package hold remains enabled with exact approved exceptions for `minimatch@11.0.1`, `@isaacs/nonrecursive-glob-match@1.0.1`, `glob@14.0.2`, and `path-scurry@3.0.0`. The patches in [`patches/`](patches/) preserve legacy ESLint imports and migrate its internal-module rule to the safe matcher API. The existing test command includes compatibility, adversarial-pattern, cancellation, and Next/Sentry file-selection regressions; these run locally without service credentials or source-map uploads.
