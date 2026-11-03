import { randomUUID } from "node:crypto";
import { and, eq, gt, gte, inArray, lt, lte, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  appointments,
  availabilityBlocks,
  slotHolds,
} from "@/lib/db/schema";
import { DomainError } from "@/lib/domain/errors";
import type {
  AppointmentSummary,
  AvailabilityQuery,
  AvailabilitySlot,
  BookingRequest,
  RescheduleRequest,
  SchedulingService,
} from "@/lib/domain/ports";
import {
  addDaysToDateString,
  dateRange,
  dayOfWeekForDateString,
  formatPracticeDateTime,
  isFutureIso,
  localDateTimeToIso,
  minutesToTime,
  overlaps,
  practiceDateFromIso,
  practiceTimeFromIso,
  timeToMinutes,
} from "@/lib/domain/time";
import {
  getAppointmentRecord,
  getAppointmentSummaryRecord,
  getAppointmentTypeById,
  getAppointmentTypeBySlug,
  getProviderById,
  listActiveHolds,
  listActiveProviders,
  listAppointmentSummaryRecordsForPatient,
  listBlocksForProviders,
  listBookedAppointments,
} from "@/lib/repositories/scheduling-repository";

const HOLD_MINUTES = 5;
const MIN_LEAD_MINUTES = 30;

function toSummary(record: NonNullable<ReturnType<typeof getAppointmentSummaryRecord>>): AppointmentSummary {
  return {
    id: record.appointment.id,
    patientId: record.appointment.patientId,
    patientName: record.patientName,
    providerId: record.appointment.providerId,
    providerName: record.providerName,
    appointmentType: record.appointment.appointmentTypeId.replace(
      /^type_/,
      "",
    ) as AppointmentSummary["appointmentType"],
    appointmentTypeName: record.appointmentTypeName,
    startsAt: record.appointment.startsAt,
    endsAt: record.appointment.endsAt,
    status: record.appointment.status,
    notes: record.appointment.notes,
  };
}

function timeOfDayForMinutes(minutes: number): "morning" | "afternoon" | "evening" {
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  return "evening";
}

function slotFitsBlock(
  blocks: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  dayOfWeek: number,
  startMinute: number,
  durationMinutes: number,
): boolean {
  return blocks.some((block) => {
    if (block.dayOfWeek !== dayOfWeek) return false;
    const blockStart = timeToMinutes(block.startTime);
    const blockEnd = timeToMinutes(block.endTime);
    return (
      startMinute >= blockStart &&
      startMinute + durationMinutes <= blockEnd &&
      (startMinute - blockStart) % durationMinutes === 0
    );
  });
}

export class SqliteSchedulingService implements SchedulingService {
  async getAvailability(query: AvailabilityQuery): Promise<AvailabilitySlot[]> {
    const appointmentType = getAppointmentTypeBySlug(query.appointmentType);
    if (!appointmentType) {
      throw new DomainError(
        "UNKNOWN_APPOINTMENT_TYPE",
        "I could not find that appointment type.",
      );
    }

    const days = dateRange(
      query.preferredStartDate,
      query.preferredEndDate,
    );
    if (days.length === 0) {
      throw new DomainError(
        "INVALID_INPUT",
        "Please provide a start date on or before the end date.",
      );
    }
    if (days.length > 60) {
      throw new DomainError(
        "INVALID_INPUT",
        "I can search availability up to 60 days at a time.",
      );
    }

    const providerRows = listActiveProviders(
      appointmentType.requiredRole,
    ).filter(
      (provider) => !query.providerId || provider.id === query.providerId,
    );
    if (providerRows.length === 0) return [];

    const providerIds = providerRows.map((provider) => provider.id);
    const providerById = new Map(
      providerRows.map((provider) => [provider.id, provider]),
    );
    const blocks = listBlocksForProviders(providerIds);
    const fromIso = localDateTimeToIso(query.preferredStartDate, "00:00");
    const toIso = localDateTimeToIso(
      addDaysToDateString(query.preferredEndDate, 1),
      "00:00",
    );
    const nowIso = new Date().toISOString();
    const booked = listBookedAppointments(providerIds, fromIso, toIso);
    const holds = listActiveHolds(providerIds, nowIso, fromIso, toIso);

    const slots: AvailabilitySlot[] = [];

    for (const date of days) {
      const dayOfWeek = dayOfWeekForDateString(date);
      const dayBlocks = blocks.filter((block) => block.dayOfWeek === dayOfWeek);

      for (const block of dayBlocks) {
        const provider = providerById.get(block.providerId);
        if (!provider) continue;

        const blockStart = timeToMinutes(block.startTime);
        const blockEnd = timeToMinutes(block.endTime);

        for (
          let startMinute = blockStart;
          startMinute + appointmentType.durationMinutes <= blockEnd;
          startMinute += appointmentType.durationMinutes
        ) {
          const startsAt = localDateTimeToIso(date, minutesToTime(startMinute));
          const endsAt = new Date(
            Date.parse(startsAt) + appointmentType.durationMinutes * 60_000,
          ).toISOString();

          if (!isFutureIso(startsAt, MIN_LEAD_MINUTES)) continue;

          if (
            query.preferredTimeOfDay &&
            query.preferredTimeOfDay !== "any" &&
            timeOfDayForMinutes(startMinute) !== query.preferredTimeOfDay
          ) {
            continue;
          }

          const blocked = [...booked, ...holds].some((item) =>
            overlaps(startsAt, endsAt, item.startsAt, item.endsAt),
          );
          if (blocked) continue;

          slots.push({
            providerId: provider.id,
            providerName: provider.name,
            provider,
            appointmentType,
            startsAt,
            endsAt,
          });
        }
      }
    }

    return slots
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, query.limit ?? 6);
  }

  async holdSlot(input: {
    providerId: string;
    appointmentType: string;
    startsAt: string;
    conversationId: string;
  }): Promise<{ holdId: string; expiresAt: string }> {
    const appointmentType = getAppointmentTypeBySlug(
      input.appointmentType as AvailabilityQuery["appointmentType"],
    );
    if (!appointmentType) {
      throw new DomainError(
        "UNKNOWN_APPOINTMENT_TYPE",
        "I could not find that appointment type.",
      );
    }

    const provider = getProviderById(input.providerId);
    if (!provider || !provider.active) {
      throw new DomainError(
        "INVALID_INPUT",
        "I could not find that provider.",
      );
    }
    if (provider.role !== appointmentType.requiredRole) {
      throw new DomainError(
        "PROVIDER_NOT_QUALIFIED",
        `${provider.name} is not the right provider for that appointment type.`,
      );
    }

    const startsAt = input.startsAt;
    const endsAt = new Date(
      Date.parse(startsAt) + appointmentType.durationMinutes * 60_000,
    ).toISOString();
    const date = practiceDateFromIso(startsAt);
    const startMinute = timeToMinutes(practiceTimeFromIso(startsAt));
    const dayOfWeek = dayOfWeekForDateString(date);
    const blocks = listBlocksForProviders([provider.id]);

    if (
      !slotFitsBlock(
        blocks,
        dayOfWeek,
        startMinute,
        appointmentType.durationMinutes,
      )
    ) {
      throw new DomainError(
        "OUTSIDE_HOURS",
        "That time is outside the practice's available hours.",
      );
    }

    if (!isFutureIso(startsAt, MIN_LEAD_MINUTES)) {
      throw new DomainError(
        "OUTSIDE_HOURS",
        "That slot is too soon to reserve online. Please call the office.",
      );
    }

    const result = db.transaction((tx) => {
      const nowIso = new Date().toISOString();
      tx.delete(slotHolds).where(lte(slotHolds.expiresAt, nowIso)).run();

      const appointmentConflict = tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.providerId, provider.id),
            inArray(appointments.status, ["booked", "completed"]),
            lt(appointments.startsAt, endsAt),
            gt(appointments.endsAt, startsAt),
          ),
        )
        .get();

      if (appointmentConflict) {
        throw new DomainError(
          "SLOT_UNAVAILABLE",
          "That time was just taken. I can offer the next closest options.",
        );
      }

      const holdConflict = tx
        .select()
        .from(slotHolds)
        .where(
          and(
            eq(slotHolds.providerId, provider.id),
            gte(slotHolds.expiresAt, nowIso),
            lt(slotHolds.startsAt, endsAt),
            gt(slotHolds.endsAt, startsAt),
          ),
        )
        .all()
        .find((hold) => hold.conversationId !== input.conversationId);

      if (holdConflict) {
        throw new DomainError(
          "SLOT_UNAVAILABLE",
          "Someone else is holding that time right now. I can offer alternatives.",
        );
      }

      const existing = tx
        .select()
        .from(slotHolds)
        .where(
          and(
            eq(slotHolds.providerId, provider.id),
            eq(slotHolds.startsAt, startsAt),
          ),
        )
        .get();

      if (existing) {
        return { holdId: existing.id, expiresAt: existing.expiresAt };
      }

      const expiresAt = new Date(
        Date.now() + HOLD_MINUTES * 60_000,
      ).toISOString();
      const holdId = `hold_${randomUUID()}`;

      tx.insert(slotHolds)
        .values({
          id: holdId,
          providerId: provider.id,
          startsAt,
          endsAt,
          conversationId: input.conversationId,
          expiresAt,
          createdAt: nowIso,
        })
        .run();

      return { holdId, expiresAt };
    });

    return result;
  }

  async book(request: BookingRequest): Promise<AppointmentSummary> {
    const appointmentType = getAppointmentTypeBySlug(request.appointmentType);
    if (!appointmentType) {
      throw new DomainError(
        "UNKNOWN_APPOINTMENT_TYPE",
        "I could not find that appointment type.",
      );
    }

    const provider = getProviderById(request.providerId);
    if (!provider || !provider.active) {
      throw new DomainError("INVALID_INPUT", "I could not find that provider.");
    }
    if (provider.role !== appointmentType.requiredRole) {
      throw new DomainError(
        "PROVIDER_NOT_QUALIFIED",
        `${provider.name} is not the right provider for that appointment type.`,
      );
    }

    const startsAt = request.startsAt;
    const endsAt = new Date(
      Date.parse(startsAt) + appointmentType.durationMinutes * 60_000,
    ).toISOString();
    const date = practiceDateFromIso(startsAt);
    const startMinute = timeToMinutes(practiceTimeFromIso(startsAt));
    const dayOfWeek = dayOfWeekForDateString(date);
    const blocks = listBlocksForProviders([provider.id]);

    if (
      !slotFitsBlock(
        blocks,
        dayOfWeek,
        startMinute,
        appointmentType.durationMinutes,
      )
    ) {
      throw new DomainError(
        "OUTSIDE_HOURS",
        "That time is outside the practice's available hours.",
      );
    }

    if (!isFutureIso(startsAt, MIN_LEAD_MINUTES)) {
      throw new DomainError(
        "OUTSIDE_HOURS",
        "That slot is too soon to book online. Please call the office.",
      );
    }

    const appointmentId = db.transaction((tx) => {
      const nowIso = new Date().toISOString();
      tx.delete(slotHolds).where(lte(slotHolds.expiresAt, nowIso)).run();

      const existingByIdempotency = tx
        .select()
        .from(appointments)
        .where(eq(appointments.idempotencyKey, request.idempotencyKey))
        .get();
      if (existingByIdempotency) return existingByIdempotency.id;

      const appointmentConflict = tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.providerId, provider.id),
            inArray(appointments.status, ["booked", "completed"]),
            lt(appointments.startsAt, endsAt),
            gt(appointments.endsAt, startsAt),
          ),
        )
        .get();

      if (appointmentConflict) {
        throw new DomainError(
          "SLOT_UNAVAILABLE",
          "That time was just taken. I can offer the next closest options.",
        );
      }

      const holdConflict = tx
        .select()
        .from(slotHolds)
        .where(
          and(
            eq(slotHolds.providerId, provider.id),
            gte(slotHolds.expiresAt, nowIso),
            lt(slotHolds.startsAt, endsAt),
            gt(slotHolds.endsAt, startsAt),
          ),
        )
        .all()
        .find((hold) => hold.conversationId !== request.conversationId);

      if (holdConflict) {
        throw new DomainError(
          "SLOT_UNAVAILABLE",
          "Someone else is holding that time right now. I can offer alternatives.",
        );
      }

      const id = `appt_${randomUUID()}`;
      tx.insert(appointments)
        .values({
          id,
          patientId: request.patientId,
          providerId: provider.id,
          appointmentTypeId: appointmentType.id,
          startsAt,
          endsAt,
          status: "booked",
          notes: request.notes ?? null,
          idempotencyKey: request.idempotencyKey,
          conversationId: request.conversationId,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .run();

      tx.delete(slotHolds)
        .where(
          and(
            eq(slotHolds.providerId, provider.id),
            eq(slotHolds.startsAt, startsAt),
          ),
        )
        .run();

      return id;
    });

    return this.getSummary(appointmentId);
  }

  async reschedule(request: RescheduleRequest): Promise<AppointmentSummary> {
    const appointment = getAppointmentRecord(request.appointmentId);
    if (!appointment) {
      throw new DomainError(
        "APPOINTMENT_NOT_FOUND",
        "I could not find that appointment.",
      );
    }
    if (appointment.status !== "booked") {
      throw new DomainError(
        "APPOINTMENT_NOT_EDITABLE",
        "That appointment is no longer editable.",
      );
    }

    const appointmentType = getAppointmentTypeById(
      appointment.appointmentTypeId,
    );
    if (!appointmentType) {
      throw new DomainError(
        "UNKNOWN_APPOINTMENT_TYPE",
        "I could not find that appointment type.",
      );
    }

    const providerId = request.newProviderId ?? appointment.providerId;
    const provider = getProviderById(providerId);
    if (!provider || !provider.active) {
      throw new DomainError("INVALID_INPUT", "I could not find that provider.");
    }
    if (provider.role !== appointmentType.requiredRole) {
      throw new DomainError(
        "PROVIDER_NOT_QUALIFIED",
        `${provider.name} is not the right provider for that appointment type.`,
      );
    }

    const startsAt = request.newStartsAt;
    const endsAt = new Date(
      Date.parse(startsAt) + appointmentType.durationMinutes * 60_000,
    ).toISOString();
    const date = practiceDateFromIso(startsAt);
    const startMinute = timeToMinutes(practiceTimeFromIso(startsAt));
    const dayOfWeek = dayOfWeekForDateString(date);
    const blocks = listBlocksForProviders([provider.id]);

    if (
      !slotFitsBlock(
        blocks,
        dayOfWeek,
        startMinute,
        appointmentType.durationMinutes,
      )
    ) {
      throw new DomainError(
        "OUTSIDE_HOURS",
        "That time is outside the practice's available hours.",
      );
    }

    if (!isFutureIso(startsAt, MIN_LEAD_MINUTES)) {
      throw new DomainError(
        "OUTSIDE_HOURS",
        "That slot is too soon to book online. Please call the office.",
      );
    }

    db.transaction((tx) => {
      const nowIso = new Date().toISOString();
      tx.delete(slotHolds).where(lte(slotHolds.expiresAt, nowIso)).run();

      const existingByIdempotency = tx
        .select()
        .from(appointments)
        .where(eq(appointments.idempotencyKey, request.idempotencyKey))
        .get();
      if (existingByIdempotency) {
        if (existingByIdempotency.id !== appointment.id) {
          throw new DomainError(
            "IDEMPOTENCY_CONFLICT",
            "That request was already used for a different appointment.",
          );
        }
        return;
      }

      const appointmentConflict = tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.providerId, provider.id),
            ne(appointments.id, appointment.id),
            inArray(appointments.status, ["booked", "completed"]),
            lt(appointments.startsAt, endsAt),
            gt(appointments.endsAt, startsAt),
          ),
        )
        .get();

      if (appointmentConflict) {
        throw new DomainError(
          "SLOT_UNAVAILABLE",
          "That time was just taken. I can offer the next closest options.",
        );
      }

      const holdConflict = tx
        .select()
        .from(slotHolds)
        .where(
          and(
            eq(slotHolds.providerId, provider.id),
            gte(slotHolds.expiresAt, nowIso),
            lt(slotHolds.startsAt, endsAt),
            gt(slotHolds.endsAt, startsAt),
          ),
        )
        .all()
        .find((hold) => hold.conversationId !== request.conversationId);

      if (holdConflict) {
        throw new DomainError(
          "SLOT_UNAVAILABLE",
          "Someone else is holding that time right now. I can offer alternatives.",
        );
      }

      tx.update(appointments)
        .set({
          providerId: provider.id,
          startsAt,
          endsAt,
          idempotencyKey: request.idempotencyKey,
          updatedAt: nowIso,
        })
        .where(eq(appointments.id, appointment.id))
        .run();

      tx.delete(slotHolds)
        .where(
          and(
            eq(slotHolds.providerId, provider.id),
            eq(slotHolds.startsAt, startsAt),
          ),
        )
        .run();
    });

    return this.getSummary(appointment.id);
  }

  async cancel(input: {
    appointmentId: string;
    conversationId: string;
    reason?: string;
  }): Promise<AppointmentSummary> {
    const appointment = getAppointmentRecord(input.appointmentId);
    if (!appointment) {
      throw new DomainError(
        "APPOINTMENT_NOT_FOUND",
        "I could not find that appointment.",
      );
    }
    if (appointment.status === "cancelled") {
      return this.getSummary(appointment.id);
    }
    if (appointment.status !== "booked") {
      throw new DomainError(
        "APPOINTMENT_NOT_EDITABLE",
        "That appointment can no longer be cancelled online.",
      );
    }

    const nowIso = new Date().toISOString();
    const reasonNote = input.reason?.trim()
      ? `Cancelled via chat: ${input.reason.trim()}`
      : "Cancelled via chat.";

    db.update(appointments)
      .set({
        status: "cancelled",
        notes: appointment.notes
          ? `${appointment.notes}\n${reasonNote}`
          : reasonNote,
        updatedAt: nowIso,
      })
      .where(eq(appointments.id, appointment.id))
      .run();

    return this.getSummary(appointment.id);
  }

  async listForPatient(
    patientId: string,
    includePast: boolean,
  ): Promise<AppointmentSummary[]> {
    return listAppointmentSummaryRecordsForPatient(
      patientId,
      includePast,
    ).map(toSummary);
  }

  private getSummary(id: string): AppointmentSummary {
    const record = getAppointmentSummaryRecord(id);
    if (!record) {
      throw new DomainError(
        "APPOINTMENT_NOT_FOUND",
        "I could not find that appointment.",
      );
    }
    return toSummary(record);
  }
}

export const schedulingService = new SqliteSchedulingService();

export function describeSlot(slot: AvailabilitySlot): string {
  return `${formatPracticeDateTime(slot.startsAt)} with ${slot.providerName}`;
}
