import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  confirmationReplies,
  slotSelectionMessage,
} from "@/lib/chat/quick-replies";

function assistant(text: string): UIMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    parts: [{ type: "text", text }],
  } as UIMessage;
}

function user(text: string): UIMessage {
  return {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text }],
  } as UIMessage;
}

describe("confirmation quick replies", () => {
  it("offers booking confirmations", () => {
    expect(
      confirmationReplies([assistant("Should I book that for you?")]),
    ).toEqual({
      yes: "Yes, please book it",
      no: "No, show me other times",
    });
  });

  it("offers detail confirmations", () => {
    expect(
      confirmationReplies([assistant("Is that all correct?")]),
    ).toEqual({
      yes: "Yes, that's correct",
      no: "No, let me correct that",
    });
  });

  it("offers cancellation and reschedule confirmations", () => {
    expect(confirmationReplies([assistant("Shall I cancel it?")])).toEqual({
      yes: "Yes, cancel it",
      no: "Keep it as is",
    });
    expect(
      confirmationReplies([assistant("Would you like me to move it?")]),
    ).toEqual({
      yes: "Yes, move it",
      no: "Keep the current time",
    });
  });

  it("does not offer quick replies for open-ended questions", () => {
    expect(
      confirmationReplies([assistant("Which time works best for you?")]),
    ).toBeNull();
    expect(
      confirmationReplies([assistant("Do you have trouble breathing?")]),
    ).toBeNull();
  });

  it("does not offer quick replies when the last message is from the patient", () => {
    expect(
      confirmationReplies([
        assistant("Should I book that for you?"),
        user("Let me think"),
      ]),
    ).toBeNull();
  });

  it("formats a selected slot as a normal message", () => {
    expect(
      slotSelectionMessage("Monday, November 9 at 8:00 AM with Priya Patel"),
    ).toBe(
      "Let's go with Monday, November 9 at 8:00 AM with Priya Patel. Please continue.",
    );
  });
});
