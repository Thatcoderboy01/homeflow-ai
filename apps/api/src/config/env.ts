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
  AI_PROVIDER: z.enum(["mock", "bedrock"]).default("mock"),
  AWS_REGION: z.string().optional(),
  BEDROCK_MODEL_ID: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
});
export type ApiConfig = z.infer<typeof schema> & { corsOrigins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const cfg = schema.parse({ ...env, AWS_REGION: env.AWS_REGION || undefined, BEDROCK_MODEL_ID: env.BEDROCK_MODEL_ID || undefined });
  if (cfg.AI_PROVIDER === "bedrock" && !cfg.BEDROCK_MODEL_ID) {
    throw new Error("AI_PROVIDER=bedrock requires BEDROCK_MODEL_ID (and Bedrock model access in your AWS account).");
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
