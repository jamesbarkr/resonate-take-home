import { describe, expect, it } from "vitest";
import { slotSelectionMessage } from "@/lib/chat/quick-replies";

describe("slot selection", () => {
  it("formats a selected slot as a normal message", () => {
    expect(
      slotSelectionMessage("Monday, November 9 at 8:00 AM with Priya Patel"),
    ).toBe(
      "Let's go with Monday, November 9 at 8:00 AM with Priya Patel. Please continue.",
    );
  });
});
