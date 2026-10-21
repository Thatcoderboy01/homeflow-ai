import { useCallback } from "react";
import { ChatPanel } from "../components/chat/ChatPanel";
import { GroceryList } from "../components/groceries/GroceryList";
import { ShoppingPanel } from "../components/groceries/ShoppingPanel";
import { Header } from "../components/layout/Header";
import { Hero } from "../components/layout/Hero";
import { NAV_ITEMS, Sidebar } from "../components/layout/Sidebar";
import { TaskList } from "../components/tasks/TaskList";
import { useAssistant } from "../features/useAssistant";
import { useActiveSection } from "../hooks/useActiveSection";
import { useAsyncData } from "../hooks/usePolling";
import { api } from "../services/api";

const SECTION_IDS = NAV_ITEMS.map((n) => n.id);

export function DashboardPage() {
  const health = useAsyncData(api.health, 10_000);
  const tasks = useAsyncData(api.tasks);
  const groceries = useAsyncData(api.groceries);
  const shopping = useAsyncData(async () => {
    const [capabilities, cart] = await Promise.all([api.shoppingCapabilities(), api.shoppingCart()]);
    return { capabilities, cart };
  });

  const reload = tasks.refresh;
  const reloadG = groceries.refresh;
  const onDataChanged = useCallback(() => {
    void reload();
    void reloadG();
    void shopping.refresh();
  }, [reload, reloadG, shopping.refresh]);
  const assistant = useAssistant(onDataChanged);
  const { active, choose } = useActiveSection(SECTION_IDS);

  const apiUp = health.data ? true : health.error ? false : undefined;
  const counts = {
    tasks: tasks.data ? String(tasks.data.length) : undefined,
    groceries: groceries.data ? `${groceries.data.filter((g) => g.status === "NEEDED").length} needed` : undefined,
  };

  return (
    <div id="top" className="min-h-screen bg-navy-950 lg:py-3 lg:pl-[5.5rem] lg:pr-3">
      <Sidebar active={active} onNavigate={choose} apiUp={apiUp} />
      <div className="min-h-screen bg-slate-50 pb-24 lg:min-h-[calc(100vh-1.5rem)] lg:rounded-[2rem] lg:pb-0">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
          <Header health={health.data} healthError={health.error} loading={health.loading} />
          <Hero counts={counts} active={active} onNavigate={choose} />
          <main className="mt-8 grid gap-5 sm:mt-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <ChatPanel
                entries={assistant.entries}
                approval={assistant.approval}
                busy={assistant.busy}
                error={assistant.error}
                disabled={!!health.error}
                onSend={(m) => void assistant.send(m)}
                onApprove={() => void assistant.approve()}
                onReject={() => void assistant.reject()}
              />
            </div>
            <div className="lg:col-span-5">
              <TaskList tasks={tasks.data} loading={tasks.loading} error={tasks.error} onRetry={tasks.refresh} />
            </div>
            <div className="lg:col-span-5">
              <GroceryList items={groceries.data} loading={groceries.loading} error={groceries.error} onRetry={groceries.refresh} />
            </div>
            <div className="lg:col-span-7">
              <ShoppingPanel
                capabilities={shopping.data?.capabilities}
                cart={shopping.data?.cart}
                loading={shopping.loading}
                error={shopping.error}
                onRetry={shopping.refresh}
                onChanged={() => void shopping.refresh()}
              />
            </div>
          </main>
          <footer className="mt-8 text-center text-xs text-slate-500">
            Approval-first workspace. This local build uses seeded data and has no user authentication; do not expose it publicly.
          </footer>
        </div>
      </div>
    </div>
  );
}
