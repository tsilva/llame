#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UV_BIN="${UV_BIN:-uv}"
MODEL_ID="${MODEL_ID:-tsilva/unsloth_Qwen3.5-0.8B_uncensored}"
PRECISION="${PRECISION:-int4}"
EXECUTION_PROVIDER="${EXECUTION_PROVIDER:-webgpu}"
OUTPUT_DIR="${OUTPUT_DIR:-${ROOT_DIR}/build/onnx-webgpu/unsloth_Qwen3.5-0.8B_uncensored-int4}"
ENABLE_WEBGPU_GRAPH="${ENABLE_WEBGPU_GRAPH:-true}"
SHARED_EMBEDDINGS="${SHARED_EMBEDDINGS:-true}"
PRUNE_LM_HEAD="${PRUNE_LM_HEAD:-true}"
EXCLUDE_EMBEDS="${EXCLUDE_EMBEDS:-false}"
REPACK_SINGLE_FILE="${REPACK_SINGLE_FILE:-true}"

cd "${ROOT_DIR}"
"${UV_BIN}" sync --locked

mkdir -p "${OUTPUT_DIR}"

"${UV_BIN}" run --no-sync \
  --with onnxruntime-genai \
  --with onnx-ir \
  --with onnx \
  --with onnxruntime \
  python -m onnxruntime_genai.models.builder \
    -m "${MODEL_ID}" \
    -o "${OUTPUT_DIR}" \
    -p "${PRECISION}" \
    -e "${EXECUTION_PROVIDER}" \
    --extra_options \
      "exclude_embeds=${EXCLUDE_EMBEDS}" \
      "enable_webgpu_graph=${ENABLE_WEBGPU_GRAPH}" \
      "shared_embeddings=${SHARED_EMBEDDINGS}" \
      "prune_lm_head=${PRUNE_LM_HEAD}" \
    "$@"

if [[ "${REPACK_SINGLE_FILE}" == "true" && -f "${OUTPUT_DIR}/model.onnx.data" ]]; then
  "${UV_BIN}" run --no-sync --with onnx python - "${OUTPUT_DIR}" <<'PY'
import os
import sys
from pathlib import Path

import onnx

out_dir = Path(sys.argv[1])
model_path = out_dir / "model.onnx"
data_path = out_dir / "model.onnx.data"
tmp_path = out_dir / "model.single.onnx"

model = onnx.load(str(model_path), load_external_data=True)
onnx.save_model(model, str(tmp_path), save_as_external_data=False)
os.replace(tmp_path, model_path)
data_path.unlink(missing_ok=True)
PY
fi
