import { z } from "zod";

/**
 * Tool contracts are the only surface the language model may use to read or
 * mutate practice data. Arguments are validated here before any domain service
 * sees them; the domain layer re-validates business rules independently.
 */

export const appointmentTypeSlugSchema = z.enum([
  "cleaning",
  "general_checkup",
  "emergency",
]);

export const alertKindSchema = z.enum(["emergency", "escalation", "callback"]);
export const alertUrgencySchema = z.enum(["low", "medium", "high"]);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "Enter a valid calendar date",
  });

export const isoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    "Use an ISO-8601 UTC timestamp, e.g. 2026-11-10T14:00:00.000Z",
  )
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Enter a valid timestamp",
  });

export const phoneSchema = z
  .string()
  .min(7)
  .max(24)
  .transform((value) => value.replace(/\D/g, ""))
  .refine((digits) => digits.length >= 10 && digits.length <= 15, {
    message: "Enter a valid phone number",
  });

export const fullNameSchema = z.string().trim().min(2).max(120);

export const conversationIdSchema = z.string().min(1).max(120);
export const idempotencyKeySchema = z.string().min(8).max(120);
export const providerIdSchema = z.string().min(1).max(120);
export const patientIdSchema = z.string().min(1).max(120);
export const appointmentIdSchema = z.string().min(1).max(120);

export const findPatientSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  dateOfBirth: isoDateSchema,
});

export const createPatientSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  dateOfBirth: isoDateSchema,
  insuranceName: z.string().trim().max(120).optional(),
  householdName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const getAvailabilitySchema = z
  .object({
    appointmentType: appointmentTypeSlugSchema,
    preferredStartDate: isoDateSchema,
    preferredEndDate: isoDateSchema,
    providerId: providerIdSchema.optional(),
    preferredTimeOfDay: z
      .enum(["morning", "afternoon", "evening", "any"])
      .default("any"),
    limit: z.number().int().min(1).max(12).default(6),
  })
  .refine(
    (value) =>
      Date.parse(`${value.preferredStartDate}T00:00:00Z`) <=
      Date.parse(`${value.preferredEndDate}T00:00:00Z`),
    {
      message: "preferredStartDate must be on or before preferredEndDate",
      path: ["preferredEndDate"],
    },
  );

export const holdSlotSchema = z.object({
  providerId: providerIdSchema,
  appointmentType: appointmentTypeSlugSchema,
  startsAt: isoDateTimeSchema,
  conversationId: conversationIdSchema,
});

export const bookAppointmentSchema = z.object({
  patientId: patientIdSchema,
  providerId: providerIdSchema,
  appointmentType: appointmentTypeSlugSchema,
  startsAt: isoDateTimeSchema,
  conversationId: conversationIdSchema,
  idempotencyKey: idempotencyKeySchema,
  notes: z.string().trim().max(1000).optional(),
  confirmedByPatient: z.literal(true),
});

export const rescheduleAppointmentSchema = z.object({
  appointmentId: appointmentIdSchema,
  newProviderId: providerIdSchema.optional(),
  newStartsAt: isoDateTimeSchema,
  conversationId: conversationIdSchema,
  idempotencyKey: idempotencyKeySchema,
  confirmedByPatient: z.literal(true),
});

export const cancelAppointmentSchema = z.object({
  appointmentId: appointmentIdSchema,
  conversationId: conversationIdSchema,
  reason: z.string().trim().max(500).optional(),
  confirmedByPatient: z.literal(true),
});

export const listAppointmentsSchema = z.object({
  patientId: patientIdSchema,
  includePast: z.boolean().default(false),
});

export const getPracticeInfoSchema = z.object({
  topic: z.enum([
    "hours",
    "location",
    "insurance",
    "no_insurance",
    "membership",
    "financing",
    "emergency",
    "all",
  ]),
});

export const notifyStaffSchema = z.object({
  conversationId: conversationIdSchema,
  patientId: patientIdSchema.optional(),
  appointmentId: appointmentIdSchema.optional(),
  kind: alertKindSchema,
  urgency: alertUrgencySchema,
  summary: z.string().trim().min(5).max(2000),
});

export const escalateToHumanSchema = z.object({
  conversationId: conversationIdSchema,
  reason: z.string().trim().min(3).max(500),
  summary: z.string().trim().min(5).max(2000),
  patientName: fullNameSchema.optional(),
  phone: phoneSchema.optional(),
});

export const toolSchemas = {
  find_patient: findPatientSchema,
  create_patient: createPatientSchema,
  get_availability: getAvailabilitySchema,
  hold_slot: holdSlotSchema,
  book_appointment: bookAppointmentSchema,
  reschedule_appointment: rescheduleAppointmentSchema,
  cancel_appointment: cancelAppointmentSchema,
  list_appointments: listAppointmentsSchema,
  get_practice_info: getPracticeInfoSchema,
  notify_staff: notifyStaffSchema,
  escalate_to_human: escalateToHumanSchema,
} as const;

export type ToolName = keyof typeof toolSchemas;

export type FindPatientInput = z.infer<typeof findPatientSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type GetAvailabilityInput = z.infer<typeof getAvailabilitySchema>;
export type HoldSlotInput = z.infer<typeof holdSlotSchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<
  typeof rescheduleAppointmentSchema
>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type ListAppointmentsInput = z.infer<typeof listAppointmentsSchema>;
export type GetPracticeInfoInput = z.infer<typeof getPracticeInfoSchema>;
export type NotifyStaffInput = z.infer<typeof notifyStaffSchema>;
export type EscalateToHumanInput = z.infer<typeof escalateToHumanSchema>;
