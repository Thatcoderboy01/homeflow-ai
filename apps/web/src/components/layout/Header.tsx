import type { HealthDto } from "@homeflow/shared";
import { Home } from "lucide-react";

type Props = { health?: HealthDto; healthError?: string; loading: boolean };

function Dot({ ok, label }: { ok: boolean | undefined; label: string }) {
  const color = ok === undefined ? "bg-slate-400" : ok ? "bg-teal-400" : "bg-red-400";
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-200">
      <span className={`size-2 rounded-full ${color}`} aria-hidden />
      {label}
      <span className="sr-only">{ok === undefined ? "unknown" : ok ? "up" : "down"}</span>
    </span>
  );
}

export function Header({ health, healthError, loading }: Props) {
  const apiUp = health ? true : healthError ? false : undefined;
  return (
    <header className="bg-navy-900 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-teal-500 text-navy-950">
            <Home className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">HomeFlow AI</h1>
            <p className="text-xs text-slate-300">Your Family's Action Agent</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-live="polite" aria-label="System status">
          <span className="rounded-full border border-amber-300/50 bg-amber-300/10 px-2.5 py-0.5 text-xs font-medium text-amber-200">
            Local demo build
          </span>
          {health && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${health.ai.isMock ? "bg-amber-300 text-navy-950" : "bg-teal-400 text-navy-950"}`}
            >
              {health.ai.isMock ? "Mock AI (demo)" : `AI: ${health.ai.provider}`}
            </span>
          )}
          <Dot ok={loading ? undefined : apiUp} label="API" />
          <Dot ok={health ? health.checks.database === "up" : undefined} label="Database" />
          <Dot ok={health ? health.checks.mcp === "up" : undefined} label="MCP tools" />
        </div>
      </div>
    </header>
  );
}
