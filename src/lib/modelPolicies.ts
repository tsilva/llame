import { InferenceDevice } from "@/types";

export interface BrowserExclusionContext {
  id: string;
  tags?: string[];
}

export interface RuntimePolicyContext {
  id: string;
  parameterCountB: number | null;
  isVisionModel: boolean;
}

export interface CompatibilityPolicyContext extends RuntimePolicyContext {
  device: InferenceDevice;
  deviceMemoryGb: number | null;
}

interface BrowserExclusionRule {
  id: string;
  idTokens?: string[];
  tagTokens?: string[];
}

interface RuntimePolicyRule {
  id: string;
  modelIdPattern: RegExp;
  minParameterCountB?: number;
  excludeVisionModels?: boolean;
  preferredDtype?: Partial<Record<InferenceDevice, string>>;
  compatibilityPenalty?: {
    device: InferenceDevice;
    maxDeviceMemoryGb?: number;
    scoreDelta: number;
  }[];
}

const BROWSER_EXCLUSION_RULES: BrowserExclusionRule[] = [
  {
    id: "task-specific-name-tokens",
    idTokens: ["embedding", "embeddings", "rerank", "reranker", "docling"],
    tagTokens: ["embedding", "embeddings", "rerank", "reranker", "docling"],
  },
  {
    id: "random-checkpoints",
    idTokens: ["tiny-random"],
  },
];

const RUNTIME_POLICY_RULES: RuntimePolicyRule[] = [
  {
    id: "large-qwen2-webgpu",
    modelIdPattern: /(?:^|\/)Qwen2(?:\.5)?-/i,
    minParameterCountB: 1,
    excludeVisionModels: true,
    preferredDtype: {
      webgpu: "q4",
    },
    compatibilityPenalty: [
      { device: "webgpu", maxDeviceMemoryGb: 8, scoreDelta: -28 },
      { device: "webgpu", scoreDelta: -12 },
    ],
  },
];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesTokenBoundary(haystack: string, token: string) {
  return new RegExp(`(?:^|[-_/])${escapeRegex(token)}(?:$|[-_/])`, "i").test(haystack);
}

function matchesBrowserExclusionRule(rule: BrowserExclusionRule, context: BrowserExclusionContext) {
  if (rule.idTokens?.some((token) => matchesTokenBoundary(context.id, token))) {
    return true;
  }

  const tags = context.tags ?? [];
  return tags.some((tag) => rule.tagTokens?.some((token) => matchesTokenBoundary(tag, token)) ?? false);
}

function matchesRuntimePolicyRule(rule: RuntimePolicyRule, context: RuntimePolicyContext) {
  if (!rule.modelIdPattern.test(context.id)) return false;
  if (rule.excludeVisionModels && context.isVisionModel) return false;
  if (rule.minParameterCountB !== undefined) {
    return context.parameterCountB !== null && context.parameterCountB >= rule.minParameterCountB;
  }
  return true;
}

export function isModelExcludedFromBrowser(context: BrowserExclusionContext) {
  return BROWSER_EXCLUSION_RULES.some((rule) => matchesBrowserExclusionRule(rule, context));
}

export function getPreferredDtypePolicy(
  context: RuntimePolicyContext,
  device: InferenceDevice,
) {
  for (const rule of RUNTIME_POLICY_RULES) {
    if (!matchesRuntimePolicyRule(rule, context)) continue;
    const dtype = rule.preferredDtype?.[device];
    if (dtype) return dtype;
  }

  return null;
}

export function getCompatibilityScoreAdjustment(context: CompatibilityPolicyContext) {
  let scoreDelta = 0;

  for (const rule of RUNTIME_POLICY_RULES) {
    if (!matchesRuntimePolicyRule(rule, context)) continue;

    for (const penalty of rule.compatibilityPenalty ?? []) {
      if (penalty.device !== context.device) continue;
      if (penalty.maxDeviceMemoryGb !== undefined) {
        if (context.deviceMemoryGb === null || context.deviceMemoryGb > penalty.maxDeviceMemoryGb) {
          continue;
        }
      }

      scoreDelta += penalty.scoreDelta;
      break;
    }
  }

  return scoreDelta;
}
