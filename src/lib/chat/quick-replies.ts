import { isTextUIPart, type UIMessage } from "ai";

export type QuickReplies = {
  yes: string;
  no: string;
};

function lastAssistantText(messages: UIMessage[]): string | null {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return null;
  const text = last.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n")
    .trim();
  return text || null;
}

export function confirmationReplies(
  messages: UIMessage[],
): QuickReplies | null {
  const text = lastAssistantText(messages);
  if (!text || !text.includes("?")) return null;

  const lower = text.toLowerCase();
  const asksPermission =
    /(should i|shall i|would you like me to|do you want me to|can i|may i)/.test(
      lower,
    );

  if (asksPermission && /(book|reserve)/.test(lower)) {
    return { yes: "Yes, please book it", no: "No, show me other times" };
  }

  if (asksPermission && /cancel/.test(lower)) {
    return { yes: "Yes, cancel it", no: "Keep it as is" };
  }

  if (asksPermission && /(move|reschedul)/.test(lower)) {
    return { yes: "Yes, move it", no: "Keep the current time" };
  }

  if (asksPermission && /(alert|notify|let the team know)/.test(lower)) {
    return { yes: "Yes, please alert them", no: "No, not right now" };
  }

  if (/(correct|right|confirm)/.test(lower)) {
    return { yes: "Yes, that's correct", no: "No, let me correct that" };
  }

  if (/(does that work|work for you)/.test(lower)) {
    return { yes: "Yes, that works", no: "No, show me other options" };
  }

  return null;
}

export function slotSelectionMessage(label: string): string {
  return `Let's go with ${label}. Please continue.`;
}
