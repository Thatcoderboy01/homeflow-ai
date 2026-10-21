import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

type PanelProps = {
  title: string;
  icon: ReactNode;
  /** Short supporting line shown under the title. */
  description?: string;
  action?: ReactNode;
  /** Anchor id used by the sidebar section navigation. */
  id?: string;
  className?: string;
  children: ReactNode;
};

export function Panel({ title, icon, description, action, id, className = "", children }: PanelProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`flex scroll-mt-6 flex-col rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card sm:p-6 ${className}`}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-600" aria-hidden>
            {icon}
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-semibold leading-tight tracking-tight text-navy-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="mt-5 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/** Small rounded pill used for counts and metadata in panel headers. */
export function CountPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "teal" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone === "teal" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
    >
      {children}
    </span>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">{children}</div>;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline underline-offset-2 hover:text-red-900">
          Retry
        </button>
      )}
    </div>
  );
}
