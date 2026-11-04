import { redirect } from "next/navigation";
import {
  getPatientSession,
  getStaffSession,
} from "@/lib/auth/session";
import { isStaffSite } from "@/lib/site";

export async function requirePatientSite() {
  if (isStaffSite()) redirect("/staff");
}

export async function requirePatientPage() {
  await requirePatientSite();
  const session = await getPatientSession();
  if (!session) redirect("/login?next=/portal");
  return session;
}

export async function requireStaffPage() {
  if (!isStaffSite()) redirect("/");
  const session = await getStaffSession();
  if (!session) redirect("/login?next=/staff");
  return session;
}
