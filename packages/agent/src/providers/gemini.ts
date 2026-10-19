import { GoogleGenAI } from "@google/genai";
import { DomainError } from "@homeflow/shared";
import type { ContentBlock, GenerateRequest, GenerateResponse, LlmProvider } from "./types.js";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const MAX_RETRIES = 2;

export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  client?: Pick<GoogleGenAI, "models">;
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  readonly isMock = false;
  private readonly client: Pick<GoogleGenAI, "models">;

  constructor(private readonly opts: GeminiProviderOptions) {
    if (!opts.apiKey) throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
    this.client = opts.client ?? new GoogleGenAI({ apiKey: opts.apiKey });
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const timeoutMs = this.opts.timeoutMs ?? 30_000;
    let attempt = 0;
    while (true) {
      try {
        return await this.generateOnce(req, timeoutMs);
      } catch (err) {
        if (attempt >= MAX_RETRIES || !isTransient(err)) throw mapGeminiError(err);
        await delay(250 * 2 ** attempt);
        attempt += 1;
      }
    }
  }

  private async generateOnce(req: GenerateRequest, timeoutMs: number): Promise<GenerateResponse> {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
    const response = await Promise.race([
      this.client.models.generateContent({
        model: this.opts.model ?? DEFAULT_MODEL,
        contents: req.messages.map((message) => toGeminiContent(message, req.messages)),
        config: {
          systemInstruction: req.system,
          temperature: 0.2,
          maxOutputTokens: this.opts.maxOutputTokens ?? 2048,
          tools: [{ functionDeclarations: req.tools.map((tool) => ({ name: tool.name, description: tool.description, parametersJsonSchema: tool.inputSchema })) }],
        },
      }),
      abortOnSignal(signal),
    ]);
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const content: ContentBlock[] = [];
    for (const part of parts) {
      if (part.text) content.push({ type: "text", text: part.text });
      if (part.functionCall?.name) {
        content.push({
          type: "tool_use",
          id: part.functionCall.id ?? crypto.randomUUID(),
          name: part.functionCall.name,
          input: part.functionCall.args ?? {},
          thoughtSignature: part.thoughtSignature,
        });
      }
    }
    if (content.length === 0) throw new DomainError("PROVIDER_ERROR", "The Gemini provider returned an empty response.");
    const finishReason = response.candidates?.[0]?.finishReason;
    return {
      content,
      stopReason: content.some((block) => block.type === "tool_use")
        ? "tool_use"
        : finishReason === "MAX_TOKENS"
          ? "max_tokens"
          : finishReason === "STOP"
            ? "end_turn"
            : "other",
    };
  }
}

function toGeminiContent(message: GenerateRequest["messages"][number], messages: GenerateRequest["messages"]) {
  const parts = message.content.map((block) => {
    if (block.type === "text") return { text: block.text };
    if (block.type === "tool_use")
      return {
        functionCall: { id: block.id, name: block.name, args: block.input as Record<string, unknown> },
        ...(block.thoughtSignature ? { thoughtSignature: block.thoughtSignature } : {}),
      };
    let response: unknown = block.content;
    try {
      response = JSON.parse(block.content);
    } catch {
      // Keep non-JSON tool errors as text.
    }
    return { functionResponse: { name: toolNameForResult(messages, block.toolUseId), response: { result: response } } };
  });
  return { role: message.role === "assistant" ? "model" : "user", parts };
}

function toolNameForResult(messages: GenerateRequest["messages"], toolUseId: string): string {
  for (const message of messages) {
    const matching = message.content.find((block) => block.type === "tool_use" && block.id === toolUseId);
    if (matching?.type === "tool_use") return matching.name;
  }
  return "unknown_tool";
}

function abortOnSignal(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason ?? new Error("Request aborted"));
    else signal.addEventListener("abort", () => reject(signal.reason ?? new Error("Request aborted")), { once: true });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(err: unknown): boolean {
  const status = (err as { status?: number; code?: number }).status ?? (err as { code?: number }).code;
  const name = (err as { name?: string }).name;
  return status === 429 || (typeof status === "number" && status >= 500) || name === "AbortError" || name === "TimeoutError";
}

export function mapGeminiError(err: unknown): DomainError {
  const status = (err as { status?: number; code?: number }).status ?? (err as { code?: number }).code;
  if ((err as { name?: string }).name === "AbortError" || (err as { name?: string }).name === "TimeoutError")
    return new DomainError("PROVIDER_ERROR", "The AI provider timed out.", 504);
  if (status === 429) return new DomainError("PROVIDER_ERROR", "The AI provider is rate limiting requests. Try again shortly.", 503);
  if (status === 401 || status === 403) return new DomainError("PROVIDER_ERROR", "The Gemini API key was rejected.");
  if (status === 404) return new DomainError("PROVIDER_ERROR", "The configured Gemini model was not found. Check GEMINI_MODEL.");
  if (typeof status === "number" && status >= 500) return new DomainError("PROVIDER_ERROR", "The Gemini service is temporarily unavailable.", 503);
  if (err instanceof DomainError) return err;
  return new DomainError("PROVIDER_ERROR", "The AI provider failed to respond.");
}
