import type { ChatMessage, ContentBlock, LlmProvider } from "../providers/types.js";
import type { UserIntent } from "./intent.js";

const BASE = [
  "You are HomeFlow AI, a warm and concise family household assistant.",
  "Only describe capabilities that HomeFlow supports: household task planning, guest/event preparation, grocery suggestions, saved household context, and reviewable approval-first plans.",
  "Never claim that data was changed. Never create or imply a task, grocery item, or approval for this conversational response.",
  "If the user asks a general question, answer it helpfully and offer an optional HomeFlow-related next step.",
  "If the request is ambiguous, ask one concise clarifying question.",
  "Use natural English, Hindi, or Hinglish matching the user's language.",
].join("\n");

export async function runConversation(
  provider: LlmProvider,
  intent: UserIntent,
  message: string,
  history: ChatMessage[] = [],
): Promise<string> {
  const res = await provider.generate({
    system: `${BASE}\nIntent classification: ${intent}.`,
    messages: [...history, { role: "user", content: [{ type: "text", text: message }] }],
    tools: [],
  });
  return res.content
    .filter((block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
