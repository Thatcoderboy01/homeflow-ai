import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z.string().default("http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174"),
  LOG_LEVEL: z.string().default("info"),
  APPROVAL_TTL_SECONDS: z.coerce.number().int().min(30).max(86_400).default(900),
  MCP_URL: z.string().url().default("http://127.0.0.1:4100/mcp"),
  MCP_AUTH_TOKEN: z.string().min(16, "MCP_AUTH_TOKEN must be at least 16 characters"),
  AI_PROVIDER: z.literal("gemini").default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
});
export type ApiConfig = z.infer<typeof schema> & { corsOrigins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const cfg = schema.parse({ ...env, GEMINI_API_KEY: env.GEMINI_API_KEY || undefined });
  if (cfg.AI_PROVIDER === "gemini" && !cfg.GEMINI_API_KEY) {
    throw new Error("AI_PROVIDER=gemini requires GEMINI_API_KEY.");
  }
  if (cfg.NODE_ENV === "production" && cfg.MCP_AUTH_TOKEN.startsWith("change-me")) {
    throw new Error("Refusing to start in production with the placeholder MCP_AUTH_TOKEN");
  }
  return {
    ...cfg,
    corsOrigins: cfg.CORS_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
