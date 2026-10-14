import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { pino } from "pino";
import { McpToolClient } from "@homeflow/agent";
import { getPrisma } from "@homeflow/database";
import { createMcpApp } from "../../apps/mcp-server/src/transport/http.js";

export const TOKEN = process.env.MCP_AUTH_TOKEN ?? "test-token-0123456789abcdef";
export const silentLogger = pino({ level: "silent" });

export async function startMcp(): Promise<{ url: string; close: () => Promise<void> }> {
  const app = createMcpApp({ authToken: TOKEN, logger: silentLogger });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/mcp`, close: () => new Promise((r) => server.close(() => r())) };
}

export const mcpClientFor = (url: string, token = TOKEN) => new McpToolClient({ url, authToken: token, timeoutMs: 8000 });

/** Wipes all tables (FK-safe order) and creates a fresh household with a couple of rows. */
export async function resetData() {
  const db = getPrisma();
  await db.message.deleteMany();
  await db.task.deleteMany();
  await db.actionApproval.deleteMany();
  await db.conversation.deleteMany();
  await db.groceryItem.deleteMany();
  await db.householdMember.deleteMany();
  await db.household.deleteMany();
  const household = await db.household.create({
    data: { id: "test-household", name: "Test Household", isDemo: true, timezone: "UTC", preferences: { dietary: ["vegetarian"] } },
  });
  await db.householdMember.create({ data: { householdId: household.id, name: "Tester", role: "ADMIN" } });
  await db.task.create({ data: { householdId: household.id, title: "Existing task", status: "TODO" } });
  await db.groceryItem.create({ data: { householdId: household.id, name: "Milk", normalizedName: "milk", quantity: 1, unit: "litre" } });
  return household.id;
}
