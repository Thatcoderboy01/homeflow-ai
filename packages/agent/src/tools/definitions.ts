import { z } from "zod";
import { MCP_TOOL_NAMES, planSchema } from "@homeflow/shared";
import type { ToolSpec } from "../providers/types.js";

export const PROPOSE_PLAN_TOOL = "propose_plan";

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  return rest;
}

/**
 * Tools exposed to the LLM. Note what is NOT here: create_task and update_grocery_list.
 * The model can only read context and *propose* a plan; execution happens after human approval.
 */
export const LLM_TOOLS: ToolSpec[] = [
  {
    name: MCP_TOOL_NAMES.getHouseholdContext,
    description: "Read the household's preferences, members, open tasks and grocery items. Call this before planning.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: PROPOSE_PLAN_TOOL,
    description:
      "Submit the final plan for the user to review. Nothing is executed until the user approves. Call exactly once, after reading context.",
    inputSchema: jsonSchema(planSchema),
  },
];
