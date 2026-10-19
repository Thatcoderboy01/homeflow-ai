import { useCallback, useState } from "react";
import type { ApprovalDto } from "@homeflow/shared";
import { errorMessage } from "../lib/format";
import { api } from "../services/api";
import type { ChatEntry } from "../types/ui";

type Busy = "idle" | "planning" | "approving" | "rejecting";

/**
 * Chat + approval state machine. The UI only reports success once the backend returns
 * per-action results; nothing is assumed while a request is in flight.
 */
export function useAssistant(onDataChanged: () => void) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [approval, setApproval] = useState<ApprovalDto | undefined>();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState<Busy>("idle");
  const [error, setError] = useState<string | undefined>();

  const push = (e: Omit<ChatEntry, "id">) => setEntries((prev) => [...prev, { ...e, id: crypto.randomUUID() }]);

  const send = useCallback(
    async (message: string) => {
      setError(undefined);
      setBusy("planning");
      push({ role: "user", text: message });
      try {
        const res = await api.plan(message, conversationId);
        setConversationId(res.conversationId);
        setApproval(res.approval ?? undefined);
        push({ role: "assistant", text: res.assistantMessage, provider: res.provider });
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy("idle");
      }
    },
    [conversationId],
  );

  const decide = useCallback(
    async (kind: "approve" | "reject") => {
      if (!approval) return;
      setError(undefined);
      setBusy(kind === "approve" ? "approving" : "rejecting");
      try {
        const res = kind === "approve" ? await api.approve(approval.id) : await api.reject(approval.id);
        setApproval(res.approval);
        if (kind === "reject") push({ role: "system", text: "Plan rejected. Nothing was changed." });
        else {
          const results = res.approval.results ?? [];
          const ok = results.filter((r) => r.ok).length;
          push({
            role: "system",
            text: res.executedNow
              ? `Backend confirmed: ${ok} of ${results.length} actions completed.`
              : "This plan was already approved; nothing new was executed.",
          });
          onDataChanged();
        }
      } catch (e) {
        setError(errorMessage(e));
        // The approval may have expired or changed: re-sync its real state.
        api
          .approval(approval.id)
          .then(setApproval)
          .catch(() => undefined);
      } finally {
        setBusy("idle");
      }
    },
    [approval, onDataChanged],
  );

  return { entries, approval, busy, error, send, approve: () => decide("approve"), reject: () => decide("reject") };
}
