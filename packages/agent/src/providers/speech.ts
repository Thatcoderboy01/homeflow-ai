import { GoogleGenAI, Modality } from "@google/genai";
import { DomainError } from "@homeflow/shared";

const DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2";
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

export interface ElevenLabsSpeechSynthesizerOptions {
  apiKey: string;
  voiceId: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface FallbackSpeechSynthesizerOptions {
  primary: SpeechSynthesizer;
  secondary?: SpeechSynthesizer;
  onFallback?: (details: { from: "gemini"; to: "elevenlabs"; code: string }) => void;
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
      const generate = () =>
        Promise.race([
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
      let response;
      try {
        response = await generate();
      } catch (error) {
        if (!isTransientProviderError(error)) throw error;
        await waitForRetry(requestSignal);
        response = await generate();
      }
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

export class ElevenLabsSpeechSynthesizer implements SpeechSynthesizer {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ElevenLabsSpeechSynthesizerOptions) {
    if (!options.apiKey) throw new Error("ELEVENLABS_API_KEY is required for ElevenLabs speech synthesis.");
    if (!options.voiceId) throw new Error("ELEVENLABS_VOICE_ID is required for ElevenLabs speech synthesis.");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async synthesize(text: string, signal?: AbortSignal): Promise<{ audio: Buffer; mimeType: string }> {
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 30_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await this.fetchImpl(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.options.voiceId)}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": this.options.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: this.options.model ?? DEFAULT_ELEVENLABS_MODEL,
          }),
          signal: requestSignal,
        },
      );
    } catch (error) {
      throw mapElevenLabsError(error);
    }
    if (!response.ok) throw mapElevenLabsError({ status: response.status });
    const contentType = response.headers.get("content-type");
    const mimeType = contentType?.split(";")[0]?.trim() ?? "";
    if (!mimeType.startsWith("audio/")) throw new DomainError("VOICE_PROVIDER_ERROR", "ElevenLabs returned an invalid audio response.", 503);
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw new DomainError("VOICE_PROVIDER_ERROR", "ElevenLabs returned no audio.", 503);
    return { audio, mimeType };
  }
}

export class FallbackSpeechSynthesizer implements SpeechSynthesizer {
  constructor(private readonly options: FallbackSpeechSynthesizerOptions) {}

  async synthesize(text: string, signal?: AbortSignal): Promise<{ audio: Buffer; mimeType: string }> {
    try {
      return await this.options.primary.synthesize(text, signal);
    } catch (error) {
      const mapped = error instanceof DomainError ? error : mapSpeechError(error);
      if (!this.options.secondary || !shouldUseSecondary(mapped)) throw mapped;
      if (signal?.aborted) throw mapped;
      this.options.onFallback?.({ from: "gemini", to: "elevenlabs", code: mapped.code });
      try {
        return await this.options.secondary.synthesize(text, signal);
      } catch {
        throw new DomainError(
          "VOICE_PROVIDER_ERROR",
          "Natural voice providers are unavailable. Using browser voice instead.",
          503,
        );
      }
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

export function mapElevenLabsError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  const status = (error as { status?: number }).status;
  const name = (error as { name?: string }).name;
  if (name === "AbortError" || name === "TimeoutError") {
    return new DomainError("VOICE_TIMEOUT", "ElevenLabs speech generation timed out.", 504);
  }
  if (status === 401 || status === 403) return new DomainError("VOICE_AUTH_ERROR", "ElevenLabs credentials were rejected.", 503);
  if (status === 429) return new DomainError("VOICE_QUOTA_EXCEEDED", "ElevenLabs speech quota is exhausted.", 503);
  if (status && status >= 500) return new DomainError("VOICE_PROVIDER_ERROR", "ElevenLabs speech service is unavailable.", 503);
  return new DomainError("VOICE_PROVIDER_ERROR", "ElevenLabs speech generation failed.", 503);
}

function shouldUseSecondary(error: DomainError): boolean {
  return error.code === "VOICE_QUOTA_EXCEEDED" || error.code === "VOICE_TIMEOUT" || error.code === "VOICE_PROVIDER_ERROR";
}

function isTransientProviderError(error: unknown): boolean {
  const status = (error as { status?: number; code?: number }).status ?? (error as { code?: number }).code;
  return status === 500 || status === 502 || status === 503 || status === 504;
}

function waitForRetry(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 100);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Speech request aborted."));
      },
      { once: true },
    );
  });
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
