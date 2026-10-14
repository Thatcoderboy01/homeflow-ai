import { createHash } from "node:crypto";
import { actionSchema, canonicalJson, DomainError, type ActionResultDto, type ProposedAction } from "@homeflow/shared";
import { getPrisma } from "../client.js";
import type { ActionApproval } from "../generated/client.js";

export const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1000;

export const hashActions = (actions: ProposedAction[]): string => createHash("sha256").update(canonicalJson(actions)).digest("hex");

export async function createApproval(input: {
  householdId: string;
  conversationId: string;
  summary: string;
  actions: ProposedAction[];
  provider: string;
  isMock: boolean;
  ttlMs?: number;
  now?: Date;
}): Promise<ActionApproval> {
  const now = input.now ?? new Date();
  return getPrisma().actionApproval.create({
    data: {
      householdId: input.householdId,
      conversationId: input.conversationId,
      summary: input.summary,
      actions: input.actions as object[],
      actionsHash: hashActions(input.actions),
      provider: input.provider,
      isMock: input.isMock,
      expiresAt: new Date(now.getTime() + (input.ttlMs ?? DEFAULT_APPROVAL_TTL_MS)),
    },
  });
}

export async function getApproval(id: string, householdId: string): Promise<ActionApproval> {
  const row = await getPrisma().actionApproval.findFirst({ where: { id, householdId } });
  if (!row) throw new DomainError("NOT_FOUND", "Approval not found.");
  return row;
}

export type DecisionOutcome = { outcome: "transitioned" | "already_decided"; approval: ActionApproval };

/**
 * Atomically moves a PENDING, unexpired approval to APPROVED or REJECTED. The conditional
 * UPDATE guarantees exactly one caller wins, so only that caller may execute the actions.
 * Repeating the same decision is idempotent; contradicting an earlier decision is a conflict.
 */
export async function decideApproval(
  id: string,
  householdId: string,
  decision: "approve" | "reject",
  now = new Date(),
): Promise<DecisionOutcome> {
  const db = getPrisma();
  const target = decision === "approve" ? "APPROVED" : "REJECTED";
  const res = await db.actionApproval.updateMany({
    where: { id, householdId, status: "PENDING", expiresAt: { gt: now } },
    data: { status: target, decidedAt: now },
  });
  const row = await getApproval(id, householdId);
  if (res.count === 1) return { outcome: "transitioned", approval: row };

  if (row.status === "PENDING") {
    await db.actionApproval.updateMany({ where: { id, status: "PENDING" }, data: { status: "EXPIRED", decidedAt: now } });
    throw new DomainError("APPROVAL_EXPIRED", "This approval has expired. Ask the assistant for a new plan.");
  }
  if (row.status === "EXPIRED") throw new DomainError("APPROVAL_EXPIRED", "This approval has expired. Ask the assistant for a new plan.");
  const sameDecision = decision === "approve" ? ["APPROVED", "EXECUTED", "FAILED"] : ["REJECTED"];
  if (sameDecision.includes(row.status)) return { outcome: "already_decided", approval: row };
  throw new DomainError("APPROVAL_CONFLICT", `This approval was already ${row.status.toLowerCase()}.`);
}

/**
 * Called by MCP write tools before touching data. Confirms the approval exists for the household,
 * is APPROVED, its stored actions were not altered, and the requested call matches the approved action exactly.
 */
export async function assertActionApproved(args: {
  approvalId: string;
  householdId: string;
  actionIndex: number;
  action: ProposedAction;
}): Promise<void> {
  const row = await getPrisma().actionApproval.findFirst({ where: { id: args.approvalId, householdId: args.householdId } });
  if (!row) throw new DomainError("APPROVAL_INVALID", "Unknown approval reference.");
  if (row.status !== "APPROVED") throw new DomainError("APPROVAL_INVALID", `Approval is ${row.status.toLowerCase()}, not approved.`);
  const stored = actionSchema.array().safeParse(row.actions);
  if (!stored.success || hashActions(stored.data) !== row.actionsHash) {
    throw new DomainError("APPROVAL_INVALID", "Approved actions failed integrity check.");
  }
  const approved = stored.data[args.actionIndex];
  if (!approved || canonicalJson(approved) !== canonicalJson(args.action)) {
    throw new DomainError("APPROVAL_INVALID", "Requested action does not match the approved action.");
  }
}

export async function finishApproval(id: string, results: ActionResultDto[], now = new Date()): Promise<ActionApproval> {
  const failed = results.some((r) => !r.ok);
  return getPrisma().actionApproval.update({
    where: { id },
    data: { status: failed ? "FAILED" : "EXECUTED", executedAt: now, result: results as object[] },
  });
}
