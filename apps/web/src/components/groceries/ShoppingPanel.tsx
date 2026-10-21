import { ExternalLink, Info, ShoppingCart } from "lucide-react";
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
    <Panel
      id="shopping"
      title="Shopping workspace"
      description="A proposed cart to review before you shop"
      icon={<ShoppingCart className="size-5" />}
      className="h-full"
    >
      {error ? (
        <ErrorBanner message={error} onRetry={onRetry} />
      ) : loading && !capabilities ? (
        <LoadingState label="Loading shopping capabilities…" />
      ) : (
        <div className="grid flex-1 content-start gap-5">
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Prices, fees, stock and order status may be unavailable. Nothing here means an order has been placed.
          </p>
          <div className="grid gap-5 xl:grid-cols-5">
            <div className="xl:col-span-3">
              {cart ? (
                <div className="h-full rounded-2xl border border-teal-200 bg-gradient-to-b from-teal-50/70 to-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-navy-900">Proposed cart</h3>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {cart.status === "HANDED_OFF" ? "Handed off; complete and verify checkout yourself." : "No prices or stock are claimed until you verify them."}
                      </p>
                    </div>
                    {cart.status === "PREPARED" && (
                      <button
                        onClick={() => void handoff()}
                        disabled={handoffBusy}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ExternalLink className="size-3.5" aria-hidden /> {handoffBusy ? "Opening…" : "Open checkout"}
                      </button>
                    )}
                  </div>
                  <ul className="mt-4 divide-y divide-teal-100/80 text-sm">
                    {cart.items.map((item) => (
                      <li key={`${item.name}-${item.unit ?? ""}`} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0 break-words font-medium text-navy-900">{item.name}</span>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          {formatQuantity(item.quantity, item.unit ?? null)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {handoffError && (
                    <p role="alert" className="mt-3 text-xs text-red-700">
                      {handoffError}
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState>No proposed cart yet. Ask the assistant to prepare one from your grocery list.</EmptyState>
              )}
            </div>
            <div className="xl:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider capabilities</h3>
              <ul className="mt-3 grid gap-3">
                {capabilities?.map((provider) => (
                  <li key={provider.provider} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-navy-900">{provider.displayName}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{provider.limitation}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
