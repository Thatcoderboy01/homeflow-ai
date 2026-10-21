import type { PrepareShoppingCartInput, ShoppingCartItemDto, ShoppingCartDto, ShoppingProvider } from "@homeflow/shared";
import { getPrisma } from "../client.js";

const providerValues = new Set<ShoppingProvider>(["blinkit", "zepto", "swiggy_instamart", "ondc", "manual"]);

function itemDtos(value: unknown): ShoppingCartItemDto[] {
  if (!Array.isArray(value)) return [];
  return value as ShoppingCartItemDto[];
}

export function toShoppingCartDto(row: {
  id: string;
  provider: string;
  status: "PREPARED" | "HANDED_OFF" | "CANCELLED";
  location: string | null;
  budgetInr: number | null;
  subtotalInr: number | null;
  feesInr: number | null;
  feesKnown: boolean;
  items: unknown;
  handoffUrl: string | null;
  quoteObservedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ShoppingCartDto {
  const provider = providerValues.has(row.provider as ShoppingProvider) ? (row.provider as ShoppingProvider) : "manual";
  return {
    id: row.id,
    provider,
    status: row.status,
    location: row.location,
    budgetInr: row.budgetInr,
    subtotalInr: row.subtotalInr,
    feesInr: row.feesInr,
    totalInr: row.subtotalInr !== null && row.feesInr !== null ? row.subtotalInr + row.feesInr : null,
    feesKnown: row.feesKnown,
    items: itemDtos(row.items),
    handoffUrl: row.handoffUrl,
    quoteObservedAt: row.quoteObservedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function prepareShoppingCart(
  householdId: string,
  input: PrepareShoppingCartInput,
  approval?: { approvalId: string; actionIndex: number },
): Promise<{ cart: ShoppingCartDto; created: boolean }> {
  const db = getPrisma();
  const existing = approval
    ? await db.shoppingCart.findFirst({
        where: { householdId, approvalId: approval.approvalId, actionIndex: approval.actionIndex },
      })
    : null;
  if (existing) return { cart: toShoppingCartDto(existing), created: false };

  const row = await db.shoppingCart.create({
    data: {
      householdId,
      approvalId: approval?.approvalId,
      actionIndex: approval?.actionIndex,
      provider: input.provider,
      location: input.location ?? null,
      budgetInr: input.budgetInr ?? null,
      subtotalInr: null,
      feesInr: null,
      feesKnown: false,
      items: input.items.map((item) => ({ ...item, product: null })),
      handoffUrl: null,
    },
  });
  return { cart: toShoppingCartDto(row), created: true };
}

export async function getShoppingCart(householdId: string, id: string): Promise<ShoppingCartDto | null> {
  const row = await getPrisma().shoppingCart.findFirst({ where: { householdId, id } });
  return row ? toShoppingCartDto(row) : null;
}

export async function getLatestShoppingCart(householdId: string): Promise<ShoppingCartDto | null> {
  const row = await getPrisma().shoppingCart.findFirst({
    where: { householdId, status: { not: "CANCELLED" } },
    orderBy: { updatedAt: "desc" },
  });
  return row ? toShoppingCartDto(row) : null;
}

export async function markShoppingCartHandedOff(householdId: string, id: string, handoffUrl: string): Promise<ShoppingCartDto> {
  const row = await getPrisma().shoppingCart.updateMany({
    where: { householdId, id, status: "PREPARED" },
    data: { status: "HANDED_OFF", handoffUrl },
  });
  if (row.count !== 1) {
    const current = await getShoppingCart(householdId, id);
    if (!current) throw new Error("Shopping cart not found.");
    return current;
  }
  const updated = await getShoppingCart(householdId, id);
  if (!updated) throw new Error("Shopping cart not found after handoff.");
  return updated;
}
