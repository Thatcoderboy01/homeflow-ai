import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, ClipboardList, Loader2, MessageSquare, Mic, Send, ShoppingBasket, Sparkles, Users, type LucideIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ApprovalDto } from "@homeflow/shared";
import type { ChatEntry } from "../../types/ui";
import { useVoiceSession } from "../../features/useVoiceSession";
import { ErrorBanner, Panel } from "../layout/Panel";
import { PlanPreview } from "./PlanPreview";
import { VoiceMode } from "./VoiceMode";

const EXAMPLE = "Guests are coming on Sunday. Help me prepare.";

const SUGGESTIONS: { text: string; icon: LucideIcon; tint: string }[] = [
  { text: EXAMPLE, icon: Users, tint: "bg-pink-50 text-pink-500" },
  { text: "Organize my household tasks.", icon: ClipboardList, tint: "bg-blue-50 text-blue-600" },
  { text: "Help me plan my groceries.", icon: ShoppingBasket, tint: "bg-teal-50 text-teal-600" },
  { text: "What can you help me with?", icon: Sparkles, tint: "bg-amber-50 text-amber-600" },
];

interface Props {
  entries: ChatEntry[];
  approval?: ApprovalDto;
  busy: "idle" | "planning" | "approving" | "rejecting";
  error?: string;
  disabled?: boolean;
  onSend: (m: string) => void;
  onVoiceSend: (m: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

export function ChatPanel({ entries, approval, busy, error, disabled, onSend, onVoiceSend, onApprove, onReject }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceSession({ entries, disabled, onSend: onVoiceSend });
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [entries.length, approval?.status, busy]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = text.trim();
    if (!m || busy !== "idle") return;
    onSend(m);
    setText("");
  };

  return (
    <Panel
      id="assistant"
      title="Assistant"
      description="Describe what your household needs. HomeFlow drafts a plan for you to approve."
      icon={<MessageSquare className="size-5" />}
      className="h-full"
    >
      <div className="flex flex-1 flex-col gap-4">
        <div
          className="scroll-soft max-h-[32rem] min-h-[14rem] flex-1 space-y-4 overflow-y-auto pr-1"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          {entries.length === 0 && (
            <div className="rounded-2xl bg-slate-50/80 p-4 sm:p-5">
              <p className="text-sm font-medium text-slate-700">Try asking</p>
              <p className="mt-0.5 text-xs text-slate-500">Nothing changes until you approve a proposed plan.</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map(({ text: suggestion, icon: Icon, tint }) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => {
                        setText(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="flex h-full w-full items-start gap-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 text-left shadow-card transition hover:-translate-y-px hover:border-teal-200"
                    >
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tint}`} aria-hidden>
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="pt-1.5 text-sm font-medium leading-snug text-navy-900">{suggestion}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entries.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex items-start gap-2.5"}>
              {m.role === "assistant" && (
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600" aria-hidden>
                  <Bot className="size-4" />
                </span>
              )}
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "rounded-br-md bg-navy-900 text-white" : m.role === "system" ? "bg-slate-100 text-slate-700" : "rounded-tl-md bg-slate-50 text-navy-900 ring-1 ring-slate-200/80"}`}
              >
                {m.role === "assistant" && m.provider && (
                  <p className="mb-1 text-[11px] font-medium text-slate-500">
                    {m.provider.isMock ? "Test provider" : `AI via ${m.provider.name}`}
                  </p>
                )}
                {m.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node: _node, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer" className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-900" />
                      ),
                      code: ({ node: _node, className, children, ...props }) => {
                        const inline = !className;
                        return inline ? (
                          <code {...props} className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[0.9em]">
                            {children}
                          </code>
                        ) : (
                          <code {...props} className="block overflow-x-auto rounded-lg bg-navy-950 p-3 font-mono text-xs text-slate-100">
                            {children}
                          </code>
                        );
                      },
                      pre: ({ node: _node, children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
                      p: ({ node: _node, children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ node: _node, children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
                      ol: ({ node: _node, children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
                      li: ({ node: _node, children }) => <li>{children}</li>,
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                ) : (
                  m.text
                )}
              </div>
            </div>
          ))}
          {busy === "planning" && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Reading household context and drafting a plan…
            </p>
          )}
          {approval && <PlanPreview approval={approval} busy={busy} onApprove={onApprove} onReject={onReject} />}
          <div ref={endRef} />
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-500/25">
          <label htmlFor="msg" className="sr-only">
            Message the assistant
          </label>
          <textarea
            id="msg"
            ref={inputRef}
            rows={2}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            placeholder="e.g. Guests are coming on Sunday. Help me prepare."
            className="flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={voice.start}
              disabled={busy !== "idle" || disabled}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Start voice conversation"
              title="Start voice conversation"
            >
              <Mic className="size-4" aria-hidden />
            </button>
            <button
              type="submit"
              disabled={!text.trim() || busy !== "idle" || disabled}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-4" aria-hidden /> Send
            </button>
          </div>
        </form>
        <p className="-mt-2 px-1 text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line</p>
      </div>
      {voice.open && (
        <VoiceMode
          status={voice.status}
          interim={voice.interim}
          greetingReady={voice.greetingReady}
          error={voice.error ?? error}
          entries={entries}
          approval={approval}
          busy={busy}
          onApprove={onApprove}
          onReject={onReject}
          onEnd={voice.end}
          onClose={voice.end}
        />
      )}
    </Panel>
  );
}
