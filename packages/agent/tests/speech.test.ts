import { describe, expect, it, vi } from "vitest";
import {
  ElevenLabsSpeechSynthesizer,
  FallbackSpeechSynthesizer,
  GeminiSpeechSynthesizer,
} from "../src/providers/speech.js";

const audio = Buffer.from("audio");

describe("speech provider fallback", () => {
  it("uses Gemini audio without calling ElevenLabs", async () => {
    const primary = { synthesize: vi.fn(async () => ({ audio, mimeType: "audio/wav" })) };
    const secondary = { synthesize: vi.fn() };
    const speech = new FallbackSpeechSynthesizer({ primary, secondary });

    await expect(speech.synthesize("hello")).resolves.toEqual({ audio, mimeType: "audio/wav" });
    expect(primary.synthesize).toHaveBeenCalledOnce();
    expect(secondary.synthesize).not.toHaveBeenCalled();
  });

  it("falls back after a Gemini quota error", async () => {
    const primary = { synthesize: vi.fn(async () => { throw new Error("RESOURCE_EXHAUSTED quota"); }) };
    const secondary = { synthesize: vi.fn(async () => ({ audio, mimeType: "audio/mpeg" })) };
    const speech = new FallbackSpeechSynthesizer({ primary, secondary });

    await expect(speech.synthesize("hello")).resolves.toEqual({ audio, mimeType: "audio/mpeg" });
    expect(secondary.synthesize).toHaveBeenCalledOnce();
  });

  it("does not retry Gemini quota failures", async () => {
    const generateContent = vi.fn(async () => {
      throw Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 });
    });
    const speech = new GeminiSpeechSynthesizer({
      apiKey: "test",
      client: { models: { generateContent } } as never,
    });

    await expect(speech.synthesize("hello")).rejects.toMatchObject({ code: "VOICE_QUOTA_EXCEEDED" });
    expect(generateContent).toHaveBeenCalledOnce();
  });

  it("retries one transient Gemini failure before returning audio", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("upstream unavailable"), { status: 503 }))
      .mockResolvedValueOnce({
        candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from("pcm").toString("base64"), mimeType: "audio/L16;rate=24000" } }] } }],
      });
    const speech = new GeminiSpeechSynthesizer({
      apiKey: "test",
      client: { models: { generateContent } } as never,
    });

    await expect(speech.synthesize("hello")).resolves.toMatchObject({ mimeType: "audio/wav" });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});

describe("ElevenLabs speech provider", () => {
  it("sends the text and returns provider audio", async () => {
    const fetchImpl = vi.fn(async () => new Response(audio, { status: 200, headers: { "content-type": "audio/mpeg" } }));
    const speech = new ElevenLabsSpeechSynthesizer({
      apiKey: "secret",
      voiceId: "voice-id",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(speech.synthesize("hello")).resolves.toEqual({ audio, mimeType: "audio/mpeg" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/text-to-speech/voice-id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "xi-api-key": "secret" }),
      }),
    );
  });

  it.each([401, 429, 503])("maps ElevenLabs HTTP %s to a safe error", async (status) => {
    const fetchImpl = vi.fn(async () => new Response(null, { status }));
    const speech = new ElevenLabsSpeechSynthesizer({ apiKey: "secret", voiceId: "voice-id", fetchImpl: fetchImpl as typeof fetch });

    await expect(speech.synthesize("hello")).rejects.toMatchObject({
      code: status === 429 ? "VOICE_QUOTA_EXCEEDED" : status === 401 ? "VOICE_AUTH_ERROR" : "VOICE_PROVIDER_ERROR",
    });
  });

  it("falls back to the browser path when both cloud providers fail", async () => {
    const primary = { synthesize: vi.fn(async () => { throw new Error("quota"); }) };
    const secondary = { synthesize: vi.fn(async () => { throw new Error("credits exhausted"); }) };
    const speech = new FallbackSpeechSynthesizer({ primary, secondary });

    await expect(speech.synthesize("hello")).rejects.toMatchObject({ code: "VOICE_PROVIDER_ERROR" });
  });

  it("rejects a successful but non-audio ElevenLabs response", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "unexpected" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const speech = new ElevenLabsSpeechSynthesizer({ apiKey: "secret", voiceId: "voice-id", fetchImpl: fetchImpl as typeof fetch });

    await expect(speech.synthesize("hello")).rejects.toMatchObject({ code: "VOICE_PROVIDER_ERROR" });
  });
});
