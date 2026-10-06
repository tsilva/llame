<div align="center">
  <img src="./public/brand/logo/logo-1024.png" alt="llame" width="420" />

  **Private AI chats in your browser**

  [Live Demo](https://llame.tsilva.eu)
</div>

llame is a fully client-side chat app for running ONNX language and vision models with WebGPU. No backend, no API key, and no hosted inference.

Pick a model, wait for the browser download, and chat locally on your device.
Chat-tuned models use their tokenizer chat template when available. Base causal language models such as GPT-2 run as text-completion models with plain continuation prompts.

## Install

```bash
git clone https://github.com/tsilva/llame.git
cd llame
pnpm install
infisical login
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

- This repo enforces pnpm for installs.
- `pnpm install` configures the repo-managed pre-commit hook in `githooks/`.
- Models are downloaded from Hugging Face into the browser.
- Browser-tested model status lives in `src/config/verifiedModels.ts`; models that load and answer plausibly are marked verified, while known failing presets are marked broken with a reason.
- WebGPU is the supported inference device.
- Tokenization view can colorize the prompt input and visible chat messages after the selected model is loaded, using that model's tokenizer in the inference worker.
- Conversations, including uploaded images, are stored in IndexedDB, with `llame-` localStorage keys for settings and migration state.
- The Vercel deployment serves a static export with COOP/COEP and CSP headers for browser inference.

## Local credentials

Local private credentials are fetched from Infisical `llame`, Development `/`.
Run `infisical login`, then `pnpm dev --port auto` and open its printed URL.
`pnpm build:secrets` injects the local Sentry upload token in memory. Manager
credentials are stripped and absent secrets cannot fall back to local token files.
Public DSN/analytics settings can remain in dotenv files.

Production credentials are isolated in `llame-production`, Production `/`.
To stay within Infisical Free's native sync limit, this build-only site uses
`pnpm secrets:sync:production` to copy its Sentry build token to Vercel Production,
using the existing Infisical and Vercel CLI logins. The command is pinned to this
project, sends values through stdin, performs no deletions, and reports names only.
Run it after token changes, then redeploy; it does not run automatically or deploy.
Public production settings remain managed by Vercel.

`pnpm secrets:migrate` is a one-time Keychain import with exact readback. Originals
remain for recovery until provider rotation is verified. Inference runs entirely
in the browser and needs no cloud inference API key.

## Architecture

![llame architecture diagram](./architecture.png)

## License

[MIT](LICENSE)
