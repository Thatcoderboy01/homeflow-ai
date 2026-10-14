import { addMessage, createApproval, ensureConversation, toApprovalDto } from "@homeflow/database";
import { runPlanner, type LlmProvider, type ToolCaller } from "@homeflow/agent";
import { DomainError, type PlanRequest, type PlanResponseDto } from "@homeflow/shared";

export interface AgentDeps {
  provider: LlmProvider;
  mcp: ToolCaller;
  approvalTtlMs: number;
  now?: () => Date;
}

/** PLANNING ONLY: reads context via MCP and stores a PENDING approval. Changes no household data. */
export async function planRequest(deps: AgentDeps, householdId: string, req: PlanRequest): Promise<PlanResponseDto> {
  const now = deps.now?.() ?? new Date();
  const conversationId = await ensureConversation(householdId, req.conversationId, req.message);
  await addMessage({ conversationId, role: "USER", content: req.message });

  let planned;
  try {
    planned = await runPlanner({ provider: deps.provider, mcp: deps.mcp, householdId, message: req.message, now });
  } catch (err) {
    // Never fall back to mock output: report the failure of the configured provider.
    if (err instanceof DomainError) throw err;
    throw new DomainError("PROVIDER_ERROR", `The ${deps.provider.name} AI provider failed to respond.`);
  }
  const { plan, assistantText } = planned;

  const approval = await createApproval({
    householdId,
    conversationId,
    summary: plan.summary,
    actions: plan.actions,
    provider: deps.provider.name,
    isMock: deps.provider.isMock,
    ttlMs: deps.approvalTtlMs,
    now,
  });
  const assistantMessage = assistantText || plan.summary;
  await addMessage({
    conversationId,
    role: "ASSISTANT",
    content: assistantMessage,
    provider: deps.provider.name,
    isMock: deps.provider.isMock,
  });

  return {
    conversationId,
    assistantMessage,
    provider: { name: deps.provider.name, isMock: deps.provider.isMock },
    approval: toApprovalDto(approval),
  };
}
