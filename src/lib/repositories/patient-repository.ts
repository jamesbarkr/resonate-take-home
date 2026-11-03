import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { households, patients, type NewPatient } from "@/lib/db/schema";

export function findPatientsByPhoneAndDob(phone: string, dateOfBirth: string) {
  return db
    .select()
    .from(patients)
    .where(and(eq(patients.phone, phone), eq(patients.dateOfBirth, dateOfBirth)))
    .all();
}

export function findPatientsByPhone(phone: string) {
  return db.select().from(patients).where(eq(patients.phone, phone)).all();
}

export function getPatientById(id: string) {
  return db.select().from(patients).where(eq(patients.id, id)).get();
}

export function listPatientsInHousehold(householdId: string) {
  return db
    .select()
    .from(patients)
    .where(eq(patients.householdId, householdId))
    .all();
}

export function insertPatient(patient: NewPatient) {
  return db.insert(patients).values(patient).returning().get();
}

export function findHouseholdByName(name: string) {
  return db
    .select()
    .from(households)
    .where(eq(households.name, name))
    .get();
}

export function insertHousehold(id: string, name: string, createdAt: string) {
  return db
    .insert(households)
    .values({ id, name, createdAt })
    .returning()
    .get();
}
