export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  images?: string[]; // Base64-encoded images for VLM support
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  modelId: string;
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
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
  top_k: number;
  repetition_penalty: number;
  do_sample: boolean;
}

export interface ProgressInfo {
  file: string;
  progress: number;
  loaded: number;
  total: number;
}

export interface AdapterInfo {
  vendor: string;
  architecture: string;
  description: string;
}

// Worker -> Main thread messages
export type WorkerResponse =
  | { status: "ready" }
  | { status: "loading"; message: string }
  | { status: "progress"; progress: ProgressInfo }
  | { status: "loaded"; modelId: string; device: string }
  | { status: "generating" }
  | { status: "update"; token: string; tps: number; numTokens: number; isThinking?: boolean }
  | { status: "thinking_complete"; thinking: string }
  | { status: "complete"; tps: number; numTokens: number }
  | { status: "error"; error: string }
  | { status: "unloaded" };

// Main thread -> Worker messages
export type WorkerRequest =
  | { type: "load"; modelId: string; device: "webgpu" | "wasm" }
  | { type: "generate"; messages: ChatMessage[]; params: GenerationParams }
  | { type: "interrupt" }
  | { type: "reset" };
