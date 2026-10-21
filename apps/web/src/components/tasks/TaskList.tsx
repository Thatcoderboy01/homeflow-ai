import type { TaskDto } from "@homeflow/shared";
import { CalendarClock, CheckCircle2, Circle, CircleDot, ClipboardList } from "lucide-react";
import { formatDue } from "../../lib/format";
import { CountPill, EmptyState, ErrorBanner, LoadingState, Panel } from "../layout/Panel";

const STATUS = {
  TODO: { label: "To do", icon: Circle, cls: "text-slate-400", pill: "bg-slate-100 text-slate-600", bar: "bg-slate-300", dot: "bg-slate-400" },
  IN_PROGRESS: { label: "In progress", icon: CircleDot, cls: "text-amber-500", pill: "bg-amber-50 text-amber-700", bar: "bg-amber-400", dot: "bg-amber-400" },
  DONE: { label: "Done", icon: CheckCircle2, cls: "text-teal-600", pill: "bg-emerald-50 text-emerald-700", bar: "bg-teal-500", dot: "bg-teal-500" },
  CANCELLED: { label: "Cancelled", icon: Circle, cls: "text-slate-300", pill: "bg-slate-100 text-slate-400", bar: "bg-slate-200", dot: "bg-slate-300" },
} as const;

/** Overdue is derived from real data only: an open task whose due date has passed. */
function isOverdue(t: TaskDto): boolean {
  return !!t.dueDate && (t.status === "TODO" || t.status === "IN_PROGRESS") && new Date(t.dueDate).getTime() < Date.now();
}

function Summary({ tasks }: { tasks: TaskDto[] }) {
  const count = (s: TaskDto["status"]) => tasks.filter((t) => t.status === s).length;
  const todo = count("TODO");
  const progress = count("IN_PROGRESS");
  const done = count("DONE");
  const cancelled = count("CANCELLED");
  const tracked = todo + progress + done;
  const pct = tracked ? Math.round((done / tracked) * 100) : 0;
  const segments = [
    { key: "DONE" as const, n: done },
    { key: "IN_PROGRESS" as const, n: progress },
    { key: "TODO" as const, n: todo },
  ].filter((s) => s.n > 0);
  const items = [
    { key: "TODO" as const, n: todo },
    { key: "IN_PROGRESS" as const, n: progress },
    { key: "DONE" as const, n: done },
    ...(cancelled ? [{ key: "CANCELLED" as const, n: cancelled }] : []),
  ];

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight text-navy-900">{pct}%</span>
        <span className="text-sm text-slate-500">of tasks completed</span>
      </div>
      <div
        className="mt-3 flex h-1.5 gap-1 overflow-hidden rounded-full"
        role="img"
        aria-label={`${done} done, ${progress} in progress, ${todo} to do`}
      >
        {segments.length ? (
          segments.map((s) => <span key={s.key} className={`${STATUS[s.key].bar} rounded-full`} style={{ flexGrow: s.n }} />)
        ) : (
          <span className="flex-1 rounded-full bg-slate-100" />
        )}
      </div>
      <dl className={`mt-4 grid divide-x divide-slate-200/70 rounded-2xl bg-slate-50 py-3 ${items.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {items.map((s) => (
          <div key={s.key} className="flex flex-col items-center gap-0.5 px-2">
            <dt className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`size-2 rounded-full ${STATUS[s.key].dot}`} aria-hidden />
              {STATUS[s.key].label}
            </dt>
            <dd className="text-lg font-semibold text-navy-900">{s.n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function TaskList({ tasks, loading, error, onRetry }: { tasks?: TaskDto[]; loading: boolean; error?: string; onRetry: () => void }) {
  return (
    <Panel
      id="tasks"
      title="Household tasks"
      description="Everything on the family's plate"
      icon={<ClipboardList className="size-5" />}
      action={tasks && <CountPill>{tasks.length} total</CountPill>}
      className="h-full"
    >
      {error ? (
        <ErrorBanner message={error} onRetry={onRetry} />
      ) : loading && !tasks ? (
        <LoadingState label="Loading tasks…" />
      ) : !tasks?.length ? (
        <EmptyState>No tasks yet. Ask the assistant to plan something.</EmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5">
          <Summary tasks={tasks} />
          <ul className="scroll-soft -mr-2 max-h-[22rem] min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto pr-2" aria-label="Task list">
            {tasks.map((t) => {
              const s = STATUS[t.status];
              const overdue = isOverdue(t);
              return (
                <li key={t.id} className="flex items-start gap-3 py-3">
                  <s.icon className={`mt-0.5 size-[18px] shrink-0 ${s.cls}`} aria-label={s.label} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <p className={`text-sm font-medium ${t.status === "DONE" || t.status === "CANCELLED" ? "text-slate-400 line-through" : "text-navy-900"}`}>{t.title}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.pill}`}>{s.label}</span>
                    </div>
                    {t.description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t.description}</p>}
                    <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${overdue ? "font-medium text-red-600" : "text-slate-500"}`}>
                      <CalendarClock className="size-3.5" aria-hidden />
                      {formatDue(t.dueDate)}
                      {overdue && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">Overdue</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}
