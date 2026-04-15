#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gc
import json
import re
import shutil
from pathlib import Path
from typing import Callable

import onnx
import torch
from huggingface_hub import snapshot_download
from onnx import TensorProto, numpy_helper
from onnxruntime.quantization.matmul_nbits_quantizer import (
    DefaultWeightOnlyQuantConfig,
    MatMulNBitsQuantizer,
)
from safetensors import safe_open


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_ID = "tsilva/unsloth_Qwen3.5-0.8B_uncensored"
DEFAULT_REFERENCE_MODEL_ID = "onnx-community/Qwen3.5-0.8B-ONNX"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "build" / "onnx-transformersjs" / "tsilva__unsloth_Qwen3.5-0.8B_uncensored"
EXTERNAL_DATA_SIZE_THRESHOLD_BYTES = 1024
INLINE_SENSITIVE_INITIALIZER_PREFIXES = (
    "/model/constants/",
    "model.inv_freq",
    "model.vision.inv_freq",
)
MODEL_SNAPSHOT_PATTERNS = [
    "config.json",
    "generation_config.json",
    "chat_template.jinja",
    "tokenizer.json",
    "tokenizer_config.json",
    "processor_config.json",
    "preprocessor_config.json",
    "model.safetensors",
    "model.safetensors.index.json",
    "model.safetensors-*.safetensors",
]
REFERENCE_SNAPSHOT_PATTERNS = [
    "onnx/embed_tokens_fp16.onnx",
    "onnx/embed_tokens_fp16.onnx_data",
    "onnx/vision_encoder_fp16.onnx",
    "onnx/vision_encoder_fp16.onnx_data",
    "onnx/decoder_model_merged_fp16.onnx",
    "onnx/decoder_model_merged_fp16.onnx_data",
]
METADATA_FILENAMES = [
    "config.json",
    "generation_config.json",
    "chat_template.jinja",
    "tokenizer.json",
    "tokenizer_config.json",
    "processor_config.json",
    "preprocessor_config.json",
]

VISION_BLOCK_RE = re.compile(r"model\.layers\.(\d+)\.(.+)")
DECODER_LAYER_RE = re.compile(r"model\.layers\.(\d+)\.(.+)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Package a custom Qwen3.5 checkpoint into the Transformers.js ONNX layout used by llame."
    )
    parser.add_argument("--model-id", default=DEFAULT_MODEL_ID)
    parser.add_argument("--reference-model-id", default=DEFAULT_REFERENCE_MODEL_ID)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--cache-dir", type=Path, default=ROOT_DIR / "build" / "hf-cache")
    parser.add_argument(
        "--decoder-dtype",
        choices=("fp16", "q4f16"),
        default="q4f16",
        help="Final decoder artifact to emit for Transformers.js.",
    )
    parser.add_argument(
        "--keep-decoder-fp16",
        action="store_true",
        help="Keep the intermediate fp16 decoder graph alongside the quantized decoder.",
    )
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def delete_if_exists(path: Path) -> None:
    if path.exists():
        path.unlink()


def clear_previous_outputs(output_dir: Path) -> None:
    onnx_dir = output_dir / "onnx"
    for path in onnx_dir.glob("*.onnx*"):
        if path.is_file() or path.is_symlink():
            path.unlink()
    shutil.rmtree(output_dir / "_raw", ignore_errors=True)
    shutil.rmtree(output_dir / "_reference_stage", ignore_errors=True)


def merge_json_objects(base: object, override: object) -> object:
    if isinstance(base, dict) and isinstance(override, dict):
        merged = dict(base)
        for key, value in override.items():
            merged[key] = merge_json_objects(merged[key], value) if key in merged else value
        return merged
    return override


def copy_metadata(snapshot_dir: Path, output_dir: Path, reference_snapshot_dir: Path | None = None) -> None:
    for filename in METADATA_FILENAMES:
        source = snapshot_dir / filename
        if not source.exists() and reference_snapshot_dir is not None and filename == "preprocessor_config.json":
            source = reference_snapshot_dir / filename
        if not source.exists():
            continue

        destination = output_dir / filename
        if filename == "config.json" and reference_snapshot_dir is not None:
            reference_config_path = reference_snapshot_dir / filename
            if reference_config_path.exists():
                with source.open() as handle:
                    source_config = json.load(handle)
                with reference_config_path.open() as handle:
                    reference_config = json.load(handle)

                reference_transformers_js_config = reference_config.get("transformers.js_config")
                if reference_transformers_js_config:
                    source_config["transformers.js_config"] = merge_json_objects(
                        reference_transformers_js_config,
                        source_config.get("transformers.js_config") or {},
                    )

                with destination.open("w") as handle:
                    json.dump(source_config, handle, indent=2)
                    handle.write("\n")
                continue

        shutil.copy2(source, destination)


class SafeTensorReader:
    def __init__(self, snapshot_dir: Path) -> None:
        self.snapshot_dir = snapshot_dir
        self.key_to_file = self._load_weight_map(snapshot_dir)
        self.handles: dict[Path, object] = {}

    def _load_weight_map(self, snapshot_dir: Path) -> dict[str, Path]:
        index_path = snapshot_dir / "model.safetensors.index.json"
        if index_path.exists():
            with index_path.open() as handle:
                index = json.load(handle)
            return {key: snapshot_dir / filename for key, filename in index["weight_map"].items()}

        single_path = snapshot_dir / "model.safetensors"
        if single_path.exists():
            with safe_open(single_path.as_posix(), framework="pt", device="cpu") as handle:
                return {key: single_path for key in handle.keys()}

        shard_paths = sorted(snapshot_dir.glob("model.safetensors-*.safetensors"))
        if len(shard_paths) == 1:
            with safe_open(shard_paths[0].as_posix(), framework="pt", device="cpu") as handle:
                return {key: shard_paths[0] for key in handle.keys()}

        raise FileNotFoundError(f"No safetensors weights found in {snapshot_dir}")

    def get_tensor(self, key: str) -> torch.Tensor:
        path = self.key_to_file.get(key)
        if path is None:
            raise KeyError(f"Missing tensor {key}")
        handle = self.handles.get(path)
        if handle is None:
            handle = safe_open(path.as_posix(), framework="pt", device="cpu")
            self.handles[path] = handle
        return handle.get_tensor(key)


def transpose_2d(tensor: torch.Tensor) -> torch.Tensor:
    return tensor.transpose(0, 1).contiguous()


def squeeze_conv1d(tensor: torch.Tensor) -> torch.Tensor:
    return tensor.squeeze(1).contiguous()


def neg_exp(tensor: torch.Tensor) -> torch.Tensor:
    return (-torch.exp(tensor.to(torch.float32))).contiguous()


def flatten_patch_embed_weight(tensor: torch.Tensor) -> torch.Tensor:
    return tensor.flatten(start_dim=1).transpose(0, 1).contiguous()


def torch_tensor_to_numpy(tensor: torch.Tensor, data_type: int):
    tensor = tensor.detach().cpu().contiguous()
    if data_type == TensorProto.FLOAT16:
        return tensor.to(torch.float16).numpy()
    if data_type == TensorProto.FLOAT:
        return tensor.to(torch.float32).numpy()
    if data_type == TensorProto.DOUBLE:
        return tensor.to(torch.float64).numpy()
    if data_type == TensorProto.INT64:
        return tensor.to(torch.int64).numpy()
    if data_type == TensorProto.INT32:
        return tensor.to(torch.int32).numpy()
    raise ValueError(f"Unsupported TensorProto data type: {data_type}")


def replace_initializer(
    initializer: onnx.TensorProto,
    tensor: torch.Tensor,
) -> None:
    array = torch_tensor_to_numpy(tensor, initializer.data_type)
    if tuple(array.shape) != tuple(initializer.dims):
        raise ValueError(
            f"Shape mismatch for {initializer.name}: expected {tuple(initializer.dims)}, got {tuple(array.shape)}"
        )
    initializer.CopyFrom(numpy_helper.from_array(array, initializer.name))


def save_onnx_with_external_data(model: onnx.ModelProto, output_path: Path) -> None:
    delete_if_exists(output_path)
    delete_if_exists(output_path.parent / f"{output_path.name}_data")
    onnx.save_model(
        model,
        output_path.as_posix(),
        save_as_external_data=True,
        all_tensors_to_one_file=True,
        location=f"{output_path.name}_data",
        # Keep tiny scalar/shape constants inline to match the reference graphs.
        # ORT WebGPU shape inference can fail when those constants live in
        # external data, even though the weight tensors should stay external.
        size_threshold=EXTERNAL_DATA_SIZE_THRESHOLD_BYTES,
        convert_attribute=False,
    )
    validate_external_data_layout(output_path)


def validate_external_data_layout(output_path: Path) -> None:
    model = onnx.load_model(output_path.as_posix(), load_external_data=False)
    invalid_initializers: list[str] = []

    for initializer in model.graph.initializer:
        if initializer.data_location != onnx.TensorProto.EXTERNAL:
            continue

        metadata = {entry.key: entry.value for entry in initializer.external_data}
        length = int(metadata.get("length", "0"))
        if any(initializer.name.startswith(prefix) for prefix in INLINE_SENSITIVE_INITIALIZER_PREFIXES):
            invalid_initializers.append(f"{initializer.name} ({length} bytes)")

    if invalid_initializers:
        joined = ", ".join(invalid_initializers[:5])
        if len(invalid_initializers) > 5:
            joined += ", ..."
        raise ValueError(
            "Exported ONNX graph still externalized small initializers, "
            f"which breaks browser loading: {joined}"
        )


def materialize_reference_artifact(source_path: Path, stage_dir: Path) -> Path:
    ensure_dir(stage_dir)
    staged_path = stage_dir / source_path.name
    shutil.copy2(source_path.resolve(), staged_path)
    for sibling in source_path.parent.glob(f"{source_path.name}_data*"):
        shutil.copy2(sibling.resolve(), stage_dir / sibling.name)
    return staged_path


Transform = Callable[[torch.Tensor], torch.Tensor]


def resolve_vision_tensor_name(name: str) -> tuple[str, Transform | None] | None:
    if name == "model.embeddings.patch_embed.weight":
        return "model.visual.patch_embed.proj.weight", flatten_patch_embed_weight
    if name == "model.embeddings.patch_embed.Add.bias":
        return "model.visual.patch_embed.proj.bias", None
    if name == "model.pos_embed.weight":
        return "model.visual.pos_embed.weight", None
    if name == "model.layers.merger.merger_norm_layernorm.weight":
        return "model.visual.merger.norm.weight", None
    if name == "model.layers.merger.merger_norm_layernorm.bias":
        return "model.visual.merger.norm.bias", None
    if name == "model.merger.linear1.MatMul.weight":
        return "model.visual.merger.linear_fc1.weight", transpose_2d
    if name == "model.merger.linear1.Add.bias":
        return "model.visual.merger.linear_fc1.bias", None
    if name == "model.merger.linear2.MatMul.weight":
        return "model.visual.merger.linear_fc2.weight", transpose_2d
    if name == "model.merger.linear2.Add.bias":
        return "model.visual.merger.linear_fc2.bias", None

    match = VISION_BLOCK_RE.fullmatch(name)
    if not match:
        return None

    layer_idx, suffix = match.groups()
    prefix = f"model.visual.blocks.{layer_idx}"
    if suffix.startswith("norm1_layernorm."):
        attr = suffix.removeprefix("norm1_layernorm.")
        return f"{prefix}.norm1.{attr}", None
    if suffix.startswith("norm2_layernorm."):
        attr = suffix.removeprefix("norm2_layernorm.")
        return f"{prefix}.norm2.{attr}", None
    if suffix == "attn.qkv.MatMul.weight":
        return f"{prefix}.attn.qkv.weight", transpose_2d
    if suffix == "attn.qkv.Add.bias":
        return f"{prefix}.attn.qkv.bias", None
    if suffix == "attn.proj.MatMul.weight":
        return f"{prefix}.attn.proj.weight", transpose_2d
    if suffix == "attn.proj.Add.bias":
        return f"{prefix}.attn.proj.bias", None
    if suffix == "mlp.linear_fc1.MatMul.weight":
        return f"{prefix}.mlp.linear_fc1.weight", transpose_2d
    if suffix == "mlp.linear_fc1.Add.bias":
        return f"{prefix}.mlp.linear_fc1.bias", None
    if suffix == "mlp.linear_fc2.MatMul.weight":
        return f"{prefix}.mlp.linear_fc2.weight", transpose_2d
    if suffix == "mlp.linear_fc2.Add.bias":
        return f"{prefix}.mlp.linear_fc2.bias", None
    return None


def resolve_decoder_tensor_name(name: str) -> tuple[str, Transform | None] | None:
    if name == "model.layers.24.final_norm_layernorm.weight":
        return "model.language_model.norm.weight", None

    match = DECODER_LAYER_RE.fullmatch(name)
    if not match:
        return None

    layer_idx, suffix = match.groups()
    prefix = f"model.language_model.layers.{layer_idx}"
    if suffix == "input_layernorm.weight":
        return f"{prefix}.input_layernorm.weight", None
    if suffix == "post_attention_layernorm.weight":
        return f"{prefix}.post_attention_layernorm.weight", None
    if suffix == "gdn.conv1d.weight":
        return f"{prefix}.linear_attn.conv1d.weight", squeeze_conv1d
    if suffix == "gdn.conv1d.weight_3d":
        return f"{prefix}.linear_attn.conv1d.weight", None
    if suffix == "gdn.A_neg_exp":
        return f"{prefix}.linear_attn.A_log", neg_exp
    if suffix == "gdn.dt_bias":
        return f"{prefix}.linear_attn.dt_bias", None
    if suffix == "gdn.norm.weight":
        return f"{prefix}.linear_attn.norm.weight", None
    if suffix == "gdn.in_proj_qkv.MatMul.weight":
        return f"{prefix}.linear_attn.in_proj_qkv.weight", transpose_2d
    if suffix == "gdn.in_proj_z.MatMul.weight":
        return f"{prefix}.linear_attn.in_proj_z.weight", transpose_2d
    if suffix == "gdn.in_proj_b.MatMul.weight":
        return f"{prefix}.linear_attn.in_proj_b.weight", transpose_2d
    if suffix == "gdn.in_proj_a.MatMul.weight":
        return f"{prefix}.linear_attn.in_proj_a.weight", transpose_2d
    if suffix == "gdn.out_proj.MatMul.weight":
        return f"{prefix}.linear_attn.out_proj.weight", transpose_2d
    if suffix == "attn.q_proj.MatMul.weight":
        return f"{prefix}.self_attn.q_proj.weight", transpose_2d
    if suffix == "attn.k_proj.MatMul.weight":
        return f"{prefix}.self_attn.k_proj.weight", transpose_2d
    if suffix == "attn.v_proj.MatMul.weight":
        return f"{prefix}.self_attn.v_proj.weight", transpose_2d
    if suffix == "attn.o_proj.MatMul.weight":
        return f"{prefix}.self_attn.o_proj.weight", transpose_2d
    if suffix == "attn.q_norm.layernorm.weight":
        return f"{prefix}.self_attn.q_norm.weight", None
    if suffix == "attn.k_norm.layernorm.weight":
        return f"{prefix}.self_attn.k_norm.weight", None
    if suffix == "mlp.gate_proj.MatMul.weight":
        return f"{prefix}.mlp.gate_proj.weight", transpose_2d
    if suffix == "mlp.up_proj.MatMul.weight":
        return f"{prefix}.mlp.up_proj.weight", transpose_2d
    if suffix == "mlp.down_proj.MatMul.weight":
        return f"{prefix}.mlp.down_proj.weight", transpose_2d
    return None


def transplant_reference_component(
    reader: SafeTensorReader,
    reference_path: Path,
    output_path: Path,
    resolver: Callable[[str], tuple[str, Transform | None] | None],
) -> None:
    model = onnx.load_model(reference_path.as_posix(), load_external_data=True)
    replaced = 0
    for initializer in model.graph.initializer:
        resolved = resolver(initializer.name)
        if resolved is None:
            continue
        tensor_name, transform = resolved
        tensor = reader.get_tensor(tensor_name)
        if transform is not None:
            tensor = transform(tensor)
        replace_initializer(initializer, tensor)
        replaced += 1

    save_onnx_with_external_data(model, output_path)
    print(f"Wrote {output_path.name} with {replaced} transplanted tensors.")
    del model
    gc.collect()


def export_embed_tokens(reader: SafeTensorReader, reference_path: Path, output_dir: Path) -> None:
    output_path = output_dir / "onnx" / "embed_tokens_fp16.onnx"
    model = onnx.load_model(reference_path.as_posix(), load_external_data=True)
    initializer = next(init for init in model.graph.initializer if init.name == "model.embed_tokens.weight")
    replace_initializer(initializer, reader.get_tensor("model.language_model.embed_tokens.weight"))
    save_onnx_with_external_data(model, output_path)
    print(f"Wrote {output_path.name}.")
    del model
    gc.collect()


def export_vision_encoder(reader: SafeTensorReader, reference_path: Path, output_dir: Path) -> None:
    transplant_reference_component(
        reader,
        reference_path,
        output_dir / "onnx" / "vision_encoder_fp16.onnx",
        resolve_vision_tensor_name,
    )


def export_decoder_fp16(reader: SafeTensorReader, reference_path: Path, output_path: Path) -> None:
    model = onnx.load_model(reference_path.as_posix(), load_external_data=True)
    replaced = 0
    for initializer in model.graph.initializer:
        resolved = resolve_decoder_tensor_name(initializer.name)
        if resolved is None:
            continue
        tensor_name, transform = resolved
        tensor = reader.get_tensor(tensor_name)
        if transform is not None:
            tensor = transform(tensor)
        replace_initializer(initializer, tensor)
        replaced += 1
    save_onnx_with_external_data(model, output_path)
    print(f"Wrote {output_path.name} with {replaced} transplanted tensors.")
    del model
    gc.collect()


def quantize_decoder_q4f16(fp16_path: Path, output_path: Path) -> None:
    config = DefaultWeightOnlyQuantConfig(block_size=128, is_symmetric=False)
    quantizer = MatMulNBitsQuantizer(fp16_path.as_posix(), algo_config=config)
    quantizer.process()
    temp_path = output_path.with_suffix(".tmp.onnx")
    delete_if_exists(temp_path)
    delete_if_exists(temp_path.parent / f"{temp_path.name}.data")
    quantizer.model.save_model_to_file(temp_path.as_posix(), use_external_data_format=True)

    model = onnx.load_model(temp_path.as_posix(), load_external_data=True)
    save_onnx_with_external_data(model, output_path)

    delete_if_exists(temp_path)
    delete_if_exists(temp_path.parent / f"{temp_path.name}.data")
    print(f"Wrote {output_path.name}.")


def main() -> int:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    cache_dir = args.cache_dir.resolve()
    ensure_dir(output_dir)
    ensure_dir(output_dir / "onnx")
    ensure_dir(cache_dir)
    clear_previous_outputs(output_dir)

    model_snapshot_dir = Path(
        snapshot_download(
            repo_id=args.model_id,
            cache_dir=cache_dir.as_posix(),
            allow_patterns=MODEL_SNAPSHOT_PATTERNS,
        )
    )
    reference_snapshot_dir = Path(
        snapshot_download(
            repo_id=args.reference_model_id,
            cache_dir=cache_dir.as_posix(),
            allow_patterns=REFERENCE_SNAPSHOT_PATTERNS,
        )
    )

    print(f"Using model snapshot: {model_snapshot_dir}")
    print(f"Using reference snapshot: {reference_snapshot_dir}")
    print(f"Writing package to: {output_dir}")

    copy_metadata(model_snapshot_dir, output_dir, reference_snapshot_dir)
    reader = SafeTensorReader(model_snapshot_dir)
    reference_stage_dir = output_dir / "_reference_stage"

    staged_embed_reference = materialize_reference_artifact(
        reference_snapshot_dir / "onnx" / "embed_tokens_fp16.onnx",
        reference_stage_dir,
    )
    staged_vision_reference = materialize_reference_artifact(
        reference_snapshot_dir / "onnx" / "vision_encoder_fp16.onnx",
        reference_stage_dir,
    )
    staged_decoder_reference = materialize_reference_artifact(
        reference_snapshot_dir / "onnx" / "decoder_model_merged_fp16.onnx",
        reference_stage_dir,
    )

    export_embed_tokens(reader, staged_embed_reference, output_dir)
    export_vision_encoder(reader, staged_vision_reference, output_dir)

    decoder_fp16_path = output_dir / "onnx" / "decoder_model_merged_fp16.onnx"
    export_decoder_fp16(reader, staged_decoder_reference, decoder_fp16_path)

    if args.decoder_dtype == "q4f16":
        quantize_decoder_q4f16(
            decoder_fp16_path,
            output_dir / "onnx" / "decoder_model_merged_q4f16.onnx",
        )
        if not args.keep_decoder_fp16:
            delete_if_exists(decoder_fp16_path)
            delete_if_exists(output_dir / "onnx" / f"{decoder_fp16_path.name}_data")
    else:
        print("Keeping decoder_model_merged_fp16.onnx as the final decoder artifact.")

    shutil.rmtree(reference_stage_dir, ignore_errors=True)

    print("Export complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
