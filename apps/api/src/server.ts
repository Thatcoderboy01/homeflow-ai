import { pino } from "pino";
import {
  createProvider,
  ElevenLabsSpeechSynthesizer,
  FallbackSpeechSynthesizer,
  GeminiSpeechSynthesizer,
  McpToolClient,
} from "@homeflow/agent";
import { disconnectPrisma } from "@homeflow/database";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const logger = pino({ level: config.LOG_LEVEL, redact: ["req.headers.authorization", "*.token"] });

const provider = createProvider({
  provider: config.AI_PROVIDER,
  geminiApiKey: config.GEMINI_API_KEY,
  geminiModel: config.GEMINI_MODEL,
  timeoutMs: config.AI_TIMEOUT_MS,
});
const geminiSpeech =
  config.AI_PROVIDER === "gemini"
    ? new GeminiSpeechSynthesizer({
        apiKey: config.GEMINI_API_KEY ?? "",
        model: config.GEMINI_TTS_MODEL,
        voiceName: config.GEMINI_TTS_VOICE,
        timeoutMs: config.AI_TIMEOUT_MS,
      })
    : undefined;
const speech =
  geminiSpeech && config.ELEVENLABS_API_KEY && config.ELEVENLABS_VOICE_ID
    ? new FallbackSpeechSynthesizer({
        primary: geminiSpeech,
        secondary: new ElevenLabsSpeechSynthesizer({
          apiKey: config.ELEVENLABS_API_KEY,
          voiceId: config.ELEVENLABS_VOICE_ID,
          model: config.ELEVENLABS_TTS_MODEL,
          timeoutMs: config.AI_TIMEOUT_MS,
        }),
        onFallback: ({ from, to, code }) => logger.warn({ from, to, code }, "speech provider fallback"),
      })
    : geminiSpeech;
const mcp = new McpToolClient({ url: config.MCP_URL, authToken: config.MCP_AUTH_TOKEN });
const app = createApp({ config, logger, provider, speech, mcp });

const server = app.listen(config.API_PORT, config.API_HOST, () => {
  logger.info(
    { host: config.API_HOST, port: config.API_PORT, ai: provider.name, mock: provider.isMock },
    "HomeFlow API listening (local demo build)",
  );
});
const shutdown = () => server.close(() => void disconnectPrisma().finally(() => process.exit(0)));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
