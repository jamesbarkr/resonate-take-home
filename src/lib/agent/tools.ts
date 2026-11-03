import { createHash } from "node:crypto";
import { tool } from "ai";
import {
  bookAppointmentSchema,
  cancelAppointmentSchema,
  createPatientSchema,
  escalateToHumanSchema,
  findPatientSchema,
  getAvailabilitySchema,
  getPracticeInfoSchema,
  holdSlotSchema,
  listAppointmentsSchema,
  notifyStaffSchema,
  rescheduleAppointmentSchema,
} from "@/lib/agent/tool-contracts";
import {
  ensureConversation,
  getConversationPatientId,
  logToolCall,
  setConversationPatient,
  setConversationStatus,
} from "@/lib/domain/conversation-service";
import { toSafeToolError } from "@/lib/domain/errors";
import { patientService } from "@/lib/domain/patient-service";
import {
  getPracticeInfoForTopic,
  type PracticeInfoTopic,
} from "@/lib/domain/practice-info";
import {
  describeSlot,
  schedulingService,
} from "@/lib/domain/scheduling-service";
import { staffNotificationService } from "@/lib/domain/staff-notification-service";
import { formatPracticeDateTime } from "@/lib/domain/time";

const holdInputSchema = holdSlotSchema.omit({ conversationId: true });
const bookInputSchema = bookAppointmentSchema.omit({
  conversationId: true,
  idempotencyKey: true,
});
const rescheduleInputSchema = rescheduleAppointmentSchema.omit({
  conversationId: true,
  idempotencyKey: true,
});
const cancelInputSchema = cancelAppointmentSchema.omit({
  conversationId: true,
});
const notifyInputSchema = notifyStaffSchema.omit({ conversationId: true });
const escalateInputSchema = escalateToHumanSchema.omit({
  conversationId: true,
});

function idempotencyKey(
  conversationId: string,
  toolName: string,
  input: unknown,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        conversationId,
        toolName,
        input,
      }),
    )
    .digest("hex")
    .slice(0, 40);
}

async function runTool<T>(
  conversationId: string,
  toolName: string,
  input: unknown,
  execute: () => Promise<T> | T,
): Promise<T | { ok: false; code: string; message: string }> {
  try {
    const result = await execute();
    logToolCall({
      conversationId,
      toolName,
      arguments: input,
      result,
      status: "succeeded",
    });
    return result;
  } catch (error) {
    const safe = toSafeToolError(error);
    logToolCall({
      conversationId,
      toolName,
      arguments: input,
      result: safe,
      status: "failed",
      error: safe.message,
    });
    return safe;
  }
}

function appointmentSummaryWithLabel(
  summary: Awaited<ReturnType<typeof schedulingService.book>>,
) {
  return {
    ...summary,
    startsAtLabel: formatPracticeDateTime(summary.startsAt),
    endsAtLabel: formatPracticeDateTime(summary.endsAt),
  };
}

export function createAgentTools(conversationId: string) {
  ensureConversation(conversationId);

  return {
    find_patient: tool({
      description:
        "Look up an existing patient by full name, phone number, and date of birth. Use this before any existing-patient booking, reschedule, or cancellation. Returns no match instead of confirming whether a phone number exists. Never claim a patient is verified unless this tool returns a match.",
      inputSchema: findPatientSchema,
      execute: async (input) =>
        runTool(conversationId, "find_patient", input, async () => {
          const matches = await patientService.findMatches(input);

          if (matches.length === 0) {
            return {
              ok: true,
              found: false,
            };
          }

          if (matches.length === 1 && matches[0].matchedOn.name) {
            setConversationPatient(conversationId, matches[0].patient.id);
          }

          return {
            ok: true,
            found: true,
            patients: matches.map(({ patient, matchedOn }) => ({
              patientId: patient.id,
              fullName: patient.fullName,
              dateOfBirth: patient.dateOfBirth,
              insuranceName: patient.insuranceName,
              householdId: patient.householdId,
              nameMatches: matchedOn.name,
            })),
          };
        }),
    }),

    create_patient: tool({
      description:
        "Register a new patient after collecting full name, phone number, date of birth, and insurance name (or 'no insurance'). Use this before booking a first appointment. Do not invent information.",
      inputSchema: createPatientSchema,
      execute: async (input) =>
        runTool(conversationId, "create_patient", input, async () => {
          const patient = await patientService.create(input);
          setConversationPatient(conversationId, patient.id);
          return {
            ok: true,
            patientId: patient.id,
            fullName: patient.fullName,
            dateOfBirth: patient.dateOfBirth,
            insuranceName: patient.insuranceName,
            householdId: patient.householdId,
          };
        }),
    }),

    get_availability: tool({
      description:
        "Search real appointment availability for a date range. Use this for every scheduling request, including subjective dates like 'later next week' after resolving them to explicit YYYY-MM-DD dates. Never invent a slot. Returns ISO UTC timestamps that must be passed unchanged to hold_slot or book_appointment.",
      inputSchema: getAvailabilitySchema,
      execute: async (input) =>
        runTool(conversationId, "get_availability", input, async () => {
          const slots = await schedulingService.getAvailability(input);
          return {
            ok: true,
            count: slots.length,
            slots: slots.map((slot) => ({
              providerId: slot.providerId,
              providerName: slot.providerName,
              appointmentType: input.appointmentType,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              label: describeSlot(slot),
            })),
          };
        }),
    }),

    hold_slot: tool({
      description:
        "Temporarily hold a real slot for five minutes while the patient confirms. Requires the providerId, appointmentType, and the exact startsAt returned by get_availability.",
      inputSchema: holdInputSchema,
      execute: async (input) =>
        runTool(conversationId, "hold_slot", input, async () => {
          const hold = await schedulingService.holdSlot({
            providerId: input.providerId,
            appointmentType: input.appointmentType,
            startsAt: input.startsAt,
            conversationId,
          });
          return {
            ok: true,
            holdId: hold.holdId,
            expiresAt: hold.expiresAt,
          };
        }),
    }),

    book_appointment: tool({
      description:
        "Book an appointment. Call ONLY after the patient explicitly confirms the appointment type, provider, and exact date/time. Set confirmedByPatient to true only when that confirmation has just happened. Use the exact startsAt and providerId returned by get_availability.",
      inputSchema: bookInputSchema,
      execute: async (input) =>
        runTool(conversationId, "book_appointment", input, async () => {
          const summary = await schedulingService.book({
            ...input,
            conversationId,
            idempotencyKey: idempotencyKey(
              conversationId,
              "book_appointment",
              input,
            ),
          });
          setConversationPatient(conversationId, input.patientId);
          return {
            ok: true,
            appointment: appointmentSummaryWithLabel(summary),
          };
        }),
    }),

    reschedule_appointment: tool({
      description:
        "Move an existing booked appointment. Call ONLY after the patient confirms the new date/time. Set confirmedByPatient to true only after that confirmation.",
      inputSchema: rescheduleInputSchema,
      execute: async (input) =>
        runTool(conversationId, "reschedule_appointment", input, async () => {
          const summary = await schedulingService.reschedule({
            ...input,
            conversationId,
            idempotencyKey: idempotencyKey(
              conversationId,
              "reschedule_appointment",
              input,
            ),
          });
          return {
            ok: true,
            appointment: appointmentSummaryWithLabel(summary),
          };
        }),
    }),

    cancel_appointment: tool({
      description:
        "Cancel an existing booked appointment. Call ONLY after the patient explicitly confirms the cancellation. Set confirmedByPatient to true only after that confirmation.",
      inputSchema: cancelInputSchema,
      execute: async (input) =>
        runTool(conversationId, "cancel_appointment", input, async () => {
          const summary = await schedulingService.cancel({
            appointmentId: input.appointmentId,
            conversationId,
            reason: input.reason,
          });
          return {
            ok: true,
            appointment: appointmentSummaryWithLabel(summary),
          };
        }),
    }),

    list_appointments: tool({
      description:
        "List a verified patient's appointments. Use after find_patient to let an existing patient choose which appointment to reschedule or cancel.",
      inputSchema: listAppointmentsSchema,
      execute: async (input) =>
        runTool(conversationId, "list_appointments", input, async () => {
          const summaries = await schedulingService.listForPatient(
            input.patientId,
            input.includePast,
          );
          return {
            ok: true,
            count: summaries.length,
            appointments: summaries.map(appointmentSummaryWithLabel),
          };
        }),
    }),

    get_practice_info: tool({
      description:
        "Get authoritative practice information about hours, location, accepted insurance, self-pay and membership options, financing, or emergency guidance. Use this instead of guessing.",
      inputSchema: getPracticeInfoSchema,
      execute: async (input) =>
        runTool(conversationId, "get_practice_info", input, () =>
          ({
            ok: true,
            topic: input.topic,
            info: getPracticeInfoForTopic(input.topic as PracticeInfoTopic),
          }) as const,
        ),
    }),

    notify_staff: tool({
      description:
        "Send an alert to the dental office staff. Use for every emergency with a concise summary of the concern and urgency. Also use for escalations or callback requests. This creates a real staff-console alert.",
      inputSchema: notifyInputSchema,
      execute: async (input) =>
        runTool(conversationId, "notify_staff", input, async () => {
          const alert = await staffNotificationService.notify({
            ...input,
            conversationId,
            patientId:
              input.patientId ?? getConversationPatientId(conversationId) ?? undefined,
          });
          return {
            ok: true,
            alertId: alert.id,
            notified: true,
          };
        }),
    }),

    escalate_to_human: tool({
      description:
        "Escalate the conversation to a human at the front desk when the request is outside your scope, the patient asks for a person, or a tool failure prevents safe completion. Creates a staff alert and marks the conversation escalated.",
      inputSchema: escalateInputSchema,
      execute: async (input) =>
        runTool(conversationId, "escalate_to_human", input, async () => {
          const alert = await staffNotificationService.notify({
            conversationId,
            patientId:
              getConversationPatientId(conversationId) ?? undefined,
            kind: "escalation",
            urgency: "high",
            summary: `Reason: ${input.reason}. ${input.summary}${
              input.patientName ? ` Patient: ${input.patientName}.` : ""
            }${input.phone ? ` Phone: ${input.phone}.` : ""}`,
          });
          setConversationStatus(conversationId, "escalated");
          return {
            ok: true,
            alertId: alert.id,
            escalated: true,
          };
        }),
    }),
  };
}

export type AgentTools = ReturnType<typeof createAgentTools>;
