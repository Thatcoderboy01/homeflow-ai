import { DomainError, type HouseholdContextDto } from "@homeflow/shared";
import { getPrisma } from "../client.js";
import { toGroceryDto, toTaskDto } from "./mappers.js";

export async function getDefaultHouseholdId(): Promise<string> {
  const h = await getPrisma().household.findFirst({ where: { isDemo: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!h) throw new DomainError("NOT_FOUND", "No household found. Run `npm run db:seed`.");
  return h.id;
}

export async function getHouseholdContext(
  householdId: string,
  opts: { taskLimit?: number; groceryLimit?: number } = {},
): Promise<HouseholdContextDto> {
  const db = getPrisma();
  const household = await db.household.findUnique({ where: { id: householdId }, include: { members: { orderBy: { createdAt: "asc" } } } });
  if (!household) throw new DomainError("NOT_FOUND", "Household not found.");
  const [tasks, groceries] = await Promise.all([
    db.task.findMany({
      where: { householdId, status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: opts.taskLimit ?? 20,
    }),
    db.groceryItem.findMany({ where: { householdId, status: "NEEDED" }, orderBy: { name: "asc" }, take: opts.groceryLimit ?? 50 }),
  ]);
  return {
    household: {
      id: household.id,
      name: household.name,
      timezone: household.timezone,
      preferences: household.preferences,
      isDemo: household.isDemo,
    },
    members: household.members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    upcomingTasks: tasks.map(toTaskDto),
    groceryItems: groceries.map(toGroceryDto),
  };
}
