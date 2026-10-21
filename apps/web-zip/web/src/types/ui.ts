export interface ChatEntry {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  /** Present on assistant messages: which provider produced it. */
  provider?: { name: string; isMock: boolean };
}
