export type UserIntent =
  | "greeting"
  | "casual_conversation"
  | "capability_question"
  | "general_question"
  | "household_information_query"
  | "actionable_household_request"
  | "ambiguous_request"
  | "follow_up";

const GREETINGS = /^(hi|hello|hey|hiya|good morning|good afternoon|good evening)[!.?,\s]*$/i;
const CASUAL = /^(how are you|how's it going|thanks|thank you|okay|ok|great|nice|cool)[!.?,\s]*$/i;
const CAPABILITIES = /\b(what can you do|what do you do|tell me about homeflow|how can you help|capabilit(?:y|ies))\b/i;
const HOUSEHOLD_INFO = /\b(what(?:'s| is) on my|show|list|check|do we have|saved|existing)\b.*\b(task|chore|grocery|groceries|shopping|household|list)\b/i;
const ACTION = /\b(add|create|make|plan|prepare|organize|organise|schedule|remind|clean|buy|get|update|set up|help me)\b/i;
const AMBIGUOUS = /^(i need to get organized|i need help|help me|i want to organize|i want to get organized)[.!?]*$/i;

export function classifyIntent(message: string, hasConversation: boolean): UserIntent {
  const text = message.trim();
  if (hasConversation && /^(it|that|this|the plan|make it|simplify|change it)\b/i.test(text)) return "follow_up";
  if (GREETINGS.test(text)) return "greeting";
  if (CASUAL.test(text)) return "casual_conversation";
  if (CAPABILITIES.test(text)) return "capability_question";
  if (AMBIGUOUS.test(text)) return "ambiguous_request";
  if (HOUSEHOLD_INFO.test(text)) return "household_information_query";
  if (/^(what|why|how|when|where|who|explain|tell me)\b/i.test(text) && !ACTION.test(text)) return "general_question";
  if (ACTION.test(text)) return "actionable_household_request";
  return "ambiguous_request";
}
