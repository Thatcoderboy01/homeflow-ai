import { BedrockRuntimeClient, ConverseCommand, type ContentBlock as BedrockBlock, type Message } from "@aws-sdk/client-bedrock-runtime";
import { DomainError } from "@homeflow/shared";
import type { ContentBlock, GenerateRequest, GenerateResponse, LlmProvider } from "./types.js";

export interface BedrockProviderOptions {
  modelId: string;
  region?: string;
  timeoutMs?: number;
  maxTokens?: number;
  /** Injectable for tests. Credentials come from the standard AWS provider chain. */
  client?: Pick<BedrockRuntimeClient, "send">;
}

/** Amazon Bedrock via the Converse API (tool use). Requires model access in your AWS account/region. */
export class BedrockProvider implements LlmProvider {
  readonly name = "bedrock";
  readonly isMock = false;
  private readonly client: Pick<BedrockRuntimeClient, "send">;
  constructor(private readonly opts: BedrockProviderOptions) {
    if (!opts.modelId) throw new Error("BEDROCK_MODEL_ID is required when AI_PROVIDER=bedrock");
    this.client = opts.client ?? new BedrockRuntimeClient({ region: opts.region });
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const timeout = AbortSignal.timeout(this.opts.timeoutMs ?? 30_000);
    const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
    try {
      const out = await this.client.send(
        new ConverseCommand({
          modelId: this.opts.modelId,
          system: [{ text: req.system }],
          messages: req.messages.map(toBedrockMessage),
          inferenceConfig: { maxTokens: this.opts.maxTokens ?? 2048, temperature: 0.2 },
          toolConfig: {
            tools: req.tools.map((t) => ({
              toolSpec: { name: t.name, description: t.description, inputSchema: { json: t.inputSchema as never } },
            })),
          },
        }),
        { abortSignal: signal },
      );
      const blocks = out.output?.message?.content ?? [];
      const content: ContentBlock[] = [];
      for (const b of blocks) {
        if (b.text) content.push({ type: "text", text: b.text });
        else if (b.toolUse?.name)
          content.push({ type: "tool_use", id: b.toolUse.toolUseId ?? crypto.randomUUID(), name: b.toolUse.name, input: b.toolUse.input });
      }
      const stop = out.stopReason;
      return {
        content,
        stopReason: stop === "tool_use" ? "tool_use" : stop === "end_turn" ? "end_turn" : stop === "max_tokens" ? "max_tokens" : "other",
      };
    } catch (err) {
      throw mapBedrockError(err);
    }
  }
}

function toBedrockMessage(m: GenerateRequest["messages"][number]): Message {
  const content = m.content.map((b): BedrockBlock => {
    if (b.type === "text") return { text: b.text };
    if (b.type === "tool_use") return { toolUse: { toolUseId: b.id, name: b.name, input: b.input as never } };
    return { toolResult: { toolUseId: b.toolUseId, content: [{ text: b.content }], status: b.isError ? "error" : "success" } };
  });
  return { role: m.role, content };
}

export function mapBedrockError(err: unknown): DomainError {
  const name = (err as { name?: string }).name ?? "";
  if (name === "AbortError" || name === "TimeoutError") return new DomainError("PROVIDER_ERROR", "The AI provider timed out.", 504);
  if (name === "ThrottlingException")
    return new DomainError("PROVIDER_ERROR", "The AI provider is rate limiting requests. Try again shortly.", 503);
  if (name === "AccessDeniedException")
    return new DomainError("PROVIDER_ERROR", "Access to the Bedrock model was denied. Check model access and IAM permissions.");
  if (name === "ValidationException" || name === "ResourceNotFoundException")
    return new DomainError(
      "PROVIDER_ERROR",
      "Bedrock rejected the request. Check BEDROCK_MODEL_ID, region, and that the model supports tool use.",
    );
  return new DomainError("PROVIDER_ERROR", "The AI provider failed to respond.");
}
