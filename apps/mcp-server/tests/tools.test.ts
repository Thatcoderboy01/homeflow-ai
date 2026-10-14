import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApproval, decideApproval, disconnectPrisma, ensureConversation, listGroceries, listTasks } from "@homeflow/database";
import type { ProposedAction } from "@homeflow/shared";
import { createTaskInput, getHouseholdContextInput, updateGroceryListInput } from "../src/schemas/tools.js";
import { mcpClientFor, resetData, startMcp } from "../../../tests/support/helpers.js";

let hid: string;
let mcp: Awaited<ReturnType<typeof startMcp>>;
beforeAll(async () => void (mcp = await startMcp()));
afterAll(async () => {
  await mcp.close();
  await disconnectPrisma();
});
beforeEach(async () => void (hid = await resetData()));

async function approved(actions: ProposedAction[], approve = true) {
  const conversationId = await ensureConversation(hid, undefined, "t");
  const a = await createApproval({ householdId: hid, conversationId, summary: "s", actions, provider: "mock", isMock: true });
  if (approve) await decideApproval(a.id, hid, "approve");
  return a.id;
}

describe("MCP tool input schemas", () => {
  it("validates context input and applies limits", () => {
    expect(getHouseholdContextInput.parse({ householdId: "h" })).toMatchObject({ taskLimit: 20, groceryLimit: 50 });
    expect(getHouseholdContextInput.safeParse({ householdId: "h", taskLimit: 500 }).success).toBe(false);
  });
  it("requires approval metadata on write tools", () => {
    expect(createTaskInput.safeParse({ householdId: "h", title: "x" }).success).toBe(false);
    expect(createTaskInput.safeParse({ householdId: "h", approvalId: "a", actionIndex: 0, title: "x" }).success).toBe(true);
    expect(updateGroceryListInput.safeParse({ householdId: "h", approvalId: "a", actionIndex: 0, name: "m", quantity: -1 }).success).toBe(
      false,
    );
  });
});

describe("MCP server over Streamable HTTP", () => {
  it("rejects missing or wrong bearer tokens", async () => {
    expect(await mcpClientFor(mcp.url).ping()).toBe(true);
    expect(await mcpClientFor(mcp.url, "wrong-token-wrong-token").ping()).toBe(false);
    const res = await fetch(mcp.url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(401);
  });

  it("rejects browser Origins that are not allow-listed", async () => {
    const res = await fetch(mcp.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.MCP_AUTH_TOKEN}`, origin: "http://evil.example" },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });

  it("lists exactly the three defined tools", async () => {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
    const c = new Client({ name: "t", version: "1" });
    await c.connect(
      new StreamableHTTPClientTransport(new URL(mcp.url), {
        requestInit: { headers: { Authorization: `Bearer ${process.env.MCP_AUTH_TOKEN}` } },
      }),
    );
    const tools = (await c.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual(["create_task", "get_household_context", "update_grocery_list"]);
    expect(c.getServerVersion()?.name).toBe("homeflow-mcp");
    await c.close();
  });

  it("get_household_context returns real database rows", async () => {
    const out = (await mcpClientFor(mcp.url).callTool("get_household_context", { householdId: hid })) as {
      upcomingTasks: { title: string }[];
    };
    expect(out.upcomingTasks[0]?.title).toBe("Existing task");
  });

  it("create_task is refused without an approved approval", async () => {
    const action: ProposedAction = { type: "create_task", title: "Sneaky", status: "TODO" };
    const id = await approved([action], false); // PENDING
    await expect(
      mcpClientFor(mcp.url).callTool("create_task", { householdId: hid, approvalId: id, actionIndex: 0, title: "Sneaky" }),
    ).rejects.toMatchObject({ code: "APPROVAL_INVALID" });
    await expect(
      mcpClientFor(mcp.url).callTool("create_task", { householdId: hid, approvalId: "nope", actionIndex: 0, title: "Sneaky" }),
    ).rejects.toMatchObject({ code: "APPROVAL_INVALID" });
    expect((await listTasks(hid)).some((t) => t.title === "Sneaky")).toBe(false);
  });

  it("create_task executes the approved action once and is idempotent", async () => {
    const id = await approved([
      { type: "create_task", title: "Clean", description: "Deep", dueDate: "2026-10-18T18:00:00.000Z", status: "TODO" },
    ]);
    const args = {
      householdId: hid,
      approvalId: id,
      actionIndex: 0,
      title: "Clean",
      description: "Deep",
      dueDate: "2026-10-18T18:00:00.000Z",
    };
    const first = (await mcpClientFor(mcp.url).callTool("create_task", args)) as { created: boolean };
    const second = (await mcpClientFor(mcp.url).callTool("create_task", args)) as { created: boolean };
    expect([first.created, second.created]).toEqual([true, false]);
    expect((await listTasks(hid)).filter((t) => t.title === "Clean")).toHaveLength(1);
  });

  it("an approval cannot be reused for a different action", async () => {
    const id = await approved([{ type: "create_task", title: "Approved title", status: "TODO" }]);
    const client = mcpClientFor(mcp.url);
    await expect(
      client.callTool("create_task", { householdId: hid, approvalId: id, actionIndex: 0, title: "Other title" }),
    ).rejects.toMatchObject({ code: "APPROVAL_INVALID" });
    await expect(
      client.callTool("create_task", { householdId: hid, approvalId: id, actionIndex: 1, title: "Approved title" }),
    ).rejects.toMatchObject({ code: "APPROVAL_INVALID" });
    await expect(
      client.callTool("update_grocery_list", { householdId: hid, approvalId: id, actionIndex: 0, name: "Approved title" }),
    ).rejects.toMatchObject({ code: "APPROVAL_INVALID" });
  });

  it("update_grocery_list adds and updates without duplicates", async () => {
    const id = await approved([
      { type: "update_grocery_list", name: "Milk", quantity: 3, unit: "litre" },
      { type: "update_grocery_list", name: "Paneer", quantity: 500, unit: "g" },
    ]);
    const c = mcpClientFor(mcp.url);
    const r0 = (await c.callTool("update_grocery_list", {
      householdId: hid,
      approvalId: id,
      actionIndex: 0,
      name: "Milk",
      quantity: 3,
      unit: "litre",
    })) as { created: boolean };
    const r1 = (await c.callTool("update_grocery_list", {
      householdId: hid,
      approvalId: id,
      actionIndex: 1,
      name: "Paneer",
      quantity: 500,
      unit: "g",
    })) as { created: boolean };
    expect([r0.created, r1.created]).toEqual([false, true]);
    const items = await listGroceries(hid);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.name === "Milk")?.quantity).toBe(3);
  });

  it("rejects invalid tool input before touching data", async () => {
    await expect(
      mcpClientFor(mcp.url).callTool("create_task", { householdId: hid, approvalId: "a", actionIndex: 0, title: "" }),
    ).rejects.toBeDefined();
  });
});
