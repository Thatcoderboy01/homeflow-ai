import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MCP_HOST: z.string().default("127.0.0.1"),
  MCP_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  MCP_AUTH_TOKEN: z.string().min(16, "MCP_AUTH_TOKEN must be at least 16 characters"),
  LOG_LEVEL: z.string().default("info"),
  /** Browser origins allowed to call /mcp (usually none: the API is the only client). */
  MCP_ALLOWED_ORIGINS: z.string().default(""),
});
export type McpConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const cfg = schema.parse(env);
  if (cfg.NODE_ENV === "production" && cfg.MCP_AUTH_TOKEN.startsWith("change-me")) {
    throw new Error("Refusing to start in production with the placeholder MCP_AUTH_TOKEN");
  }
  return cfg;
}
