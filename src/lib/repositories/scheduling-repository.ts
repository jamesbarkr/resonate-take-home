import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  appointmentTypes,
  appointments,
  availabilityBlocks,
  patients,
  providers,
  slotHolds,
  type NewAppointment,
} from "@/lib/db/schema";
import type { AppointmentTypeSlug } from "@/lib/domain/types";

export function getAppointmentTypeBySlug(slug: AppointmentTypeSlug) {
  return db
    .select()
    .from(appointmentTypes)
    .where(eq(appointmentTypes.slug, slug))
    .get();
}

export function getAppointmentTypeById(id: string) {
  return db
    .select()
    .from(appointmentTypes)
    .where(eq(appointmentTypes.id, id))
    .get();
}

export function getProviderById(id: string) {
  return db.select().from(providers).where(eq(providers.id, id)).get();
}

export function listActiveProviders(role?: "dentist" | "hygienist") {
  const query = db.select().from(providers).where(eq(providers.active, true));
  const rows = query.all();
  return role ? rows.filter((provider) => provider.role === role) : rows;
}

export function listBlocksForProviders(providerIds: string[]) {
  if (providerIds.length === 0) return [];
  return db
    .select()
    .from(availabilityBlocks)
    .where(inArray(availabilityBlocks.providerId, providerIds))
    .all();
}

export function listBookedAppointments(
  providerIds: string[],
  fromIso: string,
  toIso: string,
) {
  if (providerIds.length === 0) return [];
  return db
    .select()
    .from(appointments)
    .where(
      and(
        inArray(appointments.providerId, providerIds),
        inArray(appointments.status, ["booked", "completed"]),
        gte(appointments.startsAt, fromIso),
        lte(appointments.startsAt, toIso),
      ),
    )
    .all();
}

export function listActiveHolds(
  providerIds: string[],
  nowIso: string,
  fromIso: string,
  toIso: string,
) {
  if (providerIds.length === 0) return [];
  return db
    .select()
    .from(slotHolds)
    .where(
      and(
        inArray(slotHolds.providerId, providerIds),
        gte(slotHolds.expiresAt, nowIso),
        gte(slotHolds.startsAt, fromIso),
        lte(slotHolds.startsAt, toIso),
      ),
    )
    .all();
}

export function getAppointmentRecord(id: string) {
  return db.select().from(appointments).where(eq(appointments.id, id)).get();
}

export function getAppointmentByKey(idempotencyKey: string) {
  return db
    .select()
    .from(appointments)
    .where(eq(appointments.idempotencyKey, idempotencyKey))
    .get();
}

export function listAppointmentRecordsForPatient(
  patientId: string,
  includePast: boolean,
) {
  const nowIso = new Date().toISOString();
  return db
    .select()
    .from(appointments)
    .where(
      includePast
        ? eq(appointments.patientId, patientId)
        : and(
            eq(appointments.patientId, patientId),
            gte(appointments.startsAt, nowIso),
            eq(appointments.status, "booked"),
          ),
    )
    .all();
}

export function getAppointmentSummaryRecord(id: string) {
  return db
    .select({
      appointment: appointments,
      providerName: providers.name,
      appointmentTypeName: appointmentTypes.name,
      patientName: patients.fullName,
    })
    .from(appointments)
    .innerJoin(providers, eq(appointments.providerId, providers.id))
    .innerJoin(
      appointmentTypes,
      eq(appointments.appointmentTypeId, appointmentTypes.id),
    )
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(eq(appointments.id, id))
    .get();
}

export function listAppointmentSummaryRecordsForPatient(
  patientId: string,
  includePast: boolean,
) {
  const nowIso = new Date().toISOString();
  const rows = db
    .select({
      appointment: appointments,
      providerName: providers.name,
      appointmentTypeName: appointmentTypes.name,
      patientName: patients.fullName,
    })
    .from(appointments)
    .innerJoin(providers, eq(appointments.providerId, providers.id))
    .innerJoin(
      appointmentTypes,
      eq(appointments.appointmentTypeId, appointmentTypes.id),
    )
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(
      includePast
        ? eq(appointments.patientId, patientId)
        : and(
            eq(appointments.patientId, patientId),
            gte(appointments.startsAt, nowIso),
            eq(appointments.status, "booked"),
          ),
    )
    .all();

  return rows.sort((a, b) =>
    a.appointment.startsAt.localeCompare(b.appointment.startsAt),
  );
}

export function insertAppointmentRecord(values: NewAppointment) {
  return db.insert(appointments).values(values).run();
}

export function deleteExpiredHolds(nowIso: string) {
  return db.delete(slotHolds).where(lte(slotHolds.expiresAt, nowIso)).run();
}

export function getHoldForSlot(providerId: string, startsAt: string) {
  return db
    .select()
    .from(slotHolds)
    .where(
      and(eq(slotHolds.providerId, providerId), eq(slotHolds.startsAt, startsAt)),
    )
    .get();
}

export function deleteHoldForSlot(providerId: string, startsAt: string) {
  return db
    .delete(slotHolds)
    .where(
      and(eq(slotHolds.providerId, providerId), eq(slotHolds.startsAt, startsAt)),
    )
    .run();
}
