import { DomainError, MCP_TOOL_NAMES, planSchema, type Plan } from "@homeflow/shared";
import { buildSystemPrompt } from "../prompts/system.js";
import type { ChatMessage, ContentBlock, LlmProvider } from "../providers/types.js";
import { LLM_TOOLS, PROPOSE_PLAN_TOOL } from "../tools/definitions.js";
import type { ToolCaller } from "../tools/mcpClient.js";

export interface PlannerInput {
  provider: LlmProvider;
  mcp: ToolCaller;
  householdId: string;
  message: string;
  history?: ChatMessage[];
  now?: Date;
  maxSteps?: number;
}

export interface PlannerResult {
  plan: Plan;
  assistantText: string;
}

/**
 * Runs the planning loop. The model may only (a) read context through MCP and (b) propose a plan.
 * The household id is injected here, never chosen by the model. No state-changing tool is reachable.
 */
export async function runPlanner(input: PlannerInput): Promise<PlannerResult> {
  const now = input.now ?? new Date();
  const maxSteps = input.maxSteps ?? 4;
  const messages: ChatMessage[] = [...(input.history ?? []), { role: "user", content: [{ type: "text", text: input.message }] }];
  const system = buildSystemPrompt(now);
  let assistantText = "";

  for (let step = 0; step < maxSteps; step++) {
    const res = await input.provider.generate({ system, messages, tools: LLM_TOOLS });
    messages.push({ role: "assistant", content: res.content });
    assistantText =
      res.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim() || assistantText;

    const toolUses = res.content.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
    if (toolUses.length === 0) break;

    const results: ContentBlock[] = [];
    for (const use of toolUses) {
      if (use.name === PROPOSE_PLAN_TOOL) {
        const parsed = planSchema.safeParse(use.input);
        if (parsed.success) return { plan: parsed.data, assistantText };
        results.push({
          type: "tool_result",
          toolUseId: use.id,
          isError: true,
          content: `Invalid plan: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        });
      } else if (use.name === MCP_TOOL_NAMES.getHouseholdContext) {
        try {
          const data = await input.mcp.callTool(use.name, { householdId: input.householdId });
          results.push({ type: "tool_result", toolUseId: use.id, content: JSON.stringify(data) });
        } catch (err) {
          if (err instanceof DomainError && err.code === "UPSTREAM_ERROR") throw err;
          results.push({ type: "tool_result", toolUseId: use.id, isError: true, content: "Could not read household context." });
        }
      } else {
        results.push({ type: "tool_result", toolUseId: use.id, isError: true, content: `Tool "${use.name}" is not available.` });
      }
    }
    messages.push({ role: "user", content: results });
  }
  throw new DomainError("PROVIDER_ERROR", `The ${input.provider.name} AI provider did not return a valid plan.`);
}
