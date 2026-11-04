import { randomUUID } from "node:crypto";
import type { Patient } from "@/lib/db/schema";
import type { PatientMatch, PatientService } from "@/lib/domain/ports";
import {
  findHouseholdByName,
  findPatientsByPhoneAndDob,
  getPatientById,
  insertHousehold,
  insertPatient,
  listPatientsInHousehold,
} from "@/lib/repositories/patient-repository";

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLikelyMatch(a: string, b: string): boolean {
  const left = normalizeName(a).split(" ").filter(Boolean);
  const right = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (left.length === 0 || right.size === 0) return false;
  // Require the first name plus at least one more overlapping token when
  // available; this tolerates "Dave" vs "David" only partially, so the prompt
  // still asks the patient to confirm the record.
  return left.some((token) => right.has(token));
}

export class SqlitePatientService implements PatientService {
  async findMatches(input: {
    fullName: string;
    phone: string;
    dateOfBirth: string;
  }): Promise<PatientMatch[]> {
    const phone = normalizePhone(input.phone);
    const rows = findPatientsByPhoneAndDob(phone, input.dateOfBirth);

    return rows.map((patient) => ({
      patient,
      matchedOn: {
        name: namesLikelyMatch(input.fullName, patient.fullName),
        phone: true,
        dateOfBirth: true,
      },
    }));
  }

  async create(input: {
    fullName: string;
    phone: string;
    dateOfBirth: string;
    insuranceName?: string;
    householdName?: string;
    notes?: string;
  }): Promise<Patient> {
    const phone = normalizePhone(input.phone);
    const existing = findPatientsByPhoneAndDob(phone, input.dateOfBirth).find(
      (patient) => namesLikelyMatch(input.fullName, patient.fullName),
    );

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const householdName = input.householdName?.trim() || input.fullName.trim();
    let household = findHouseholdByName(householdName);

    if (!household) {
      household = insertHousehold(
        `hh_${randomUUID()}`,
        householdName,
        now,
      );
    }

    return insertPatient({
      id: `pat_${randomUUID()}`,
      householdId: household.id,
      fullName: input.fullName.trim(),
      phone,
      dateOfBirth: input.dateOfBirth,
      insuranceName: input.insuranceName?.trim() || null,
      notes: input.notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async getById(patientId: string): Promise<Patient | null> {
    return getPatientById(patientId) ?? null;
  }

  async listHousehold(patientId: string): Promise<Patient[]> {
    const patient = getPatientById(patientId);
    if (!patient?.householdId) return patient ? [patient] : [];
    return listPatientsInHousehold(patient.householdId);
  }
}

export const patientService = new SqlitePatientService();
