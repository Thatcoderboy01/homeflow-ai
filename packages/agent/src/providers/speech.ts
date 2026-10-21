import { GoogleGenAI, Modality } from "@google/genai";
import { DomainError } from "@homeflow/shared";

const DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const VOICE_PERSONA =
  "Speak in a warm, friendly, natural conversational voice. Sound relaxed, attentive, and confident. Use natural sentence rhythm, subtle intonation, appropriate pauses, and clear pronunciation. Avoid robotic, monotonous, exaggerated, or announcer-like delivery.";

export interface SpeechSynthesizer {
  synthesize(text: string, signal?: AbortSignal): Promise<{ audio: Buffer; mimeType: string }>;
}

export interface GeminiSpeechSynthesizerOptions {
  apiKey: string;
  model?: string;
  voiceName?: string;
  timeoutMs?: number;
  client?: Pick<GoogleGenAI, "models">;
}

export class GeminiSpeechSynthesizer implements SpeechSynthesizer {
  private readonly client: Pick<GoogleGenAI, "models">;

  constructor(private readonly options: GeminiSpeechSynthesizerOptions) {
    if (!options.apiKey) throw new Error("GEMINI_API_KEY is required for Gemini speech synthesis.");
    this.client = options.client ?? new GoogleGenAI({ apiKey: options.apiKey });
  }

  async synthesize(text: string, signal?: AbortSignal): Promise<{ audio: Buffer; mimeType: string }> {
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 30_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await Promise.race([
        this.client.models.generateContent({
          model: this.options.model ?? DEFAULT_TTS_MODEL,
          contents: `${VOICE_PERSONA}\n\nSpeak this response naturally:\n${text}`,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: this.options.voiceName ?? "Kore" },
              },
            },
          },
        }),
        abortOnSignal(requestSignal),
      ]);
      const audioPart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
      const encoded = audioPart?.inlineData?.data;
      if (!encoded) throw new DomainError("PROVIDER_ERROR", "The speech provider returned no audio.", 502);
      const mimeType = audioPart.inlineData?.mimeType ?? "audio/L16;rate=24000";
      return { audio: pcmToWav(Buffer.from(encoded, "base64"), mimeType), mimeType: "audio/wav" };
    } catch (error) {
      throw mapSpeechError(error);
    }
  }
}

export function mapSpeechError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  const status = (error as { status?: number; code?: number }).status ?? (error as { code?: number }).code;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 429 || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
    return new DomainError("VOICE_QUOTA_EXCEEDED", "Natural voice is temporarily unavailable because the Gemini speech quota is exhausted. Enable billing or wait for the quota to reset.", 503);
  }
  if (status === 401 || status === 403) return new DomainError("VOICE_AUTH_ERROR", "Natural voice is not authorized for the configured Gemini project.", 503);
  if (status === 404) return new DomainError("VOICE_MODEL_NOT_FOUND", "The configured Gemini speech model is unavailable. Check GEMINI_TTS_MODEL.", 503);
  if ((error as { name?: string }).name === "AbortError" || (error as { name?: string }).name === "TimeoutError") {
    return new DomainError("VOICE_TIMEOUT", "Natural voice generation timed out. Try again.", 504);
  }
  return new DomainError("VOICE_PROVIDER_ERROR", "Natural voice generation failed. Check the API server logs for provider details.", 503);
}

function pcmToWav(pcm: Buffer, mimeType: string): Buffer {
  const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1] ?? 24_000);
  const channels = Number(/channels=(\d+)/i.exec(mimeType)?.[1] ?? 1);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function abortOnSignal(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason ?? new Error("Speech request aborted."));
    else signal.addEventListener("abort", () => reject(signal.reason ?? new Error("Speech request aborted.")), { once: true });
  });
}
