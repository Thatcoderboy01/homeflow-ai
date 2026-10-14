import { describe, expect, it } from "vitest";
import { DomainError, planSchema } from "@homeflow/shared";
import { BedrockProvider, MockProvider, runPlanner, mapBedrockError, type LlmProvider, type ToolCaller } from "../src/index.js";

const fixedNow = new Date("2026-10-14T10:00:00Z"); // a Wednesday
const ctx = {
  household: { preferences: { dietary: ["vegetarian"] } },
  upcomingTasks: [{ title: "Clean living room and guest bathroom" }],
  groceryItems: [{ name: "Milk" }],
};
const fakeMcp = (data: unknown = ctx): ToolCaller & { calls: unknown[] } => {
  const calls: unknown[] = [];
  return { calls, callTool: async (name, args) => (calls.push({ name, args }), data), ping: async () => true };
};

describe("mock provider + planner", () => {
  it("produces a deterministic, schema-valid plan for the guests example", async () => {
    const run = () =>
      runPlanner({
        provider: new MockProvider(() => fixedNow),
        mcp: fakeMcp(),
        householdId: "h1",
        message: "Guests are coming on Sunday. Help me prepare.",
        now: fixedNow,
      });
    const a = await run();
    const b = await run();
    expect(a.plan).toEqual(b.plan);
    expect(planSchema.safeParse(a.plan).success).toBe(true);
    expect(a.plan.summary).toContain("Sunday");
    const titles = a.plan.actions.map((x) => (x.type === "create_task" ? x.title : x.name));
    expect(titles).toContain("Paneer"); // vegetarian preference respected
    expect(titles).not.toContain("Clean living room and guest bathroom"); // existing task not duplicated
    expect(a.plan.actions.find((x) => x.type === "create_task" && x.dueDate)?.type).toBe("create_task");
    expect(a.assistantText).toContain("[Demo mode]");
  });

  it("injects the household id itself and only reads context", async () => {
    const mcp = fakeMcp();
    await runPlanner({ provider: new MockProvider(() => fixedNow), mcp, householdId: "h1", message: "Guests on Sunday", now: fixedNow });
    expect(mcp.calls).toEqual([{ name: "get_household_context", args: { householdId: "h1" } }]);
  });

  it("falls back to a single follow-up task for unknown requests", async () => {
    const r = await runPlanner({
      provider: new MockProvider(() => fixedNow),
      mcp: fakeMcp(),
      householdId: "h",
      message: "Fix the leaking roof",
      now: fixedNow,
    });
    expect(r.plan.actions).toHaveLength(1);
  });
});

describe("planner safety", () => {
  const scripted = (responses: Parameters<LlmProvider["generate"]>[0] extends never ? never : unknown[]): LlmProvider => {
    let i = 0;
    return { name: "scripted", isMock: false, generate: async () => responses[Math.min(i++, responses.length - 1)] as never };
  };

  it("rejects a model that never proposes a plan (no silent fallback)", async () => {
    const provider = scripted([{ stopReason: "end_turn", content: [{ type: "text", text: "Sure, done!" }] }]);
    await expect(runPlanner({ provider, mcp: fakeMcp(), householdId: "h", message: "hi" })).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
  });

  it("refuses invalid plans and tools the model should not have", async () => {
    const provider = scripted([
      { stopReason: "tool_use", content: [{ type: "tool_use", id: "1", name: "create_task", input: { title: "sneaky" } }] },
      {
        stopReason: "tool_use",
        content: [{ type: "tool_use", id: "2", name: "propose_plan", input: { summary: "x", actions: [{ type: "drop_tables" }] } }],
      },
    ]);
    const mcp = fakeMcp();
    await expect(runPlanner({ provider, mcp, householdId: "h", message: "hi", maxSteps: 3 })).rejects.toBeInstanceOf(DomainError);
    expect(mcp.calls).toHaveLength(0); // create_task was never forwarded to MCP
  });
});

describe("bedrock provider", () => {
  it("requires a model id", () => expect(() => new BedrockProvider({ modelId: "" })).toThrow());

  it("maps Converse tool-use responses", async () => {
    const client = {
      send: async () => ({
        stopReason: "tool_use",
        output: { message: { content: [{ text: "hi" }, { toolUse: { toolUseId: "t1", name: "get_household_context", input: {} } }] } },
      }),
    };
    const p = new BedrockProvider({ modelId: "m", client: client as never });
    const r = await p.generate({ system: "s", messages: [{ role: "user", content: [{ type: "text", text: "x" }] }], tools: [] });
    expect(r.stopReason).toBe("tool_use");
    expect(r.content[1]).toMatchObject({ type: "tool_use", id: "t1", name: "get_household_context" });
  });

  it("reports provider failures clearly", async () => {
    const throttled = Object.assign(new Error("slow down"), { name: "ThrottlingException" });
    const p = new BedrockProvider({
      modelId: "m",
      client: {
        send: async () => {
          throw throttled;
        },
      } as never,
    });
    await expect(p.generate({ system: "", messages: [], tools: [] })).rejects.toMatchObject({ code: "PROVIDER_ERROR", httpStatus: 503 });
    expect(mapBedrockError(Object.assign(new Error(), { name: "AccessDeniedException" })).message).toMatch(/denied/i);
  });
});
