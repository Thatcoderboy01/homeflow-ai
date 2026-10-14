import { z } from "zod";
import { createTaskFields, updateGroceryFields } from "@homeflow/shared";

const householdId = z.string().min(1).max(64).describe("Household identifier (injected by the backend, not chosen by the model).");
const approvalMeta = {
  approvalId: z.string().min(1).max(64).describe("Id of an APPROVED action approval authorising this exact call."),
  actionIndex: z.number().int().min(0).max(99).describe("Index of the approved action inside the approval."),
};

/** Raw Zod shapes (used by registerTool, and re-exported so tests can validate inputs). */
export const getHouseholdContextShape = {
  householdId,
  taskLimit: z.number().int().min(1).max(50).default(20),
  groceryLimit: z.number().int().min(1).max(100).default(50),
};
export const createTaskShape = { householdId, ...approvalMeta, ...createTaskFields };
export const updateGroceryListShape = { householdId, ...approvalMeta, ...updateGroceryFields };

export const getHouseholdContextInput = z.object(getHouseholdContextShape);
export const createTaskInput = z.object(createTaskShape);
export const updateGroceryListInput = z.object(updateGroceryListShape);
