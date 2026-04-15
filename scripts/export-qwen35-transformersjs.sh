#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UV_BIN="${UV_BIN:-uv}"
export HF_HUB_DISABLE_XET="${HF_HUB_DISABLE_XET:-1}"

cd "${ROOT_DIR}"

if [[ "${1:-}" == "--" ]]; then
  shift
fi

exec "${UV_BIN}" run \
  --with torch \
  --with huggingface-hub \
  --with safetensors \
  --with transformers \
  --with onnx \
  --with onnxruntime \
  --with onnx-ir \
  python tools/onnx/export_qwen35_transformersjs.py "$@"
