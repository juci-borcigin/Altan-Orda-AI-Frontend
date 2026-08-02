export type LlmProvider =
  | "openrouter"
  | "openai"
  | "google"
  | "anthropic"
  | "xai"
  | "deepseek"
  | "perplexity";

export type LlmRoute = {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  /** 実 API に送る model パラメータ */
  modelId: string;
};

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type OutboundChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ChatContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: OutboundToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type OutboundToolCall = {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
};
