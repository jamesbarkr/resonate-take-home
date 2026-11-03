import { describe, expect, it } from "vitest";
import {
  bookAppointmentSchema,
  getAvailabilitySchema,
  phoneSchema,
  toolSchemas,
} from "@/lib/agent/tool-contracts";

describe("tool contracts", () => {
  it("exposes every model-facing tool", () => {
    expect(Object.keys(toolSchemas).sort()).toEqual([
      "book_appointment",
      "cancel_appointment",
      "create_patient",
      "escalate_to_human",
      "find_patient",
      "get_availability",
      "get_practice_info",
      "hold_slot",
      "list_appointments",
      "notify_staff",
      "reschedule_appointment",
    ]);
  });

  it("normalizes phone numbers to digits", () => {
    expect(phoneSchema.parse("(617) 555-0199")).toBe("6175550199");
    expect(() => phoneSchema.parse("123")).toThrow();
  });

  it("requires explicit patient confirmation before booking", () => {
    const base = {
      patientId: "pat_david",
      providerId: "prov_patel",
      appointmentType: "cleaning" as const,
      startsAt: "2026-11-10T13:00:00.000Z",
      conversationId: "conv_test_1",
      idempotencyKey: "idem_test_1",
    };

    expect(
      bookAppointmentSchema.safeParse({
        ...base,
        confirmedByPatient: false,
      }).success,
    ).toBe(false);

    expect(
      bookAppointmentSchema.safeParse({
        ...base,
        confirmedByPatient: true,
      }).success,
    ).toBe(true);
  });

  it("rejects reversed availability date ranges", () => {
    const result = getAvailabilitySchema.safeParse({
      appointmentType: "cleaning",
      preferredStartDate: "2026-11-14",
      preferredEndDate: "2026-11-09",
    });
    expect(result.success).toBe(false);
  });
});
