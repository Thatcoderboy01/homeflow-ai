import type { ApiErrorBody, ApprovalDto, DecisionResponseDto, GroceryItemDto, HealthDto, PlanResponseDto, TaskDto } from "@homeflow/shared";

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
  plan: (message: string, conversationId?: string) =>
    request<PlanResponseDto>("/agent/plan", { method: "POST", body: JSON.stringify({ message, conversationId }) }),
  approval: (id: string) => request<{ approval: ApprovalDto }>(`/approvals/${id}`).then((r) => r.approval),
  approve: (id: string) => request<DecisionResponseDto>(`/approvals/${id}/approve`, { method: "POST" }),
  reject: (id: string) => request<DecisionResponseDto>(`/approvals/${id}/reject`, { method: "POST" }),
};
