import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Data model for the mock dental practice.
 *
 * Notes:
 * - Timestamps are ISO-8601 strings in UTC unless a column name says otherwise.
 * - Patient dates of birth are plain `YYYY-MM-DD` strings.
 * - Availability is stored as recurring provider blocks; concrete slots are
 *   derived at query time so the seed stays small and deterministic.
 */

export const practiceConfig = sqliteTable("practice_config", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  addressLine1: text("address_line_1").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  phone: text("phone").notNull(),
  timezone: text("timezone").notNull(),
  hoursJson: text("hours_json").notNull(),
  insuranceNote: text("insurance_note").notNull(),
  selfPayNote: text("self_pay_note").notNull(),
  membershipNote: text("membership_note").notNull(),
  financingNote: text("financing_note").notNull(),
  emergencyNote: text("emergency_note").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const patients = sqliteTable(
  "patients",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").references(() => households.id),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    dateOfBirth: text("date_of_birth").notNull(),
    insuranceName: text("insurance_name"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("patients_phone_idx").on(table.phone),
    index("patients_household_idx").on(table.householdId),
    index("patients_name_idx").on(table.fullName),
  ],
);

export const insurancePlans = sqliteTable(
  "insurance_plans",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    accepted: integer("accepted", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [uniqueIndex("insurance_plans_name_idx").on(table.name)],
);

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["dentist", "hygienist"] }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const appointmentTypes = sqliteTable(
  "appointment_types",
  {
    id: text("id").primaryKey(),
    slug: text("slug", {
      enum: ["cleaning", "general_checkup", "emergency"],
    }).notNull(),
    name: text("name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    requiredRole: text("required_role", {
      enum: ["dentist", "hygienist"],
    }).notNull(),
    description: text("description").notNull(),
  },
  (table) => [uniqueIndex("appointment_types_slug_idx").on(table.slug)],
);

export const availabilityBlocks = sqliteTable(
  "availability_blocks",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => providers.id),
    // 0 = Sunday ... 6 = Saturday
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
  },
  (table) => [
    index("availability_blocks_provider_day_idx").on(
      table.providerId,
      table.dayOfWeek,
    ),
  ],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    providerId: text("provider_id")
      .notNull()
      .references(() => providers.id),
    appointmentTypeId: text("appointment_type_id")
      .notNull()
      .references(() => appointmentTypes.id),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    status: text("status", {
      enum: ["booked", "cancelled", "completed", "no_show"],
    })
      .notNull()
      .default("booked"),
    notes: text("notes"),
    idempotencyKey: text("idempotency_key"),
    conversationId: text("conversation_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("appointments_idempotency_idx").on(table.idempotencyKey),
    index("appointments_provider_start_idx").on(
      table.providerId,
      table.startsAt,
    ),
    index("appointments_patient_start_idx").on(table.patientId, table.startsAt),
    index("appointments_status_idx").on(table.status),
  ],
);

export const slotHolds = sqliteTable(
  "slot_holds",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => providers.id),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    conversationId: text("conversation_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("slot_holds_provider_start_idx").on(
      table.providerId,
      table.startsAt,
    ),
    index("slot_holds_expiry_idx").on(table.expiresAt),
  ],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id").references(() => patients.id),
    channel: text("channel").notNull().default("web"),
    status: text("status", {
      enum: ["active", "escalated", "closed"],
    })
      .notNull()
      .default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("conversations_patient_idx").on(table.patientId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["user", "assistant", "tool", "system"],
    }).notNull(),
    content: text("content").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const toolCalls = sqliteTable(
  "tool_calls",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    argumentsJson: text("arguments_json").notNull(),
    resultJson: text("result_json"),
    status: text("status", {
      enum: ["pending", "succeeded", "failed"],
    })
      .notNull()
      .default("pending"),
    error: text("error"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("tool_calls_conversation_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const staffAlerts = sqliteTable(
  "staff_alerts",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").references(() => conversations.id),
    patientId: text("patient_id").references(() => patients.id),
    kind: text("kind", {
      enum: ["emergency", "escalation", "callback"],
    }).notNull(),
    urgency: text("urgency", {
      enum: ["low", "medium", "high"],
    })
      .notNull()
      .default("medium"),
    summary: text("summary").notNull(),
    status: text("status", {
      enum: ["open", "acknowledged", "resolved"],
    })
      .notNull()
      .default("open"),
    createdAt: text("created_at").notNull(),
    acknowledgedAt: text("acknowledged_at"),
  },
  (table) => [index("staff_alerts_status_idx").on(table.status, table.createdAt)],
);

export const feedback = sqliteTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: text("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("feedback_conversation_idx").on(table.conversationId)],
);

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type Provider = typeof providers.$inferSelect;
export type AppointmentType = typeof appointmentTypes.$inferSelect;
export type StaffAlert = typeof staffAlerts.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
