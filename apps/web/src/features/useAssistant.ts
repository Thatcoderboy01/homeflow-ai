import { useCallback, useRef, useState } from "react";
import type { ApprovalDto } from "@homeflow/shared";
import { errorMessage } from "../lib/format";
import { api } from "../services/api";
import type { ChatEntry } from "../types/ui";
import { classifyVoiceConfirmation } from "./voiceConfirmation";

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
  const decidingRef = useRef<{ id: string; kind: "approve" | "reject" } | undefined>(undefined);

  const push = (entry: Omit<ChatEntry, "id">) => setEntries((previous) => [...previous, { ...entry, id: crypto.randomUUID() }]);

  const send = useCallback(
    async (message: string) => {
      setError(undefined);
      setBusy("planning");
      push({ role: "user", text: message });
      try {
        const response = await api.plan(message, conversationId);
        setConversationId(response.conversationId);
        setApproval(response.approval ?? undefined);
        push({ role: "assistant", text: response.assistantMessage, provider: response.provider });
        if (response.approval?.status === "PENDING") {
          push({ role: "assistant", text: `I've prepared ${response.approval.summary}. Would you like me to proceed?`, provider: response.provider });
        }
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
      if (!approval || approval.status !== "PENDING" || decidingRef.current) return;
      const approvalId = approval.id;
      decidingRef.current = { id: approvalId, kind };
      setError(undefined);
      setBusy(kind === "approve" ? "approving" : "rejecting");
      try {
        const response = kind === "approve" ? await api.approve(approvalId) : await api.reject(approvalId);
        setApproval(response.approval);
        if (kind === "reject") {
          push({ role: "system", text: "Plan rejected. Nothing was changed." });
        } else {
          const results = response.approval.results ?? [];
          const completed = results.filter((result) => result.ok).length;
          push({
            role: "system",
            text: response.executedNow
              ? `Backend confirmed: ${completed} of ${results.length} actions completed.`
              : "This plan was already approved; nothing new was executed.",
          });
          onDataChanged();
        }
      } catch (e) {
        setError(errorMessage(e));
        api.approval(approvalId)
          .then(setApproval)
          .catch(() => undefined);
      } finally {
        decidingRef.current = undefined;
        setBusy("idle");
      }
    },
    [approval, onDataChanged],
  );

  const sendVoice = useCallback(
    async (message: string) => {
      const confirmation = classifyVoiceConfirmation(message);
      const normalized = message.toLocaleLowerCase().trim().replace(/[.,!?;:]/g, "");
      const standaloneConfirmation = ["yes", "yeah", "yep", "haan", "no", "nahi", "nahin"].includes(normalized);
      if (!approval && standaloneConfirmation) {
        push({ role: "user", text: message });
        push({ role: "assistant", text: "There isn't a pending proposal to approve or reject. What would you like help with?" });
        return;
      }
      if (approval?.status === "PENDING" && busy === "idle") {
        if (decidingRef.current) return;
        push({ role: "user", text: message });
        if (confirmation === "approve" || confirmation === "reject") {
          await decide(confirmation);
          return;
        }
        if (confirmation === "defer") {
          push({ role: "assistant", text: "No problem. I'll leave the proposal pending for you to review." });
          return;
        }
        if (confirmation === "ambiguous") {
          push({ role: "assistant", text: "Would you like me to approve or reject the proposed plan?" });
          return;
        }
      }
      await send(message);
    },
    [approval, busy, decide, send],
  );

  return { entries, approval, busy, error, send, sendVoice, approve: () => decide("approve"), reject: () => decide("reject") };
}
