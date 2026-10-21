import { ExternalLink, ShoppingCart } from "lucide-react";
import type { ShoppingCapabilityDto, ShoppingCartDto } from "@homeflow/shared";
import { EmptyState, ErrorBanner, LoadingState, Panel } from "../layout/Panel";
import { formatQuantity } from "../../lib/format";
import { useState } from "react";
import { api } from "../../services/api";

export function ShoppingPanel({
  capabilities,
  cart,
  loading,
  error,
  onRetry,
  onChanged,
}: {
  capabilities?: ShoppingCapabilityDto[];
  cart?: ShoppingCartDto | null;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onChanged: () => void;
}) {
  const [handoffError, setHandoffError] = useState<string>();
  const [handoffBusy, setHandoffBusy] = useState(false);

  const handoff = async () => {
    if (!cart) return;
    setHandoffError(undefined);
    setHandoffBusy(true);
    try {
      const result = await api.shoppingHandoff(cart.id);
      window.open(result.handoffUrl, "_blank", "noopener,noreferrer");
      onChanged();
    } catch (e) {
      setHandoffError(e instanceof Error ? e.message : "Could not open checkout handoff.");
    } finally {
      setHandoffBusy(false);
    }
  };

  return (
    <Panel title="Shopping workspace" icon={<ShoppingCart className="size-4" />}>
      {error ? (
        <ErrorBanner message={error} onRetry={onRetry} />
      ) : loading && !capabilities ? (
        <LoadingState label="Loading shopping capabilities…" />
      ) : (
        <div className="grid gap-4">
          {cart ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Proposed cart</h3>
                  <p className="text-xs text-slate-600">
                    {cart.status === "HANDED_OFF" ? "Handed off; complete and verify checkout yourself." : "No prices or stock are claimed until you verify them."}
                  </p>
                </div>
                {cart.status === "PREPARED" && (
                  <button
                    onClick={() => void handoff()}
                    disabled={handoffBusy}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    <ExternalLink className="size-3.5" /> {handoffBusy ? "Opening…" : "Open checkout"}
                  </button>
                )}
              </div>
              <ul className="mt-3 grid gap-1 text-sm">
                {cart.items.map((item) => (
                  <li key={`${item.name}-${item.unit ?? ""}`} className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="text-slate-500">{formatQuantity(item.quantity, item.unit ?? null)}</span>
                  </li>
                ))}
              </ul>
              {handoffError && <p className="mt-2 text-xs text-red-700">{handoffError}</p>}
            </div>
          ) : (
            <EmptyState>No proposed cart yet. Ask the assistant to prepare one from your grocery list.</EmptyState>
          )}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider capabilities</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {capabilities?.map((provider) => (
                <li key={provider.provider} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-sm font-medium">{provider.displayName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{provider.limitation}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Panel>
  );
}
