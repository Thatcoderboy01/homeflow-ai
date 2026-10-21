import { z } from "zod";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export const GROCERY_STATUSES = ["NEEDED", "PURCHASED"] as const;
export const SHOPPING_PROVIDERS = ["blinkit", "zepto", "swiggy_instamart", "ondc", "manual"] as const;
export type ShoppingProvider = (typeof SHOPPING_PROVIDERS)[number];

export const LIMITS = {
  title: 200,
  description: 2000,
  groceryName: 120,
  unit: 30,
  notes: 255,
  maxQuantity: 999,
  maxActionsPerPlan: 25,
  maxMessageLength: 2000,
  maxCartItems: 50,
  maxBudgetInr: 1_000_000,
} as const;

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/** Input for creating a task (shared by the MCP tool, the plan and the actions). */
export const createTaskFields = {
  title: trimmed(LIMITS.title),
  description: z.string().trim().max(LIMITS.description).optional(),
  dueDate: z.iso.datetime({ offset: true }).optional(),
  status: z.enum(TASK_STATUSES).default("TODO"),
};
export const createTaskInputSchema = z.object(createTaskFields);
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

/** Input for adding/updating a grocery item (upsert by normalised name). */
export const updateGroceryFields = {
  name: trimmed(LIMITS.groceryName),
  quantity: z.number().int().min(1).max(LIMITS.maxQuantity).optional(),
  unit: z.string().trim().min(1).max(LIMITS.unit).optional(),
  notes: z.string().trim().max(LIMITS.notes).optional(),
  status: z.enum(GROCERY_STATUSES).optional(),
};
export const updateGroceryInputSchema = z.object(updateGroceryFields);
export type UpdateGroceryInput = z.infer<typeof updateGroceryInputSchema>;

export const shoppingCartItemSchema = z.object({
  name: trimmed(LIMITS.groceryName),
  quantity: z.number().int().min(1).max(LIMITS.maxQuantity),
  unit: z.string().trim().min(1).max(LIMITS.unit).optional(),
  productUrl: z.string().url().max(2000).optional(),
});
export type ShoppingCartItem = z.infer<typeof shoppingCartItemSchema>;

export const prepareShoppingCartFields = {
  provider: z.enum(SHOPPING_PROVIDERS).default("manual"),
  items: z.array(shoppingCartItemSchema).min(1).max(LIMITS.maxCartItems),
  location: z.string().trim().max(120).optional(),
  budgetInr: z.number().int().min(1).max(LIMITS.maxBudgetInr).optional(),
};
export const prepareShoppingCartSchema = z.object(prepareShoppingCartFields);
export type PrepareShoppingCartInput = z.infer<typeof prepareShoppingCartSchema>;

/** A proposed, not-yet-executed action. Only these types can ever be approved. */
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_task"), ...createTaskFields }),
  z.object({ type: z.literal("update_grocery_list"), ...updateGroceryFields }),
  z.object({ type: z.literal("prepare_shopping_cart"), ...prepareShoppingCartFields }),
]);
export type ProposedAction = z.infer<typeof actionSchema>;

export const planSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  actions: z.array(actionSchema).min(1).max(LIMITS.maxActionsPerPlan),
});
export type Plan = z.infer<typeof planSchema>;

export const planRequestSchema = z.object({
  message: z.string().trim().min(1).max(LIMITS.maxMessageLength),
  conversationId: z.string().min(1).max(64).optional(),
});
export type PlanRequest = z.infer<typeof planRequestSchema>;

export const MCP_TOOL_NAMES = {
  getHouseholdContext: "get_household_context",
  createTask: "create_task",
  updateGroceryList: "update_grocery_list",
  prepareShoppingCart: "prepare_shopping_cart",
} as const;

/** Lower-case, trim and collapse whitespace so "  Whole  Milk " equals "whole milk". */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Deterministic JSON (sorted keys, undefined removed) used for hashing and comparisons. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, val]) => val !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, val]) => [k, sort(val)]),
      );
    }
    return v;
  };
  return JSON.stringify(sort(value));
}
