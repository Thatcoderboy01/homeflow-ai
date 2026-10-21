import type {
  ApiErrorBody,
  ApprovalDto,
  DecisionResponseDto,
  GroceryItemDto,
  HealthDto,
  PlanResponseDto,
  ShoppingCapabilityDto,
  ShoppingCartDto,
  TaskDto,
} from "@homeflow/shared";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Cannot reach the HomeFlow API. Is it running?", 0);
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const e = (data as ApiErrorBody | undefined)?.error;
    throw new ApiError(e?.code ?? "HTTP_ERROR", e?.message ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  health: () => request<HealthDto>("/health"),
  tasks: () => request<{ tasks: TaskDto[] }>("/tasks").then((r) => r.tasks),
  groceries: () => request<{ items: GroceryItemDto[] }>("/groceries").then((r) => r.items),
  shoppingCapabilities: () => request<{ providers: ShoppingCapabilityDto[] }>("/shopping/capabilities").then((r) => r.providers),
  shoppingCart: () => request<{ cart: ShoppingCartDto | null }>("/shopping/cart").then((r) => r.cart),
  shoppingHandoff: (id: string) =>
    request<{ cart: ShoppingCartDto; handoffUrl: string }>(`/shopping/cart/${id}/handoff`, { method: "POST" }),
  plan: (message: string, conversationId?: string) =>
    request<PlanResponseDto>("/agent/plan", { method: "POST", body: JSON.stringify({ message, conversationId }) }),
  approval: (id: string) => request<{ approval: ApprovalDto }>(`/approvals/${id}`).then((r) => r.approval),
  approve: (id: string) => request<DecisionResponseDto>(`/approvals/${id}/approve`, { method: "POST" }),
  reject: (id: string) => request<DecisionResponseDto>(`/approvals/${id}/reject`, { method: "POST" }),
  speech: async (text: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/voice/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => undefined)) as ApiErrorBody | undefined;
      const e = data?.error;
      throw new ApiError(e?.code ?? "VOICE_ERROR", e?.message ?? `Voice output failed (${res.status})`, res.status);
    }
    return res.blob();
  },
};
