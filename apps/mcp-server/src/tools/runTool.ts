import { DomainError } from "@homeflow/shared";
import type { Logger } from "pino";

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
};

/** Wraps a tool handler: structured result, safe errors, and operational logging (no PII/content). */
export async function runTool(
  logger: Logger,
  tool: string,
  meta: Record<string, unknown>,
  fn: () => Promise<Record<string, unknown>>,
): Promise<ToolResult> {
  const started = Date.now();
  try {
    const data = await fn();
    logger.info({ tool, ...meta, ok: true, ms: Date.now() - started }, "tool call");
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  } catch (err) {
    const known = err instanceof DomainError;
    const error = known ? { code: err.code, message: err.message } : { code: "INTERNAL_ERROR", message: "Tool failed unexpectedly." };
    logger.warn(
      { tool, ...meta, ok: false, code: error.code, ms: Date.now() - started, ...(known ? {} : { err: String(err) }) },
      "tool call failed",
    );
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ error }) }], structuredContent: { error } };
  }
}
