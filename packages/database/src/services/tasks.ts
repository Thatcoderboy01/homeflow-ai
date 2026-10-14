import type { CreateTaskInput, TaskDto } from "@homeflow/shared";
import { getPrisma } from "../client.js";
import { toTaskDto } from "./mappers.js";

export async function listTasks(householdId: string, opts: { status?: TaskDto["status"]; limit?: number } = {}): Promise<TaskDto[]> {
  const rows = await getPrisma().task.findMany({
    where: { householdId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: Math.min(opts.limit ?? 100, 200),
  });
  return rows.map(toTaskDto);
}

/**
 * Creates a task. When `origin` is given, (approvalId, actionIndex) is unique, so retrying the
 * same approved action returns the existing task instead of creating a duplicate.
 */
export async function createTask(
  householdId: string,
  input: CreateTaskInput,
  origin?: { approvalId: string; actionIndex: number },
): Promise<{ task: TaskDto; created: boolean }> {
  const db = getPrisma();
  if (origin) {
    const existing = await db.task.findUnique({ where: { approvalId_actionIndex: origin } });
    if (existing) return { task: toTaskDto(existing), created: false };
  }
  try {
    const row = await db.task.create({
      data: {
        householdId,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: input.status,
        ...(origin ?? {}),
      },
    });
    return { task: toTaskDto(row), created: true };
  } catch (err) {
    // Concurrent retry lost the unique-key race: return the winner.
    if (origin && (err as { code?: string }).code === "P2002") {
      const existing = await db.task.findUnique({ where: { approvalId_actionIndex: origin } });
      if (existing) return { task: toTaskDto(existing), created: false };
    }
    throw err;
  }
}
