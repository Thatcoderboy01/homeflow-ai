import type { HealthDto } from "@homeflow/shared";

type Props = { health?: HealthDto; healthError?: string; loading: boolean };

function Dot({ ok, label }: { ok: boolean | undefined; label: string }) {
  const color = ok === undefined ? "bg-slate-300" : ok ? "bg-emerald-500" : "bg-red-500";
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <span className={`size-2 rounded-full ${color}`} aria-hidden />
      {label}
      <span className="sr-only">{ok === undefined ? "unknown" : ok ? "up" : "down"}</span>
    </span>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function Header({ health, healthError, loading }: Props) {
  const apiUp = health ? true : healthError ? false : undefined;
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{greeting()}!</h1>
        <p className="mt-1 text-sm text-slate-600">What does your household need today?</p>
      </div>
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-full border border-slate-200/70 bg-white px-4 py-2 shadow-card"
        aria-live="polite"
        aria-label="System status"
      >
        {health && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${health.ai.isMock ? "bg-amber-100 text-amber-800" : "bg-teal-50 text-teal-700"}`}
          >
            {health.ai.isMock ? "Test provider" : `AI: ${health.ai.provider}`}
          </span>
        )}
        <Dot ok={loading ? undefined : apiUp} label="API" />
        <Dot ok={health ? health.checks.database === "up" : undefined} label="Database" />
        <Dot ok={health ? health.checks.mcp === "up" : undefined} label="MCP tools" />
      </div>
    </header>
  );
}
