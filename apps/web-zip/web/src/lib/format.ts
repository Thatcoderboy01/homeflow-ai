export function formatDue(iso: string | null): string {
  if (!iso) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatQuantity(qty: number, unit: string | null): string {
  return unit ? `${qty} ${unit}` : String(qty);
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : "Something went wrong.");
