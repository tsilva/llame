import { VERIFIED_MODELS } from "@/config/verifiedModels";
import { MODEL_PRESETS } from "@/lib/constants";

export function getIndexableModelIds() {
  return Array.from(new Set([
    ...MODEL_PRESETS.map((preset) => preset.id),
    ...VERIFIED_MODELS.map((model) => model.id),
  ]));
}
