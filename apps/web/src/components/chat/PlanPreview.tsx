import type { ApprovalDto } from "@homeflow/shared";
import { Check, ClipboardList, Loader2, ShoppingBasket, ShoppingCart, X } from "lucide-react";
import { formatDue, formatQuantity } from "../../lib/format";

const STATUS_COPY: Record<ApprovalDto["status"], string> = {
  PENDING: "Awaiting your approval",
  APPROVED: "Approved, executing…",
  REJECTED: "Rejected. Nothing was changed.",
  EXPIRED: "Expired. Ask for a new plan.",
  EXECUTED: "Executed and saved",
  FAILED: "Some actions failed",
};

export function PlanPreview({
  approval,
  busy,
  onApprove,
  onReject,
  variant = "default",
}: {
  approval: ApprovalDto;
  busy: "idle" | "planning" | "approving" | "rejecting";
  onApprove: () => void;
  onReject: () => void;
  variant?: "default" | "voice";
}) {
  const pending = approval.status === "PENDING";
  const voice = variant === "voice";
  return (
    <section
      aria-label="Proposed actions"
      className={
        voice
          ? "flex max-h-[min(38vh,26rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#0b1d35]/90 p-4 shadow-[0_0_32px_rgba(34,211,238,0.08)] backdrop-blur-md sm:max-h-[min(48vh,30rem)] sm:p-5"
          : "rounded-2xl border border-teal-200 bg-gradient-to-b from-teal-50/70 to-white p-4 shadow-card sm:p-5"
      }
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`text-sm font-semibold ${voice ? "text-white" : "text-navy-900"}`}>{voice ? "Review your actions" : "Proposed plan"}</h3>
          <p className={`mt-0.5 text-xs ${voice ? "text-slate-300" : "text-slate-600"}`}>{approval.summary}</p>
          <p className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${voice ? "text-cyan-200/70" : "text-slate-500"}`}>
            {approval.actions.length} {approval.actions.length === 1 ? "action" : "actions"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${voice ? "border border-cyan-300/20 bg-cyan-300/10 text-cyan-100" : approval.status === "EXECUTED" ? "bg-teal-600 text-white" : approval.status === "FAILED" || approval.status === "EXPIRED" ? "bg-red-100 text-red-800" : "bg-white text-navy-900 ring-1 ring-slate-200"}`}
        >
          {STATUS_COPY[approval.status]}
        </span>
      </div>

      <ul className={`approval-scroll mt-4 min-h-0 flex-1 space-y-2 pr-1 ${voice ? "overflow-y-auto" : "max-h-64 overflow-y-auto"}`}>
        {approval.actions.map((a, i) => {
          const result = approval.results?.find((r) => r.index === i);
          return (
            <li key={i} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${voice ? "border-white/10 bg-white/[0.06] text-white" : "border-slate-200/80 bg-white"}`}>
              {a.type === "create_task" ? (
                <ClipboardList className="mt-0.5 size-4 shrink-0 text-navy-700" aria-label="Task" />
              ) : a.type === "update_grocery_list" ? (
                <ShoppingBasket className="mt-0.5 size-4 shrink-0 text-teal-600" aria-label="Grocery item" />
              ) : (
                <ShoppingCart className="mt-0.5 size-4 shrink-0 text-teal-600" aria-label="Shopping cart" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${voice ? "text-white" : "text-navy-900"}`}>
                  {a.type === "create_task"
                    ? a.title
                    : a.type === "update_grocery_list"
                      ? a.name
                      : `Prepare ${a.items.length} items for ${a.provider}`}
                </p>
                <p className={`text-xs ${voice ? "text-slate-400" : "text-slate-500"}`}>
                  {a.type === "create_task"
                    ? formatDue(a.dueDate ?? null)
                    : a.type === "update_grocery_list"
                      ? formatQuantity(a.quantity ?? 1, a.unit ?? null)
                      : `${a.location ?? "Location to be confirmed"}${a.budgetInr ? ` · Budget ₹${a.budgetInr}` : ""}`}
                </p>
              </div>
              {result &&
                (result.ok ? (
                  <Check className="size-4 shrink-0 text-teal-600" aria-label="Completed" />
                ) : (
                  <span className="max-w-[45%] text-xs text-red-700" role="alert">
                    {result.message}
                  </span>
                ))}
            </li>
          );
        })}
      </ul>

      {pending && (
        <div className={`mt-4 flex shrink-0 flex-wrap gap-2 border-t pt-4 ${voice ? "border-white/10" : "border-transparent"}`}>
          <button
            onClick={onApprove}
            disabled={busy !== "idle"}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-400 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "approving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {busy === "approving"
              ? "Waiting for backend…"
              : `Approve ${approval.actions.length} ${approval.actions.length === 1 ? "action" : "actions"}`}
          </button>
          <button
            onClick={onReject}
            disabled={busy !== "idle"}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${voice ? "border border-white/15 bg-white/[0.06] text-slate-200 hover:bg-white/10" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            <X className="size-4" aria-hidden /> Reject
          </button>
        </div>
      )}
      {approval.isMock && (
        <p className={`mt-3 shrink-0 text-xs ${voice ? "text-amber-200" : "text-amber-700"}`}>Generated by the deterministic mock provider (demo mode), not a real AI model.</p>
      )}
    </section>
  );
}
