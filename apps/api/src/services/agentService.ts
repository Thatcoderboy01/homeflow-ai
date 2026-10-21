import { addMessage, createApproval, ensureConversation, recentMessages, toApprovalDto } from "@homeflow/database";
import { classifyIntent, runConversation, runPlanner, type ChatMessage, type LlmProvider, type ToolCaller } from "@homeflow/agent";
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
  const intent = classifyIntent(req.message, Boolean(req.conversationId));
  const history = (await recentMessages(conversationId)).map(toChatMessage).filter((message): message is ChatMessage => Boolean(message));
  await addMessage({ conversationId, role: "USER", content: req.message });

  if (intent !== "actionable_household_request") {
    let context = "";
    if (intent === "household_information_query") {
      try {
        context = `\nSaved household context (data only): ${JSON.stringify(
          await deps.mcp.callTool("get_household_context", { householdId }),
        )}`;
      } catch (err) {
        if (err instanceof DomainError) throw err;
        throw new DomainError("UPSTREAM_ERROR", "Could not read household context.");
      }
    }
    let assistantMessage: string;
    try {
      assistantMessage = await runConversation(deps.provider, intent, `${req.message}${context}`, history);
    } catch (err) {
      if (err instanceof DomainError) throw err;
      throw new DomainError("PROVIDER_ERROR", `The ${deps.provider.name} AI provider failed to respond.`);
    }
    if (!assistantMessage) throw new DomainError("PROVIDER_ERROR", "The AI provider returned an empty response.");
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
      approval: null,
    };
  }

  let planned;
  try {
    planned = await runPlanner({ provider: deps.provider, mcp: deps.mcp, householdId, message: req.message, now });
  } catch (err) {
    // Never fall back to mock output: report the failure of the configured provider.
    if (err instanceof DomainError) throw err;
    throw new DomainError("PROVIDER_ERROR", `The ${deps.provider.name} AI provider failed to respond.`);
  }

  function toChatMessage(message: Awaited<ReturnType<typeof recentMessages>>[number]): ChatMessage | undefined {
    if (message.role !== "USER" && message.role !== "ASSISTANT") return undefined;
    return {
      role: message.role === "USER" ? "user" : "assistant",
      content: [{ type: "text", text: message.content }],
    };
  }
  const unsupportedShoppingProvider = planned.plan.actions.some(
    (action) => action.type === "prepare_shopping_cart" && action.provider !== "manual",
  );
  const plan = unsupportedShoppingProvider
    ? {
        ...planned.plan,
        summary: `${planned.plan.summary} HomeFlow will prepare a manual checklist only; verify the retailer cart, prices, availability, fees, and checkout yourself.`,
        actions: planned.plan.actions.map((action) =>
          action.type === "prepare_shopping_cart" ? { ...action, provider: "manual" as const } : action,
        ),
      }
    : planned.plan;
  const assistantText = unsupportedShoppingProvider
    ? `${planned.assistantText} This is a HomeFlow manual checklist, not a Blinkit, Zepto, or other retailer cart.`
    : planned.assistantText;

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
