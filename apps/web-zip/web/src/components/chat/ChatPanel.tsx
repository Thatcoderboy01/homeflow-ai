import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Loader2, MessageSquare, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ApprovalDto } from "@homeflow/shared";
import type { ChatEntry } from "../../types/ui";
import { EmptyState, ErrorBanner, Panel } from "../layout/Panel";
import { PlanPreview } from "./PlanPreview";

const EXAMPLE = "Guests are coming on Sunday. Help me prepare.";

interface Props {
  entries: ChatEntry[];
  approval?: ApprovalDto;
  busy: "idle" | "planning" | "approving" | "rejecting";
  error?: string;
  disabled?: boolean;
  onSend: (m: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

export function ChatPanel({ entries, approval, busy, error, disabled, onSend, onApprove, onReject }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
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
    <Panel title="Assistant" icon={<MessageSquare className="size-4" />}>
      <div className="flex min-h-[28rem] flex-col gap-3">
        <div className="flex-1 space-y-3 overflow-y-auto" role="log" aria-live="polite" aria-label="Conversation">
          {entries.length === 0 && (
            <EmptyState>
              Describe what your household needs. HomeFlow proposes a plan; nothing changes until you approve.
              <div className="mt-3 grid gap-2">
                {[EXAMPLE, "Organize my household tasks.", "Help me plan my groceries.", "What can you help me with?"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setText(suggestion)}
                    className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-medium text-white hover:bg-navy-800"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </EmptyState>
          )}
          {entries.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-navy-900 text-white" : m.role === "system" ? "bg-slate-100 text-slate-700" : "bg-teal-50 text-navy-900 ring-1 ring-teal-100"}`}
              >
                {m.role === "assistant" && m.provider && (
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Bot className="size-3" aria-hidden />
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
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="msg" className="sr-only">
            Message the assistant
          </label>
          <textarea
            id="msg"
            rows={2}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            placeholder="e.g. Guests are coming on Sunday. Help me prepare."
            className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!text.trim() || busy !== "idle" || disabled}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="size-4" aria-hidden /> Send
          </button>
        </form>
      </div>
    </Panel>
  );
}
