import { normalizeName, type GroceryItemDto, type UpdateGroceryInput } from "@homeflow/shared";
import { getPrisma } from "../client.js";
import { toGroceryDto } from "./mappers.js";

export async function listGroceries(householdId: string, opts: { limit?: number } = {}): Promise<GroceryItemDto[]> {
  const rows = await getPrisma().groceryItem.findMany({
    where: { householdId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: Math.min(opts.limit ?? 100, 200),
  });
  return rows.map(toGroceryDto);
}

/**
 * Adds a grocery item or updates the existing one with the same normalised name.
 * Values are SET (not incremented), so repeating the call is idempotent. A re-added
 * PURCHASED item goes back to NEEDED unless a status is given.
 */
export async function upsertGroceryItem(
  householdId: string,
  input: UpdateGroceryInput,
): Promise<{ item: GroceryItemDto; created: boolean }> {
  const db = getPrisma();
  const normalizedName = normalizeName(input.name);
  const where = { householdId_normalizedName: { householdId, normalizedName } };
  const existing = await db.groceryItem.findUnique({ where });
  const status = input.status ?? "NEEDED";
  const row = await db.groceryItem.upsert({
    where,
    create: {
      householdId,
      name: input.name.trim().replace(/\s+/g, " "),
      normalizedName,
      quantity: input.quantity ?? 1,
      unit: input.unit ?? null,
      notes: input.notes ?? null,
      status,
    },
    update: {
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      status,
    },
  });
  return { item: toGroceryDto(row), created: !existing };
}
