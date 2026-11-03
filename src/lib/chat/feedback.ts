import { isToolUIPart, type UIMessage } from "ai";

const TERMINAL_TOOLS = new Set([
  "book_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "escalate_to_human",
]);

function outputSucceeded(output: unknown): boolean {
  if (typeof output !== "object" || output === null) return true;
  return (output as Record<string, unknown>).ok !== false;
}

/**
 * Feedback is only relevant once the assistant has completed a terminal action.
 * Require it to be the latest message so a follow-up question hides the prompt.
 */
export function conversationCompletion(
  messages: UIMessage[],
): { messageId: string } | null {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return null;

  const completed = last.parts.some((part) => {
    if (!isToolUIPart(part) || part.state !== "output-available") return false;
    const toolName = part.type.startsWith("tool-")
      ? part.type.slice("tool-".length)
      : "";
    return TERMINAL_TOOLS.has(toolName) && outputSucceeded(part.output);
  });

  return completed ? { messageId: last.id } : null;
}
