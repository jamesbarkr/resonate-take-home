import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { appointments } from "@/lib/db/schema";
import { schedulingService } from "@/lib/domain/scheduling-service";
import {
  addDaysToDateString,
  localDateTimeToIso,
  overlaps,
  practiceDateString,
} from "@/lib/domain/time";
import { useTestDatabase } from "./helpers/db";

useTestDatabase();

function nextWeekRange() {
  const start = addDaysToDateString(practiceDateString(), 7);
  return { start, end: addDaysToDateString(start, 6) };
}

async function cleaningSlots(limit = 6) {
  const { start, end } = nextWeekRange();
  return schedulingService.getAvailability({
    appointmentType: "cleaning",
    preferredStartDate: start,
    preferredEndDate: end,
    limit,
  });
}

function booking(
  slot: Awaited<ReturnType<typeof cleaningSlots>>[number],
  overrides: Partial<{
    patientId: string;
    conversationId: string;
    idempotencyKey: string;
  }> = {},
) {
  return {
    patientId: overrides.patientId ?? "pat_david",
    providerId: slot.providerId,
    appointmentType: "cleaning" as const,
    startsAt: slot.startsAt,
    conversationId: overrides.conversationId ?? "conv_booking_test",
    idempotencyKey: overrides.idempotencyKey ?? `idem_${slot.startsAt}`,
  };
}

describe("scheduling service", () => {
  it("returns real slots inside practice hours with the right duration", async () => {
    const slots = await cleaningSlots();
    expect(slots.length).toBeGreaterThan(0);

    for (const slot of slots) {
      expect(slot.provider.role).toBe("hygienist");
      expect(
        Date.parse(slot.endsAt) - Date.parse(slot.startsAt),
      ).toBe(45 * 60_000);
      expect(slot.startsAt).toMatch(/Z$/);
    }
  });

  it("books a slot and is idempotent for the same key", async () => {
    const [slot] = await cleaningSlots(1);
    const first = await schedulingService.book(
      booking(slot, { idempotencyKey: "idem_same_key" }),
    );
    const second = await schedulingService.book(
      booking(slot, { idempotencyKey: "idem_same_key" }),
    );

    expect(second.id).toBe(first.id);
    expect(first.status).toBe("booked");

    const rows = db
      .select()
      .from(appointments)
      .where(eq(appointments.idempotencyKey, "idem_same_key"))
      .all();
    expect(rows).toHaveLength(1);
  });

  it("rejects a double booking for a taken slot", async () => {
    const [slot] = await cleaningSlots(1);
    await schedulingService.book(
      booking(slot, { conversationId: "conv_a", idempotencyKey: "idem_a" }),
    );

    await expect(
      schedulingService.book(
        booking(slot, { conversationId: "conv_b", idempotencyKey: "idem_b" }),
      ),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("allows only one winner under concurrent booking attempts", async () => {
    const [slot] = await cleaningSlots(1);
    const results = await Promise.allSettled([
      schedulingService.book(
        booking(slot, { conversationId: "conv_c", idempotencyKey: "idem_c" }),
      ),
      schedulingService.book(
        booking(slot, { conversationId: "conv_d", idempotencyKey: "idem_d" }),
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(
      1,
    );
  });

  it("holds a slot for one conversation and blocks another", async () => {
    const [slot] = await cleaningSlots(1);
    await schedulingService.holdSlot({
      providerId: slot.providerId,
      appointmentType: "cleaning",
      startsAt: slot.startsAt,
      conversationId: "conv_holder",
    });

    await expect(
      schedulingService.book(
        booking(slot, {
          conversationId: "conv_other",
          idempotencyKey: "idem_other",
        }),
      ),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });

    const booked = await schedulingService.book(
      booking(slot, {
        conversationId: "conv_holder",
        idempotencyKey: "idem_holder",
      }),
    );
    expect(booked.status).toBe("booked");
  });

  it("rejects times outside practice hours", async () => {
    const { start } = nextWeekRange();
    await expect(
      schedulingService.book({
        patientId: "pat_david",
        providerId: "prov_patel",
        appointmentType: "cleaning",
        startsAt: localDateTimeToIso(start, "03:00"),
        conversationId: "conv_outside",
        idempotencyKey: "idem_outside",
      }),
    ).rejects.toMatchObject({ code: "OUTSIDE_HOURS" });
  });

  it("rejects a provider who is not qualified for the appointment type", async () => {
    const [slot] = await cleaningSlots(1);
    await expect(
      schedulingService.book({
        ...booking(slot),
        providerId: "prov_chen",
        idempotencyKey: "idem_wrong_provider",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_QUALIFIED" });
  });

  it("reschedules and then cancels an appointment, freeing the slot", async () => {
    const slots = await cleaningSlots(2);
    const [first, second] = slots;
    const booked = await schedulingService.book(
      booking(first, { idempotencyKey: "idem_resched" }),
    );

    const moved = await schedulingService.reschedule({
      appointmentId: booked.id,
      newProviderId: second.providerId,
      newStartsAt: second.startsAt,
      conversationId: "conv_booking_test",
      idempotencyKey: "idem_resched_2",
    });
    expect(moved.startsAt).toBe(second.startsAt);

    const cancelled = await schedulingService.cancel({
      appointmentId: booked.id,
      conversationId: "conv_booking_test",
      reason: "schedule conflict",
    });
    expect(cancelled.status).toBe("cancelled");

    const rebooked = await schedulingService.book(
      booking(first, {
        conversationId: "conv_rebook",
        idempotencyKey: "idem_rebook",
      }),
    );
    expect(rebooked.status).toBe("booked");
  });

  it("books back-to-back family appointments without overlap", async () => {
    const slots = await cleaningSlots(2);
    const [first, second] = slots;
    const david = await schedulingService.book(
      booking(first, {
        patientId: "pat_david",
        conversationId: "conv_family",
        idempotencyKey: "idem_family_1",
      }),
    );
    const sarah = await schedulingService.book(
      booking(second, {
        patientId: "pat_sarah",
        conversationId: "conv_family",
        idempotencyKey: "idem_family_2",
      }),
    );

    expect(david.status).toBe("booked");
    expect(sarah.status).toBe("booked");
    expect(
      overlaps(david.startsAt, david.endsAt, sarah.startsAt, sarah.endsAt),
    ).toBe(false);
  });

  it("lists a patient's upcoming appointments", async () => {
    const [slot] = await cleaningSlots(1);
    await schedulingService.book(
      booking(slot, { idempotencyKey: "idem_list" }),
    );

    const list = await schedulingService.listForPatient("pat_david", false);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((appointment) => appointment.status === "booked")).toBe(
      true,
    );
  });
});
