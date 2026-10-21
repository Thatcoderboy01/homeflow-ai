import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatEntry } from "../types/ui";
import { api } from "../services/api";

export type VoiceStatus = "idle" | "requesting" | "listening" | "processing" | "speaking" | "muted" | "error" | "ended";

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = Event & { resultIndex: number; results: { length: number; [index: number]: RecognitionResult } };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
};

type Props = {
  entries: ChatEntry[];
  disabled?: boolean;
  onSend: (message: string) => void;
};

const getRecognition = (): (new () => Recognition) | undefined => {
  const browser = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
};

const readableText = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_~`>#-]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

export const VOICE_GREETING =
  "Hey! I'm HomeFlow, your household assistant. You can ask me about your tasks, groceries, shopping list, or plans for your household. Tell me what you need, and I'll help you get it done.";

export function useVoiceSession({ entries, disabled, onSend }: Props) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string>();
  const [greetingReady, setGreetingReady] = useState(false);
  const recognitionRef = useRef<Recognition | undefined>(undefined);
  const activeRef = useRef(false);
  const mutedRef = useRef(false);
  const lastSpokenId = useRef<string | undefined>(undefined);
  const greetingStartedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined);
  const speechRequestRef = useRef(0);

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const stopPlayback = useCallback(() => {
    speechRequestRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = undefined;
    window.speechSynthesis?.cancel();
  }, []);

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !activeRef.current || mutedRef.current) return;
    try {
      setStatus("listening");
      recognition.start();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "InvalidStateError") return;
      setStatus("error");
      setError("Microphone could not be started. Check your browser permission and try again.");
    }
  }, []);

  const speakText = useCallback(
    async (text: string) => {
      if (!activeRef.current || mutedRef.current) return;
      const requestId = speechRequestRef.current + 1;
      speechRequestRef.current = requestId;
      stopRecognition();
      setStatus("speaking");
      try {
        const blob = await api.speech(text);
        if (!activeRef.current || mutedRef.current || requestId !== speechRequestRef.current) return;
        const audio = new Audio(URL.createObjectURL(blob));
        audioRef.current = audio;
        const finish = () => {
          URL.revokeObjectURL(audio.src);
          if (audioRef.current === audio) audioRef.current = undefined;
          if (activeRef.current && !mutedRef.current && requestId === speechRequestRef.current) startRecognition();
        };
        audio.onended = finish;
        audio.onerror = finish;
        await audio.play();
      } catch {
        if (!activeRef.current || mutedRef.current || requestId !== speechRequestRef.current) return;
        setError("Natural voice output is unavailable right now; using browser voice instead.");
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = navigator.language || "en-US";
        utterance.rate = 0.96;
        utterance.pitch = 1.02;
        utterance.onend = () => {
          if (activeRef.current && !mutedRef.current && requestId === speechRequestRef.current) startRecognition();
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    },
    [startRecognition, stopRecognition],
  );

  const end = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = undefined;
    stopPlayback();
    setInterim("");
    setOpen(false);
    setStatus("ended");
    setGreetingReady(false);
    setMuted(false);
    mutedRef.current = false;
    greetingStartedRef.current = false;
  }, [stopPlayback]);

  const start = useCallback(() => {
    if (disabled || activeRef.current) return;
    const Recognition = getRecognition();
    if (!Recognition) {
      setOpen(true);
      setStatus("error");
      setError("Voice input is not supported in this browser. Try the latest Chrome or Edge.");
      return;
    }
    activeRef.current = true;
    lastSpokenId.current = [...entries].reverse().find((entry) => entry.role !== "user")?.id ?? undefined;
    greetingStartedRef.current = false;
    setOpen(true);
    setError(undefined);
    setGreetingReady(false);
    setStatus("requesting");
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onstart = () => {
      if (greetingStartedRef.current || !activeRef.current) return;
      greetingStartedRef.current = true;
      setGreetingReady(true);
      void speakText(VOICE_GREETING);
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let partial = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        if (result.isFinal) finalText += result[0].transcript;
        else partial += result[0].transcript;
      }
      setInterim(partial);
      if (finalText.trim()) {
        setInterim("");
        setStatus("processing");
        onSend(finalText.trim());
      }
    };
    recognition.onerror = (event) => {
      if (!activeRef.current) return;
      if (event.error === "aborted" || event.error === "no-speech") {
        if (event.error === "no-speech" && activeRef.current && !mutedRef.current) {
          window.setTimeout(startRecognition, 0);
        }
        return;
      }
      setStatus("error");
      setError(event.error === "not-allowed" ? "Microphone permission was denied. Allow microphone access and try again." : "Voice input failed. Please try again.");
    };
    recognition.onend = () => {
      if (!greetingStartedRef.current && activeRef.current && !mutedRef.current) {
        setStatus("requesting");
        window.setTimeout(startRecognition, 0);
      }
    };
    recognitionRef.current = recognition;
    startRecognition();
  }, [disabled, entries, onSend, speakText, startRecognition, stopRecognition]);

  const toggleMute = useCallback(() => {
    if (!activeRef.current) return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      stopRecognition();
      stopPlayback();
      setStatus("muted");
    } else {
      startRecognition();
    }
  }, [startRecognition, stopPlayback, stopRecognition]);

  useEffect(() => {
    if (!open || !activeRef.current) return;
    const latest = [...entries].reverse().find((entry) => entry.role !== "user");
    if (!latest || latest.id === lastSpokenId.current) return;
    lastSpokenId.current = latest.id;
    const text = readableText(latest.text);
    if (!text || mutedRef.current) return;
    void speakText(text);
  }, [entries, open, speakText]);

  useEffect(() => () => {
    activeRef.current = false;
    recognitionRef.current?.abort();
    stopPlayback();
  }, [stopPlayback]);

  return { open, status, muted, interim, error, greetingReady, start, end, toggleMute };
}
