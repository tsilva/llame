<div align="center">
  <img src="./public/brand/logo/logo-1024.png" alt="llame" width="420" />

  **Private AI chats in your browser**

  [Live Demo](https://llame.tsilva.eu) · [GitHub](https://github.com/tsilva/llame)
</div>

llame is a fully client-side chat app for running ONNX language and vision models with WebGPU. No backend, no API key, no hosted inference.

Pick a model, wait for the browser download, and chat locally on your device.

## Install

```bash
git clone https://github.com/tsilva/llame.git
cd llame
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
pnpm dev      # start local dev server
pnpm build    # build static export
pnpm lint     # run ESLint
pnpm test     # run unit tests
```

## Notes

- Models are downloaded from Hugging Face into the browser.
- WebGPU is required for local inference.
- Conversations and images stay on your device.

## License

[MIT](LICENSE)
