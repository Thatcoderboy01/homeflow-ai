import { decideApproval, finishApproval, getApproval, toApprovalDto } from "@homeflow/database";
import type { ToolCaller } from "@homeflow/agent";
import {
  actionSchema,
  DomainError,
  MCP_TOOL_NAMES,
  type ActionResultDto,
  type DecisionResponseDto,
  type ProposedAction,
} from "@homeflow/shared";

function toToolCall(action: ProposedAction, ctx: { householdId: string; approvalId: string; actionIndex: number }) {
  const { type, ...fields } = action;
  const name = type === "create_task" ? MCP_TOOL_NAMES.createTask : MCP_TOOL_NAMES.updateGroceryList;
  return { name, args: { ...ctx, ...fields } as Record<string, unknown> };
}

export async function fetchApproval(householdId: string, id: string) {
  return toApprovalDto(await getApproval(id, householdId));
}

export async function approveAndExecute(
  deps: { mcp: ToolCaller; now?: () => Date },
  householdId: string,
  id: string,
): Promise<DecisionResponseDto> {
  const decision = await decideApproval(id, householdId, "approve", deps.now?.());
  if (decision.outcome === "already_decided") {
    // Repeat submission: report the stored state. Nothing is executed a second time.
    return { approval: toApprovalDto(decision.approval), executedNow: false };
  }

  // Only the single caller that won the PENDING -> APPROVED transition reaches this point.
  const actions = actionSchema.array().parse(decision.approval.actions);
  const results: ActionResultDto[] = [];
  for (const [index, action] of actions.entries()) {
    const call = toToolCall(action, { householdId, approvalId: id, actionIndex: index });
    try {
      await deps.mcp.callTool(call.name, call.args);
      results.push({ index, type: action.type, ok: true, message: "Done" });
    } catch (err) {
      const message = err instanceof DomainError ? err.message : "Action failed";
      results.push({ index, type: action.type, ok: false, message });
    }
  }
  const finished = await finishApproval(id, results, deps.now?.());
  return { approval: toApprovalDto(finished), executedNow: true };
}

export async function reject(householdId: string, id: string, now?: () => Date): Promise<DecisionResponseDto> {
  const decision = await decideApproval(id, householdId, "reject", now?.());
  return { approval: toApprovalDto(decision.approval), executedNow: false };
}
