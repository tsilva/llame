## Qwen3.5 Export

This directory holds the local conversion tooling for packaging Qwen3.5 multimodal models into the ONNX file layout that `llame` and Transformers.js expect.

As of March 30, 2026, the latest stable Transformers.js release is `v4.0.0`. The Qwen3.5 multimodal loader expects split ONNX sessions under `onnx/`:

- `embed_tokens_<dtype>.onnx`
- `vision_encoder_<dtype>.onnx`
- `decoder_model_merged_<dtype>.onnx`

The exporter in this repo currently targets that layout with these defaults:

- `embed_tokens_fp16.onnx`
- `vision_encoder_fp16.onnx`
- `decoder_model_merged_q4f16.onnx`

That matches the current `llame` WebGPU load policy for Qwen3.5 models.

### Run

```bash
pnpm onnx:export:qwen35 -- --model-id tsilva/unsloth_Qwen3.5-0.8B_uncensored
```

Optional flags:

- `--output-dir /absolute/or/relative/path`
- `--cache-dir /absolute/or/relative/path`
- `--sample-image-size 224`

The exporter downloads:

- the custom Hugging Face checkpoint you want to package
- the official `onnx-community/Qwen3.5-0.8B-ONNX` reference graphs

It then:

- copies the tokenizer and processor assets from the custom checkpoint
- transplants fine-tuned weights into the reference `embed_tokens_fp16` graph
- transplants fine-tuned vision weights into the reference `vision_encoder_fp16` graph
- transplants fine-tuned decoder weights into the reference `decoder_model_merged_fp16` graph
- quantizes the decoder locally into `decoder_model_merged_q4f16.onnx`

This avoids re-exporting the Qwen3.5 vision graph from PyTorch, which is brittle for this architecture.

### Current Scope

This toolchain is intentionally narrow for now:

- It is built for Qwen3.5 multimodal models.
- It is optimized for the latest Transformers.js WebGPU path, not ONNX Runtime GenAI packaging.
- It assumes the custom checkpoint is architecture-compatible with the Qwen3.5 0.8B ONNX reference graphs.
- It does not yet emit the full matrix of `fp32/fp16/q4/q4f16/q8` variants that some public ONNX repos publish.
