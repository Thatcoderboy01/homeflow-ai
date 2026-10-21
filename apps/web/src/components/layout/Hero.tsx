import { NAV_ITEMS } from "./Sidebar";

type Props = {
  /** Real counts used on the quick-jump chips; omitted until loaded. */
  counts: Record<string, string | undefined>;
  active: string;
  onNavigate: (id: string) => void;
};

export function Hero({ counts, active, onNavigate }: Props) {
  return (
    <section aria-labelledby="intro-heading" className="mx-auto mt-8 max-w-3xl text-center sm:mt-10">
      <span className="inline-flex items-center rounded-full bg-teal-50 px-3.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-100">
        Approval-first workspace
      </span>
      <h2 id="intro-heading" className="mt-4 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
        Your family&apos;s action agent
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
        HomeFlow AI turns a request into a proposed plan of household tasks and grocery updates. Nothing changes until you approve it.
      </p>
      <nav aria-label="Jump to section" className="mt-6 hidden flex-wrap justify-center gap-2.5 md:flex">
        {NAV_ITEMS.filter((n) => n.id !== "top").map((n) => {
          const current = active === n.id;
          return (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={() => onNavigate(n.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium shadow-card transition-colors ${current ? "bg-teal-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {n.label}
              {counts[n.id] && <span className={`ml-2 text-xs ${current ? "text-teal-100" : "text-slate-400"}`}>{counts[n.id]}</span>}
            </a>
          );
        })}
      </nav>
    </section>
  );
}
