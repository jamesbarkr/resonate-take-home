import type {
  AppointmentType,
  Patient,
  Provider,
  StaffAlert,
} from "@/lib/db/schema";
import type { AppointmentTypeSlug } from "@/lib/domain/types";

/**
 * Ports between the conversational/tool layer and the deterministic domain.
 *
 * The LLM-facing tools depend on these interfaces, not on Drizzle directly.
 * The current implementations use SQLite; a hosted Postgres adapter can replace
 * them without changing prompts or tool contracts.
 */

export interface PatientMatch {
  patient: Patient;
  matchedOn: {
    name: boolean;
    phone: boolean;
    dateOfBirth: boolean;
  };
}

export interface PatientService {
  findMatches(input: {
    fullName: string;
    phone: string;
    dateOfBirth: string;
  }): Promise<PatientMatch[]>;
  create(input: {
    fullName: string;
    phone: string;
    dateOfBirth: string;
    insuranceName?: string;
    householdName?: string;
    notes?: string;
  }): Promise<Patient>;
  getById(patientId: string): Promise<Patient | null>;
  listHousehold(patientId: string): Promise<Patient[]>;
}

export interface AvailabilityQuery {
  appointmentType: AppointmentTypeSlug;
  preferredStartDate: string;
  preferredEndDate: string;
  providerId?: string;
  preferredTimeOfDay?: "morning" | "afternoon" | "evening" | "any";
  limit?: number;
}

export interface AvailabilitySlot {
  providerId: string;
  providerName: string;
  provider: Provider;
  appointmentType: AppointmentType;
  startsAt: string;
  endsAt: string;
}

export interface AppointmentSummary {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  appointmentType: AppointmentTypeSlug;
  appointmentTypeName: string;
  startsAt: string;
  endsAt: string;
  status: "booked" | "cancelled" | "completed" | "no_show";
  notes: string | null;
}

export interface BookingRequest {
  patientId: string;
  providerId: string;
  appointmentType: AppointmentTypeSlug;
  startsAt: string;
  conversationId: string;
  idempotencyKey: string;
  notes?: string;
}

export interface RescheduleRequest {
  appointmentId: string;
  newProviderId?: string;
  newStartsAt: string;
  conversationId: string;
  idempotencyKey: string;
}

export interface SchedulingService {
  getAvailability(query: AvailabilityQuery): Promise<AvailabilitySlot[]>;
  holdSlot(input: {
    providerId: string;
    appointmentType: AppointmentTypeSlug;
    startsAt: string;
    conversationId: string;
  }): Promise<{ holdId: string; expiresAt: string }>;
  book(request: BookingRequest): Promise<AppointmentSummary>;
  reschedule(request: RescheduleRequest): Promise<AppointmentSummary>;
  cancel(input: {
    appointmentId: string;
    conversationId: string;
    reason?: string;
  }): Promise<AppointmentSummary>;
  listForPatient(
    patientId: string,
    includePast: boolean,
  ): Promise<AppointmentSummary[]>;
  getAppointmentPatientId(appointmentId: string): Promise<string | null>;
}

export interface StaffNotificationService {
  notify(input: {
    conversationId: string;
    patientId?: string;
    appointmentId?: string;
    kind: "emergency" | "escalation" | "callback";
    urgency: "low" | "medium" | "high";
    summary: string;
  }): Promise<StaffAlert>;
}
