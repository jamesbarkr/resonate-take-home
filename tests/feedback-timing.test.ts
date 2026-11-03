import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { conversationCompletion } from "@/lib/chat/feedback";

function assistant(
  parts: UIMessage["parts"],
  id = "assistant-1",
): UIMessage {
  return { id, role: "assistant", parts } as UIMessage;
}

function textMessage(role: "user" | "assistant", text: string): UIMessage {
  return {
    id: `${role}-1`,
    role,
    parts: [{ type: "text", text }],
  } as UIMessage;
}

function toolPart(
  toolName: string,
  output: unknown,
  state: "output-available" | "output-error" = "output-available",
): UIMessage["parts"][number] {
  return {
    type: `tool-${toolName}`,
    toolCallId: "tool-1",
    state,
    input: {},
    output,
  } as UIMessage["parts"][number];
}

describe("conversation completion", () => {
  it("completes after a successful booking", () => {
    const messages = [
      textMessage("user", "Book it please"),
      assistant([toolPart("book_appointment", { ok: true }), textMessage(
        "assistant",
        "Booked.",
      ).parts[0]]),
    ];

    expect(conversationCompletion(messages)).toEqual({
      messageId: "assistant-1",
    });
  });

  it("completes after reschedule, cancellation, and escalation", () => {
    for (const tool of [
      "reschedule_appointment",
      "cancel_appointment",
      "escalate_to_human",
    ]) {
      expect(
        conversationCompletion([assistant([toolPart(tool, { ok: true })])]),
      ).toEqual({ messageId: "assistant-1" });
    }
  });

  it("does not complete on availability or info lookups", () => {
    expect(
      conversationCompletion([
        assistant([toolPart("get_availability", { ok: true })]),
      ]),
    ).toBeNull();
    expect(
      conversationCompletion([
        assistant([toolPart("get_practice_info", { ok: true })]),
      ]),
    ).toBeNull();
  });

  it("does not complete when the terminal tool failed", () => {
    expect(
      conversationCompletion([
        assistant([toolPart("book_appointment", { ok: false })]),
      ]),
    ).toBeNull();
  });

  it("does not complete when a user message follows", () => {
    expect(
      conversationCompletion([
        assistant([toolPart("book_appointment", { ok: true })]),
        textMessage("user", "One more thing"),
      ]),
    ).toBeNull();
  });

  it("does not complete on text-only messages", () => {
    expect(
      conversationCompletion([textMessage("assistant", "How can I help?")]),
    ).toBeNull();
  });
});
