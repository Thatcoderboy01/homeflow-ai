import { MCP_TOOL_NAMES, type Plan, type ProposedAction } from "@homeflow/shared";
import { PROPOSE_PLAN_TOOL } from "../tools/definitions.js";
import type { ChatMessage, GenerateRequest, GenerateResponse, LlmProvider } from "./types.js";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Next occurrence (strictly in the future) of a weekday, at 18:00 UTC. */
export function nextWeekday(now: Date, weekday: number): Date {
  const d = new Date(now);
  const diff = (weekday - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(18, 0, 0, 0);
  return d;
}

interface ContextShape {
  upcomingTasks?: { title: string }[];
  groceryItems?: { name: string }[];
  household?: { preferences?: { dietary?: string[] } | null };
}

/**
 * Deterministic provider for local development and tests. It follows the same
 * tool-calling protocol as a real model (read context, then propose a plan), so the
 * orchestrator, MCP server and approval flow are exercised identically.
 */
export class MockProvider implements LlmProvider {
  readonly name = "mock";
  readonly isMock = true;
  constructor(private readonly clock: () => Date = () => new Date()) {}

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const userText = firstUserText(req.messages);
    const ctxResult = findToolResult(req.messages, MCP_TOOL_NAMES.getHouseholdContext);
    if (!ctxResult) {
      return {
        stopReason: "tool_use",
        content: [
          { type: "text", text: "[Demo mode] Let me check your household context first." },
          { type: "tool_use", id: "mock-ctx-1", name: MCP_TOOL_NAMES.getHouseholdContext, input: {} },
        ],
      };
    }
    let context: ContextShape = {};
    try {
      context = JSON.parse(ctxResult) as ContextShape;
    } catch {
      /* fall through with empty context */
    }
    const plan = this.buildPlan(userText, context);
    return {
      stopReason: "tool_use",
      content: [
        { type: "text", text: `[Demo mode] ${plan.summary} Please review the proposed actions below.` },
        { type: "tool_use", id: "mock-plan-1", name: PROPOSE_PLAN_TOOL, input: plan },
      ],
    };
  }

  private buildPlan(text: string, ctx: ContextShape): Plan {
    const lower = text.toLowerCase();
    const now = this.clock();
    const existingTasks = new Set((ctx.upcomingTasks ?? []).map((t) => t.title.toLowerCase()));
    const existingGroceries = new Set((ctx.groceryItems ?? []).map((g) => g.name.toLowerCase()));
    const isHosting = /(guest|visitor|party|dinner|company|host)/.test(lower);

    if (!isHosting) {
      const title = text.trim().replace(/\s+/g, " ").slice(0, 120);
      return {
        summary: "I couldn't match a known template, so I drafted a single follow-up task.",
        actions: [{ type: "create_task", title: `Follow up: ${title}`, status: "TODO" }],
      };
    }

    const dayIdx = WEEKDAYS.findIndex((d) => lower.includes(d));
    const eventDay = nextWeekday(now, dayIdx >= 0 ? dayIdx : 0);
    const dayLabel = dayIdx >= 0 ? WEEKDAYS[dayIdx]![0]!.toUpperCase() + WEEKDAYS[dayIdx]!.slice(1) : "Sunday";
    const before = (days: number, hour: number) => {
      const d = new Date(eventDay);
      d.setUTCDate(d.getUTCDate() - days);
      d.setUTCHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    const vegetarian = ctx.household?.preferences?.dietary?.includes("vegetarian") ?? false;

    const tasks: ProposedAction[] = [
      {
        type: "create_task",
        title: `Plan menu for ${dayLabel} guests`,
        description: vegetarian ? "Household is vegetarian: keep the menu vegetarian." : undefined,
        dueDate: before(2, 18),
        status: "TODO",
      },
      { type: "create_task", title: "Grocery run for guest snacks and drinks", dueDate: before(1, 12), status: "TODO" },
      { type: "create_task", title: "Clean living room and guest bathroom", dueDate: before(1, 18), status: "TODO" },
      {
        type: "create_task",
        title: "Set out seating, tea and snacks",
        description: "Have tea and snacks ready 30 minutes before guests arrive.",
        dueDate: before(0, 12),
        status: "TODO",
      },
    ];
    const groceries: ProposedAction[] = [
      { type: "update_grocery_list", name: "Milk", quantity: 3, unit: "litre" },
      { type: "update_grocery_list", name: "Tea leaves", quantity: 1, unit: "pack" },
      { type: "update_grocery_list", name: vegetarian ? "Paneer" : "Chicken", quantity: 500, unit: "g" },
      { type: "update_grocery_list", name: "Fresh fruits", quantity: 2, unit: "kg" },
      { type: "update_grocery_list", name: "Biscuits", quantity: 2, unit: "pack" },
      { type: "update_grocery_list", name: "Paper napkins", quantity: 1, unit: "pack" },
    ];
    const actions = [...tasks, ...groceries].filter((a) => (a.type === "create_task" ? !existingTasks.has(a.title.toLowerCase()) : true));
    const updates = groceries.filter((g) => g.type === "update_grocery_list" && existingGroceries.has(g.name.toLowerCase())).length;
    return {
      summary: `Preparation plan for ${dayLabel}: ${tasks.length} tasks and ${groceries.length} grocery items${updates ? ` (${updates} already on your list will be updated, not duplicated)` : ""}.`,
      actions,
    };
  }
}

function firstUserText(messages: ChatMessage[]): string {
  for (const m of messages) {
    if (m.role !== "user") continue;
    const t = m.content.find((b) => b.type === "text");
    if (t && t.type === "text") return t.text;
  }
  return "";
}

function findToolResult(messages: ChatMessage[], toolName: string): string | undefined {
  const ids = new Set<string>();
  for (const m of messages) {
    for (const b of m.content) {
      if (b.type === "tool_use" && b.name === toolName) ids.add(b.id);
      if (b.type === "tool_result" && ids.has(b.toolUseId) && !b.isError) return b.content;
    }
  }
  return undefined;
}
