export interface MessageDebugData {
  modelInput?: string;
  rawOutput?: string;
}

export type GenerationStopReason =
  | "eos_token"
  | "max_new_tokens"
  | "interrupted"
  | "stale"
  | "unknown";

export interface GenerationStats {
  tps: number;
  numTokens: number;
  generationTime: number;
  stopReason: GenerationStopReason;
}

export type ModelSupportTier = "curated" | "experimental";

export interface ModelSelection {
  id: string;
  revision?: string | null;
  supportsImages?: boolean | null;
  recommendedDevice?: "webgpu" | "wasm";
  supportTier?: ModelSupportTier;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  images?: string[]; // Base64-encoded images for VLM support
  stats?: GenerationStats;
  debug?: MessageDebugData;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  modelId: string;
  modelRevision?: string | null;
  modelSupportsImages?: boolean | null;
  recommendedDevice?: "webgpu" | "wasm";
  supportTier?: ModelSupportTier;
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  modelRevision?: string | null;
  modelSupportsImages?: boolean | null;
  recommendedDevice?: "webgpu" | "wasm";
  supportTier?: ModelSupportTier;
  messageCount: number;
  sizeBytes: number;
}

export interface StorageStats {
  usedBytes: number;
  quotaBytes: number;
  conversationCount: number;
}

export interface GenerationParams {
  max_new_tokens: number;
  temperature: number;
  top_p: number;
  min_p: number;
  top_k: number;
  repetition_penalty: number;
  do_sample: boolean;
  thinkingEnabled: boolean;
}

export interface ProgressInfo {
  file: string;
  progress: number;
  loaded: number;
  total: number;
}

export interface TotalProgressInfo {
  progress: number;
  loaded: number;
  total: number;
}

export interface AdapterInfo {
  vendor: string;
  architecture: string;
  description: string;
}

export type StorageErrorCode =
  | "IDB_UNAVAILABLE"
  | "MIGRATION_FAILED"
  | "WRITE_FAILED"
  | "READ_FAILED"
  | "DELETE_FAILED"
  | "QUOTA_EXCEEDED";

export interface StorageErrorState {
  code: StorageErrorCode;
  message: string;
}

export type WorkerErrorCode =
  | "NETWORK_ERROR"
  | "UNSUPPORTED_MODEL"
  | "INSUFFICIENT_RESOURCES"
  | "MODEL_ARTIFACT_ERROR"
  | "GENERATION_ERROR"
  | "NO_MODEL_LOADED"
  | "UNKNOWN_ERROR";

export type WorkerErrorStage = "load" | "generate";

// Worker -> Main thread messages
export type WorkerResponse =
  | { status: "ready" }
  | { status: "loading"; message: string }
  | { status: "progress"; progress: ProgressInfo }
  | { status: "progress_total"; progress: TotalProgressInfo }
  | { status: "loaded"; modelId: string; revision?: string | null; device: string; precision: string; supportsImages: boolean }
  | { status: "processing"; message: string }
  | { status: "generating" }
  | { status: "prompt"; inputText: string }
  | { status: "raw_update"; token: string }
  | { status: "update"; token: string; tps: number; numTokens: number; inputTokens?: number; isThinking?: boolean }
  | { status: "thinking_complete"; thinking: string }
  | ({ status: "complete" } & GenerationStats)
  | {
      status: "error";
      error: string;
      code: WorkerErrorCode;
      stage: WorkerErrorStage;
      modelId?: string | null;
      revision?: string | null;
      device?: "webgpu" | "wasm" | null;
    }
  | { status: "unloaded" };

// Main thread -> Worker messages
export type WorkerRequest =
  | { type: "load"; modelId: string; revision?: string | null; device: "webgpu" | "wasm" }
  | { type: "generate"; messages: ChatMessage[]; params: GenerationParams }
  | { type: "interrupt" }
  | { type: "reset" };
