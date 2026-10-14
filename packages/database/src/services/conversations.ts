import { DomainError } from "@homeflow/shared";
import { getPrisma } from "../client.js";

export async function ensureConversation(householdId: string, conversationId: string | undefined, titleHint: string): Promise<string> {
  const db = getPrisma();
  if (conversationId) {
    const found = await db.conversation.findFirst({ where: { id: conversationId, householdId }, select: { id: true } });
    if (!found) throw new DomainError("NOT_FOUND", "Conversation not found.");
    return found.id;
  }
  const created = await db.conversation.create({ data: { householdId, title: titleHint.slice(0, 80) } });
  return created.id;
}

export async function addMessage(input: {
  conversationId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  provider?: string;
  isMock?: boolean;
}) {
  return getPrisma().message.create({ data: { ...input, isMock: input.isMock ?? false } });
}

export async function recentMessages(conversationId: string, limit = 10) {
  const rows = await getPrisma().message.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: limit });
  return rows.reverse();
}
