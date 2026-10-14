import type { GroceryItemDto } from "@homeflow/shared";
import { ShoppingBasket } from "lucide-react";
import { formatQuantity } from "../../lib/format";
import { EmptyState, ErrorBanner, LoadingState, Panel } from "../layout/Panel";

export function GroceryList({
  items,
  loading,
  error,
  onRetry,
}: {
  items?: GroceryItemDto[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <Panel
      title="Shared grocery list"
      icon={<ShoppingBasket className="size-4" />}
      action={items && <span className="text-xs text-slate-500">{items.filter((i) => i.status === "NEEDED").length} needed</span>}
    >
      {error ? (
        <ErrorBanner message={error} onRetry={onRetry} />
      ) : loading && !items ? (
        <LoadingState label="Loading groceries…" />
      ) : !items?.length ? (
        <EmptyState>Your grocery list is empty.</EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((g) => (
            <li key={g.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
              <span className={`text-sm ${g.status === "PURCHASED" ? "text-slate-400 line-through" : "font-medium"}`}>{g.name}</span>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
                {formatQuantity(g.quantity, g.unit)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
