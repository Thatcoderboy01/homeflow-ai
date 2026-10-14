import { BedrockProvider } from "./bedrock.js";
import { MockProvider } from "./mock.js";
import type { LlmProvider } from "./types.js";

export * from "./types.js";
export { MockProvider, nextWeekday } from "./mock.js";
export { BedrockProvider, mapBedrockError } from "./bedrock.js";

export interface ProviderConfig {
  provider: "mock" | "bedrock";
  region?: string;
  bedrockModelId?: string;
  timeoutMs?: number;
}

/** Never falls back silently: a misconfigured real provider throws at startup or per request. */
export function createProvider(cfg: ProviderConfig): LlmProvider {
  if (cfg.provider === "mock") return new MockProvider();
  return new BedrockProvider({ modelId: cfg.bedrockModelId ?? "", region: cfg.region, timeoutMs: cfg.timeoutMs });
}
