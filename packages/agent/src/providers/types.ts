export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; toolUseId: string; content: string; isError?: boolean };

export interface ChatMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool input. */
  inputSchema: Record<string, unknown>;
}

export interface GenerateRequest {
  system: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  signal?: AbortSignal;
}

export interface GenerateResponse {
  content: ContentBlock[];
  stopReason: "tool_use" | "end_turn" | "max_tokens" | "other";
}

/** Implement this interface to plug in another LLM API. */
export interface LlmProvider {
  readonly name: string;
  /** true for the deterministic demo provider; surfaced in the API and UI. */
  readonly isMock: boolean;
  generate(req: GenerateRequest): Promise<GenerateResponse>;
}
