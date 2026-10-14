import type { ActionResultDto, ApprovalDto, GroceryItemDto, ProposedAction, TaskDto } from "@homeflow/shared";
import type { ActionApproval, GroceryItem, Task } from "../generated/client.js";

export const toTaskDto = (t: Task): TaskDto => ({
  id: t.id,
  title: t.title,
  description: t.description,
  dueDate: t.dueDate?.toISOString() ?? null,
  status: t.status,
  createdAt: t.createdAt.toISOString(),
});

export const toGroceryDto = (g: GroceryItem): GroceryItemDto => ({
  id: g.id,
  name: g.name,
  quantity: g.quantity,
  unit: g.unit,
  notes: g.notes,
  status: g.status,
  updatedAt: g.updatedAt.toISOString(),
});

export const toApprovalDto = (a: ActionApproval): ApprovalDto => ({
  id: a.id,
  status: a.status,
  summary: a.summary,
  actions: a.actions as unknown as ProposedAction[],
  provider: a.provider,
  isMock: a.isMock,
  expiresAt: a.expiresAt.toISOString(),
  decidedAt: a.decidedAt?.toISOString() ?? null,
  executedAt: a.executedAt?.toISOString() ?? null,
  results: (a.result as unknown as ActionResultDto[] | null) ?? null,
});
