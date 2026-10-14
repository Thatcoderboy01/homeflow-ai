import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DomainError, type DomainErrorCode } from "@homeflow/shared";

export interface McpToolClientOptions {
  url: string;
  authToken: string;
  timeoutMs?: number;
}

export interface ToolCaller {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  ping(): Promise<boolean>;
}

/**
 * Thin MCP client (Streamable HTTP). Opens a short-lived session per call: simple and
 * stateless, which is fine at hackathon scale. Reuse sessions if latency matters.
 */
export class McpToolClient implements ToolCaller {
  constructor(private readonly opts: McpToolClientOptions) {}

  private async withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
    const client = new Client({ name: "homeflow-api", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(this.opts.url), {
      requestInit: { headers: { Authorization: `Bearer ${this.opts.authToken}` } },
    });
    try {
      await client.connect(transport);
      return await fn(client);
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    let result;
    try {
      result = await this.withClient((c) => c.callTool({ name, arguments: args }, undefined, { timeout: this.opts.timeoutMs ?? 15_000 }));
    } catch (err) {
      if (err instanceof DomainError) throw err;
      throw new DomainError("UPSTREAM_ERROR", "The MCP tool server is unreachable or failed.");
    }
    const structured = result.structuredContent as { error?: { code?: string; message?: string } } | undefined;
    if (result.isError) {
      const e = structured?.error;
      throw new DomainError((e?.code as DomainErrorCode) ?? "UPSTREAM_ERROR", e?.message ?? "Tool call failed.");
    }
    if (structured) return structured;
    const text = (result.content as { type: string; text?: string }[] | undefined)?.find((b) => b.type === "text")?.text;
    try {
      return text ? JSON.parse(text) : undefined;
    } catch {
      return text;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.withClient((c) => c.listTools(undefined, { timeout: 3000 }));
      return true;
    } catch {
      return false;
    }
  }
}
