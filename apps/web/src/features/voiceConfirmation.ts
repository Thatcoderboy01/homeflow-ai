export type VoiceConfirmation = "approve" | "reject" | "defer" | "ambiguous" | "none";

const normalize = (text: string) =>
  text
    .toLocaleLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const matchesPhrase = (text: string, phrases: readonly string[]) => phrases.some((phrase) => text === phrase || text.startsWith(`${phrase} `));

export function classifyVoiceConfirmation(text: string): VoiceConfirmation {
  const normalized = normalize(text);
  if (!normalized) return "none";
  if (matchesPhrase(normalized, ["wait", "not now", "let me review", "let me check", "hold on", "baad mein", "baad me"])) return "defer";
  if (matchesPhrase(normalized, ["no", "nahi", "nahin", "reject", "cancel", "cancel it", "don't do it", "do not do it"])) return "reject";
  if (matchesPhrase(normalized, ["yes", "yeah", "yep", "haan", "approve", "go ahead", "do it", "proceed", "kar do", "kardo"])) return "approve";
  if (/^(yes|yeah|yep|haan|approve|proceed|go ahead|do it|no|nahi|nahin|reject|cancel|wait)\b/.test(normalized)) return "ambiguous";
  return "none";
}
