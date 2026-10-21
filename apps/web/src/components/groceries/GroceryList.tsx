import type { GroceryItemDto } from "@homeflow/shared";
import { Check, ShoppingBasket } from "lucide-react";
import { formatQuantity } from "../../lib/format";
import { CountPill, EmptyState, ErrorBanner, LoadingState, Panel } from "../layout/Panel";

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
      id="groceries"
      title="Shared grocery list"
      description="What the household still needs"
      icon={<ShoppingBasket className="size-5" />}
      action={items && <CountPill tone="teal">{items.filter((i) => i.status === "NEEDED").length} needed</CountPill>}
      className="h-full"
    >
      {error ? (
        <ErrorBanner message={error} onRetry={onRetry} />
      ) : loading && !items ? (
        <LoadingState label="Loading groceries…" />
      ) : !items?.length ? (
        <EmptyState>Your grocery list is empty.</EmptyState>
      ) : (
        <ul className="scroll-soft grid max-h-[22rem] content-start gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {items.map((g) => {
            const purchased = g.status === "PURCHASED";
            return (
              <li key={g.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <span className={`flex min-w-0 items-center gap-2 text-sm ${purchased ? "text-slate-400 line-through" : "font-medium text-navy-900"}`}>
                  {purchased && <Check className="size-3.5 shrink-0 text-teal-600" aria-label="Purchased" />}
                  <span className="min-w-0 break-words">{g.name}</span>
                </span>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-100">
                  {formatQuantity(g.quantity, g.unit)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
