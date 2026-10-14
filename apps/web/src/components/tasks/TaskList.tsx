import type { TaskDto } from "@homeflow/shared";
import { CalendarClock, CheckCircle2, Circle, CircleDot, ClipboardList } from "lucide-react";
import { formatDue } from "../../lib/format";
import { EmptyState, ErrorBanner, LoadingState, Panel } from "../layout/Panel";

const STATUS = {
  TODO: { label: "To do", icon: Circle, cls: "text-slate-400" },
  IN_PROGRESS: { label: "In progress", icon: CircleDot, cls: "text-amber-500" },
  DONE: { label: "Done", icon: CheckCircle2, cls: "text-teal-600" },
  CANCELLED: { label: "Cancelled", icon: Circle, cls: "text-slate-300" },
} as const;

export function TaskList({ tasks, loading, error, onRetry }: { tasks?: TaskDto[]; loading: boolean; error?: string; onRetry: () => void }) {
  return (
    <Panel
      title="Household tasks"
      icon={<ClipboardList className="size-4" />}
      action={tasks && <span className="text-xs text-slate-500">{tasks.length} total</span>}
    >
      {error ? (
        <ErrorBanner message={error} onRetry={onRetry} />
      ) : loading && !tasks ? (
        <LoadingState label="Loading tasks…" />
      ) : !tasks?.length ? (
        <EmptyState>No tasks yet. Ask the assistant to plan something.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((t) => {
            const s = STATUS[t.status];
            return (
              <li key={t.id} className="flex items-start gap-3 py-2.5">
                <s.icon className={`mt-0.5 size-4 shrink-0 ${s.cls}`} aria-label={s.label} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${t.status === "DONE" ? "text-slate-400 line-through" : ""}`}>{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>}
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <CalendarClock className="size-3" aria-hidden />
                    {formatDue(t.dueDate)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
