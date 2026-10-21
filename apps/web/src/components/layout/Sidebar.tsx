import { ClipboardList, Home, LayoutDashboard, MessageSquare, ShoppingBasket, ShoppingCart, type LucideIcon } from "lucide-react";

export type NavItem = { id: string; label: string; icon: LucideIcon };

/** One entry per real section on the dashboard. These are in-page anchors, not separate routes. */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "top", label: "Overview", icon: LayoutDashboard },
  { id: "assistant", label: "Assistant", icon: MessageSquare },
  { id: "tasks", label: "Household tasks", icon: ClipboardList },
  { id: "groceries", label: "Grocery list", icon: ShoppingBasket },
  { id: "shopping", label: "Shopping workspace", icon: ShoppingCart },
];

type Props = {
  active: string;
  onNavigate: (id: string) => void;
  /** Truthful API reachability: undefined while still checking. */
  apiUp: boolean | undefined;
};

function LogoMark() {
  return (
    <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-teal-300 ring-1 ring-white/15">
      <Home className="size-5" aria-hidden />
    </span>
  );
}

export function Sidebar({ active, onNavigate, apiUp }: Props) {
  const apiLabel = apiUp === undefined ? "Checking API" : apiUp ? "API reachable" : "API unreachable";
  const apiColor = apiUp === undefined ? "bg-slate-400" : apiUp ? "bg-teal-400" : "bg-red-400";

  return (
    <>
      {/* Desktop / tablet: persistent dark rail. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[5.5rem] flex-col items-center bg-navy-950 py-6 lg:flex">
        <a href="#top" onClick={() => onNavigate("top")} aria-label="HomeFlow AI, back to overview" className="rounded-2xl">
          <LogoMark />
        </a>
        <nav aria-label="Dashboard sections" className="mt-10 flex flex-1 flex-col items-center gap-3">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const current = active === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => onNavigate(id)}
                aria-label={label}
                aria-current={current ? "location" : undefined}
                className={`group relative grid size-12 place-items-center rounded-2xl transition-colors ${current ? "bg-teal-500 text-navy-950 shadow-lg shadow-teal-500/25" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon className="size-5" aria-hidden />
                <span
                  role="presentation"
                  className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-navy-800 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  {label}
                </span>
              </a>
            );
          })}
        </nav>
        <div
          title={apiLabel}
          role="img"
          aria-label={apiLabel}
          className="grid size-12 place-items-center rounded-2xl bg-white/5"
        >
          <span className={`size-2.5 rounded-full ${apiColor}`} />
        </div>
      </aside>

      {/* Mobile: compact bottom tab bar with the same anchors. */}
      <nav
        aria-label="Dashboard sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy-950/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const current = active === id;
            const short = id === "top" ? "Home" : id === "tasks" ? "Tasks" : id === "groceries" ? "Groceries" : id === "shopping" ? "Shop" : "Assistant";
            return (
              <li key={id} className="flex-1">
                <a
                  href={`#${id}`}
                  onClick={() => onNavigate(id)}
                  aria-label={label}
                  aria-current={current ? "location" : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors ${current ? "bg-teal-500 text-navy-950" : "text-slate-400 hover:text-white"}`}
                >
                  <Icon className="size-5" aria-hidden />
                  {short}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
