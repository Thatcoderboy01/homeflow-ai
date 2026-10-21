import { GeminiProvider } from "./gemini.js";
import { MockProvider } from "./mock.js";
import type { LlmProvider } from "./types.js";

export * from "./types.js";
export { MockProvider, nextWeekday } from "./mock.js";
export { GeminiProvider, mapGeminiError } from "./gemini.js";
export {
  ElevenLabsSpeechSynthesizer,
  FallbackSpeechSynthesizer,
  GeminiSpeechSynthesizer,
  mapElevenLabsError,
  mapSpeechError,
} from "./speech.js";
export type {
  ElevenLabsSpeechSynthesizerOptions,
  FallbackSpeechSynthesizerOptions,
  GeminiSpeechSynthesizerOptions,
  SpeechSynthesizer,
} from "./speech.js";

export interface ProviderConfig {
  provider: "mock" | "gemini";
  geminiApiKey?: string;
  geminiModel?: string;
  timeoutMs?: number;
}

/** Never falls back silently: a misconfigured real provider throws at startup or per request. */
export function createProvider(cfg: ProviderConfig): LlmProvider {
  if (cfg.provider === "mock") return new MockProvider();
  return new GeminiProvider({ apiKey: cfg.geminiApiKey ?? "", model: cfg.geminiModel, timeoutMs: cfg.timeoutMs });
}
