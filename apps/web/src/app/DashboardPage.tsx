import { useCallback } from "react";
import { ChatPanel } from "../components/chat/ChatPanel";
import { GroceryList } from "../components/groceries/GroceryList";
import { Header } from "../components/layout/Header";
import { TaskList } from "../components/tasks/TaskList";
import { useAssistant } from "../features/useAssistant";
import { useAsyncData } from "../hooks/usePolling";
import { api } from "../services/api";

export function DashboardPage() {
  const health = useAsyncData(api.health, 10_000);
  const tasks = useAsyncData(api.tasks);
  const groceries = useAsyncData(api.groceries);

  const reload = tasks.refresh;
  const reloadG = groceries.refresh;
  const onDataChanged = useCallback(() => {
    void reload();
    void reloadG();
  }, [reload, reloadG]);
  const assistant = useAssistant(onDataChanged);

  return (
    <div className="min-h-screen">
      <Header health={health.data} healthError={health.error} loading={health.loading} />
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
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
        <div className="space-y-5 lg:col-span-3">
          <TaskList tasks={tasks.data} loading={tasks.loading} error={tasks.error} onRetry={tasks.refresh} />
          <GroceryList items={groceries.data} loading={groceries.loading} error={groceries.error} onRetry={groceries.refresh} />
        </div>
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-500 sm:px-6">
        Approval-first workspace. This local build uses seeded data and has no user authentication; do not expose it publicly.
      </footer>
    </div>
  );
}
