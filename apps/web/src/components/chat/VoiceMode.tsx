import { PhoneOff, X } from "lucide-react";
import type { ApprovalDto } from "@homeflow/shared";
import type { ChatEntry } from "../../types/ui";
import { VOICE_GREETING, type VoiceStatus } from "../../features/useVoiceSession";
import { PlanPreview } from "./PlanPreview";
import { VoiceOrb } from "./VoiceOrb";

const labels: Record<VoiceStatus, string> = {
  idle: "Ready",
  requesting: "Requesting microphone permission…",
  listening: "Listening",
  processing: "Processing your request…",
  speaking: "Speaking",
  muted: "Microphone muted",
  error: "Voice error",
  ended: "Conversation ended",
};

type Props = {
  status: VoiceStatus;
  interim: string;
  greetingReady: boolean;
  error?: string;
  entries: ChatEntry[];
  approval?: ApprovalDto;
  busy: "idle" | "planning" | "approving" | "rejecting";
  onApprove: () => void;
  onReject: () => void;
  onEnd: () => void;
  onClose: () => void;
};

export function VoiceMode({ status, interim, greetingReady, error, entries, approval, busy, onApprove, onReject, onEnd, onClose }: Props) {
  const latest = [...entries].reverse().find((entry) => entry.role === "assistant");
  return (
    <div
      className="fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-[#030817] text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-title"
    >
      <div
        className="relative flex h-full min-h-0 w-full flex-col items-center px-5 pt-6 sm:px-10 sm:pt-8"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-5 rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white sm:right-8 sm:top-7" aria-label="Return to text chat">
          <X className="size-5" />
        </button>
        <div className="shrink-0 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-300">HomeFlow voice</p>
          <h2 id="voice-title" className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Talk through your household</h2>
          <p className="mt-2 text-sm text-slate-400">{labels[status]}</p>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center py-5 sm:py-8">
          <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative aspect-square w-[min(84vw,38rem)]">
            <VoiceOrb status={status} />
          </div>
        </div>
        <div className="min-h-16 w-full max-w-xl shrink-0 text-center text-sm text-slate-300">
          {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-rose-200">{error}</p> : interim ? <p className="italic text-slate-400">{interim}</p> : latest ? <p className="line-clamp-3">{latest.text}</p> : greetingReady ? <p className="line-clamp-3">{VOICE_GREETING}</p> : <p>Preparing voice input…</p>}
        </div>
        {approval && (
          <div className="mt-4 w-full max-w-2xl min-w-0 text-left">
            <PlanPreview approval={approval} busy={busy} onApprove={onApprove} onReject={onReject} variant="voice" />
          </div>
        )}
        <div className="mt-5 shrink-0">
          <button type="button" onClick={onEnd} className="grid size-16 place-items-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400" aria-label="End voice conversation">
            <PhoneOff className="size-6" />
          </button>
        </div>
        <p className="mt-4 shrink-0 text-center text-xs text-slate-500">Your voice is processed by your browser and sent as text to the existing HomeFlow assistant.</p>
      </div>
    </div>
  );
}
