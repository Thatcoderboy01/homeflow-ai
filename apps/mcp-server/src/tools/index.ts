import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { actionSchema, MCP_TOOL_NAMES } from "@homeflow/shared";
import { assertActionApproved, createTask, getHouseholdContext, upsertGroceryItem } from "@homeflow/database";
import type { Logger } from "pino";
import { createTaskShape, getHouseholdContextShape, updateGroceryListShape } from "../schemas/tools.js";
import { runTool } from "./runTool.js";

export function registerTools(server: McpServer, logger: Logger): void {
  server.registerTool(
    MCP_TOOL_NAMES.getHouseholdContext,
    {
      title: "Get household context",
      description: "Read-only. Returns household preferences, members, open tasks and needed grocery items.",
      inputSchema: getHouseholdContextShape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(logger, MCP_TOOL_NAMES.getHouseholdContext, { householdId: args.householdId }, async () => ({
        ...(await getHouseholdContext(args.householdId, { taskLimit: args.taskLimit, groceryLimit: args.groceryLimit })),
      })),
  );

  server.registerTool(
    MCP_TOOL_NAMES.createTask,
    {
      title: "Create task",
      description: "Creates one household task. Requires an APPROVED approval whose stored action matches these arguments exactly.",
      inputSchema: createTaskShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(
        logger,
        MCP_TOOL_NAMES.createTask,
        { householdId: args.householdId, approvalId: args.approvalId, actionIndex: args.actionIndex },
        async () => {
          const { householdId, approvalId, actionIndex, ...fields } = args;
          const action = actionSchema.parse({ type: "create_task", ...fields });
          await assertActionApproved({ approvalId, householdId, actionIndex, action });
          const { task, created } = await createTask(householdId, { ...fields }, { approvalId, actionIndex });
          return { task, created };
        },
      ),
  );

  server.registerTool(
    MCP_TOOL_NAMES.updateGroceryList,
    {
      title: "Update grocery list",
      description:
        "Adds a grocery item or updates the existing item with the same name (no duplicates). Requires an APPROVED approval whose stored action matches exactly.",
      inputSchema: updateGroceryListShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(
        logger,
        MCP_TOOL_NAMES.updateGroceryList,
        { householdId: args.householdId, approvalId: args.approvalId, actionIndex: args.actionIndex },
        async () => {
          const { householdId, approvalId, actionIndex, ...fields } = args;
          const action = actionSchema.parse({ type: "update_grocery_list", ...fields });
          await assertActionApproved({ approvalId, householdId, actionIndex, action });
          const { item, created } = await upsertGroceryItem(householdId, { ...fields });
          return { item, created };
        },
      ),
  );
}
