import { eq } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";
import { createAgentTools } from "@/lib/agent/tools";
import { db } from "@/lib/db/client";
import { staffAlerts, toolCalls } from "@/lib/db/schema";
import { getConversationDetail } from "@/lib/domain/conversation-service";
import {
  addDaysToDateString,
  practiceDateString,
} from "@/lib/domain/time";
import { useTestDatabase } from "./helpers/db";

useTestDatabase();

const options = {
  toolCallId: "test-tool-call",
  messages: [] as ModelMessage[],
};

type ExecutableTool = {
  execute?: (
    input: unknown,
    options: { toolCallId: string; messages: ModelMessage[] },
  ) => unknown;
};

async function execute(
  tools: ReturnType<typeof createAgentTools>,
  name: keyof ReturnType<typeof createAgentTools>,
  input: unknown,
): Promise<Record<string, unknown>> {
  const tool = (tools as unknown as Record<string, ExecutableTool>)[name];
  if (!tool?.execute) throw new Error(`tool ${name} has no execute`);
  return (await tool.execute(input, options)) as Record<string, unknown>;
}

function nextWeek() {
  const start = addDaysToDateString(practiceDateString(), 7);
  return { start, end: addDaysToDateString(start, 6) };
}

describe("agent tools", () => {
  it("finds an existing patient and logs the tool call", async () => {
    const tools = createAgentTools("conv_tools_find");
    const result = await execute(tools, "find_patient", {
      fullName: "David Johnson",
      phone: "6175550101",
      dateOfBirth: "1985-04-12",
    });

    expect(result.found).toBe(true);
    const patients = result.patients as Array<{ patientId: string }>;
    expect(patients[0].patientId).toBe("pat_david");

    const logs = db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.conversationId, "conv_tools_find"))
      .all();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].toolName).toBe("find_patient");
  });

  it("creates a new patient", async () => {
    const tools = createAgentTools("conv_tools_create");
    const result = await execute(tools, "create_patient", {
      fullName: "Jamie Rivera",
      phone: "6175550177",
      dateOfBirth: "1991-06-02",
      insuranceName: "no insurance",
      householdName: "Rivera Family",
    });

    expect(result.ok).toBe(true);
    expect(typeof result.patientId).toBe("string");
  });

  it("searches availability, holds a slot, and books it", async () => {
    const tools = createAgentTools("conv_tools_book");
    const { start, end } = nextWeek();

    const availability = await execute(tools, "get_availability", {
      appointmentType: "cleaning",
      preferredStartDate: start,
      preferredEndDate: end,
      limit: 2,
    });
    const slots = availability.slots as Array<{
      providerId: string;
      startsAt: string;
    }>;
    expect(slots.length).toBeGreaterThan(0);

    const hold = await execute(tools, "hold_slot", {
      providerId: slots[0].providerId,
      appointmentType: "cleaning",
      startsAt: slots[0].startsAt,
    });
    expect(hold.ok).toBe(true);

    await execute(tools, "find_patient", {
      fullName: "David Johnson",
      phone: "6175550101",
      dateOfBirth: "1985-04-12",
    });

    const booking = await execute(tools, "book_appointment", {
      patientId: "pat_david",
      providerId: slots[0].providerId,
      appointmentType: "cleaning",
      startsAt: slots[0].startsAt,
      confirmedByPatient: true,
    });
    expect(booking.ok).toBe(true);
    const appointment = booking.appointment as { status: string };
    expect(appointment.status).toBe("booked");
  });

  it("lists, reschedules, and cancels a patient appointment", async () => {
    const tools = createAgentTools("conv_tools_manage");
    const { start, end } = nextWeek();
    const availability = await execute(tools, "get_availability", {
      appointmentType: "cleaning",
      preferredStartDate: start,
      preferredEndDate: end,
      limit: 3,
    });
    const slots = availability.slots as Array<{
      providerId: string;
      startsAt: string;
    }>;

    await execute(tools, "find_patient", {
      fullName: "Maria Lopez",
      phone: "6175550102",
      dateOfBirth: "1990-11-30",
    });

    const booking = await execute(tools, "book_appointment", {
      patientId: "pat_maria",
      providerId: slots[0].providerId,
      appointmentType: "cleaning",
      startsAt: slots[0].startsAt,
      confirmedByPatient: true,
    });
    const appointmentId = (booking.appointment as { id: string }).id;

    const list = await execute(tools, "list_appointments", {
      patientId: "pat_maria",
    });
    expect((list.appointments as unknown[]).length).toBeGreaterThan(0);

    const moved = await execute(tools, "reschedule_appointment", {
      appointmentId,
      newProviderId: slots[1].providerId,
      newStartsAt: slots[1].startsAt,
      confirmedByPatient: true,
    });
    expect(moved.ok).toBe(true);

    const cancelled = await execute(tools, "cancel_appointment", {
      appointmentId,
      confirmedByPatient: true,
      reason: "test cancellation",
    });
    expect(cancelled.ok).toBe(true);
    expect((cancelled.appointment as { status: string }).status).toBe(
      "cancelled",
    );
  });

  it("keeps model-facing guidance out of successful tool outputs", async () => {
    const tools = createAgentTools("conv_tools_clean");
    const { start, end } = nextWeek();

    const found = await execute(tools, "find_patient", {
      fullName: "David Johnson",
      phone: "6175550101",
      dateOfBirth: "1985-04-12",
    });
    const availability = await execute(tools, "get_availability", {
      appointmentType: "cleaning",
      preferredStartDate: start,
      preferredEndDate: end,
      limit: 1,
    });
    const alert = await execute(tools, "notify_staff", {
      kind: "callback",
      urgency: "low",
      summary: "Patient asked for a callback about insurance.",
    });

    expect(found).not.toHaveProperty("message");
    expect(availability).not.toHaveProperty("message");
    expect(alert).not.toHaveProperty("message");
    expect(alert.notified).toBe(true);
  });

  it("rejects access to an unverified patient or appointment", async () => {
    const tools = createAgentTools("conv_tools_forbidden");

    const list = await execute(tools, "list_appointments", {
      patientId: "pat_david",
    });
    expect(list.ok).toBe(false);
    expect(list.code).toBe("FORBIDDEN");

    const reschedule = await execute(tools, "reschedule_appointment", {
      appointmentId: "appt_david_cleaning",
      newStartsAt: "2030-01-01T14:00:00.000Z",
      confirmedByPatient: true,
    });
    expect(reschedule.ok).toBe(false);
    expect(reschedule.code).toBe("FORBIDDEN");

    const cancel = await execute(tools, "cancel_appointment", {
      appointmentId: "appt_david_cleaning",
      confirmedByPatient: true,
    });
    expect(cancel.ok).toBe(false);
    expect(cancel.code).toBe("FORBIDDEN");
  });

  it("returns safe errors for invalid bookings", async () => {
    const tools = createAgentTools("conv_tools_error");
    const { start } = nextWeek();
    await execute(tools, "find_patient", {
      fullName: "David Johnson",
      phone: "6175550101",
      dateOfBirth: "1985-04-12",
    });
    const result = await execute(tools, "book_appointment", {
      patientId: "pat_david",
      providerId: "prov_patel",
      appointmentType: "cleaning",
      startsAt: `${start}T03:00:00.000Z`,
      confirmedByPatient: true,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("OUTSIDE_HOURS");
  });

  it("notifies staff and records an emergency alert", async () => {
    const tools = createAgentTools("conv_tools_alert");
    await execute(tools, "find_patient", {
      fullName: "David Johnson",
      phone: "6175550101",
      dateOfBirth: "1985-04-12",
    });
    const result = await execute(tools, "notify_staff", {
      patientId: "pat_david",
      kind: "emergency",
      urgency: "high",
      summary: "Severe pain and facial swelling after a fall.",
    });

    expect(result.ok).toBe(true);
    const alerts = db.select().from(staffAlerts).all();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("emergency");
    expect(alerts[0].urgency).toBe("high");
  });

  it("escalates to a human and marks the conversation escalated", async () => {
    const tools = createAgentTools("conv_tools_escalate");
    const result = await execute(tools, "escalate_to_human", {
      reason: "Patient asked for a person",
      summary: "Caller wants to discuss a billing question.",
      patientName: "David Johnson",
      phone: "6175550101",
    });

    expect(result.ok).toBe(true);
    const detail = getConversationDetail("conv_tools_escalate");
    expect(detail?.conversation.status).toBe("escalated");
    expect(detail?.alerts.some((alert) => alert.kind === "escalation")).toBe(
      true,
    );
  });
});
