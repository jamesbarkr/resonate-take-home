import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  appointmentTypes,
  appointments,
  conversations,
  feedback,
  patients,
  providers,
  staffAlerts,
} from "@/lib/db/schema";
import { listRecentConversations } from "@/lib/domain/conversation-service";

export function getUpcomingAppointments(days = 7) {
  const now = new Date().toISOString();
  const until = new Date(Date.now() + days * 86_400_000).toISOString();

  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      notes: appointments.notes,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      providerName: providers.name,
      appointmentTypeName: appointmentTypes.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(providers, eq(appointments.providerId, providers.id))
    .innerJoin(
      appointmentTypes,
      eq(appointments.appointmentTypeId, appointmentTypes.id),
    )
    .where(
      and(
        eq(appointments.status, "booked"),
        gte(appointments.startsAt, now),
        lte(appointments.startsAt, until),
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .all();
}

export function getOpenAlerts() {
  return db
    .select({
      id: staffAlerts.id,
      kind: staffAlerts.kind,
      urgency: staffAlerts.urgency,
      summary: staffAlerts.summary,
      createdAt: staffAlerts.createdAt,
      conversationId: staffAlerts.conversationId,
      patientName: patients.fullName,
      patientPhone: patients.phone,
    })
    .from(staffAlerts)
    .leftJoin(patients, eq(staffAlerts.patientId, patients.id))
    .where(eq(staffAlerts.status, "open"))
    .orderBy(desc(staffAlerts.createdAt))
    .all();
}

export function acknowledgeAlert(alertId: string) {
  db.update(staffAlerts)
    .set({
      status: "acknowledged",
      acknowledgedAt: new Date().toISOString(),
    })
    .where(eq(staffAlerts.id, alertId))
    .run();
}

export function getFeedbackSummary() {
  const rows = db
    .select({
      id: feedback.id,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
      conversationId: feedback.conversationId,
      patientName: patients.fullName,
    })
    .from(feedback)
    .leftJoin(conversations, eq(feedback.conversationId, conversations.id))
    .leftJoin(patients, eq(conversations.patientId, patients.id))
    .orderBy(desc(feedback.createdAt))
    .all();

  const positive = rows.filter((row) => row.rating > 0).length;
  const negative = rows.filter((row) => row.rating < 0).length;
  const comments = rows.filter((row) => row.comment).slice(0, 8);

  return {
    total: rows.length,
    positive,
    negative,
    satisfaction:
      rows.length === 0
        ? null
        : Math.round((positive / rows.length) * 100),
    comments,
  };
}

export function getDashboardData() {
  return {
    appointments: getUpcomingAppointments(7),
    alerts: getOpenAlerts(),
    conversations: listRecentConversations(10),
    feedback: getFeedbackSummary(),
  };
}
