import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError, type ProposedAction } from "@homeflow/shared";
import {
  assertActionApproved,
  checkDatabase,
  createApproval,
  createTask,
  decideApproval,
  disconnectPrisma,
  ensureConversation,
  getHouseholdContext,
  listGroceries,
  listTasks,
  upsertGroceryItem,
} from "../src/index.js";
import { resetData } from "../../../tests/support/helpers.js";

let hid: string;
beforeEach(async () => {
  hid = await resetData();
});
afterAll(disconnectPrisma);

async function newApproval(actions: ProposedAction[], opts: { ttlMs?: number; now?: Date } = {}) {
  const conversationId = await ensureConversation(hid, undefined, "t");
  return createApproval({ householdId: hid, conversationId, summary: "s", actions, provider: "mock", isMock: true, ...opts });
}
const taskAction: ProposedAction = { type: "create_task", title: "Do it", status: "TODO" };

describe("database services", () => {
  it("connects", async () => expect(await checkDatabase()).toBe(true));

  it("returns household context", async () => {
    const ctx = await getHouseholdContext(hid);
    expect(ctx.household.name).toBe("Test Household");
    expect(ctx.upcomingTasks.map((t) => t.title)).toContain("Existing task");
    expect(ctx.groceryItems[0]?.name).toBe("Milk");
    await expect(getHouseholdContext("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("creates tasks and round-trips due dates", async () => {
    const due = "2026-10-18T18:00:00.000Z";
    const { task, created } = await createTask(hid, { title: "Clean", status: "TODO", dueDate: due });
    expect(created).toBe(true);
    expect(task.dueDate).toBe(due);
    expect((await listTasks(hid)).length).toBe(2);
  });

  it("is idempotent for the same approval action", async () => {
    const a = await newApproval([taskAction]);
    const first = await createTask(hid, { title: "Do it", status: "TODO" }, { approvalId: a.id, actionIndex: 0 });
    const again = await createTask(hid, { title: "Do it", status: "TODO" }, { approvalId: a.id, actionIndex: 0 });
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.task.id).toBe(first.task.id);
    expect((await listTasks(hid)).filter((t) => t.title === "Do it")).toHaveLength(1);
  });

  it("upserts groceries without duplicates", async () => {
    const r1 = await upsertGroceryItem(hid, { name: "  MILK ", quantity: 3 });
    expect(r1.created).toBe(false);
    expect(r1.item.quantity).toBe(3);
    const r2 = await upsertGroceryItem(hid, { name: "milk", quantity: 3 });
    expect(r2.item.id).toBe(r1.item.id);
    const r3 = await upsertGroceryItem(hid, { name: "Paneer", quantity: 500, unit: "g" });
    expect(r3.created).toBe(true);
    expect(await listGroceries(hid)).toHaveLength(2);
  });

  it("re-adding a purchased item marks it needed again", async () => {
    await upsertGroceryItem(hid, { name: "Milk", status: "PURCHASED" });
    const r = await upsertGroceryItem(hid, { name: "Milk" });
    expect(r.item.status).toBe("NEEDED");
  });

  it("approval: single winner, idempotent repeat, conflict on contradiction", async () => {
    const a = await newApproval([taskAction]);
    const [x, y] = await Promise.all([decideApproval(a.id, hid, "approve"), decideApproval(a.id, hid, "approve")]);
    expect([x.outcome, y.outcome].sort()).toEqual(["already_decided", "transitioned"]);
    await expect(decideApproval(a.id, hid, "reject")).rejects.toMatchObject({ code: "APPROVAL_CONFLICT" });
  });

  it("approval: expired approvals are rejected", async () => {
    const a = await newApproval([taskAction], { ttlMs: 1000, now: new Date(Date.now() - 60_000) });
    await expect(decideApproval(a.id, hid, "approve")).rejects.toMatchObject({ code: "APPROVAL_EXPIRED" });
    await expect(decideApproval(a.id, hid, "approve")).rejects.toMatchObject({ code: "APPROVAL_EXPIRED" });
  });

  it("approval: other households cannot see or decide it", async () => {
    const a = await newApproval([taskAction]);
    await expect(decideApproval(a.id, "other-household", "approve")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("assertActionApproved requires an approved, matching action", async () => {
    const a = await newApproval([taskAction]);
    const call = { approvalId: a.id, householdId: hid, actionIndex: 0, action: taskAction };
    await expect(assertActionApproved(call)).rejects.toBeInstanceOf(DomainError); // still pending
    await decideApproval(a.id, hid, "approve");
    await expect(assertActionApproved(call)).resolves.toBeUndefined();
    await expect(assertActionApproved({ ...call, action: { ...taskAction, title: "Different" } })).rejects.toMatchObject({
      code: "APPROVAL_INVALID",
    });
    await expect(assertActionApproved({ ...call, actionIndex: 1 })).rejects.toMatchObject({ code: "APPROVAL_INVALID" });
    await expect(assertActionApproved({ ...call, householdId: "other" })).rejects.toMatchObject({ code: "APPROVAL_INVALID" });
  });
});
