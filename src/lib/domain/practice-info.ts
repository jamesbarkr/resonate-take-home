import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { insurancePlans, practiceConfig } from "@/lib/db/schema";
import { PRACTICE_TIMEZONE } from "@/lib/domain/time";

export type PracticeInfoTopic =
  | "hours"
  | "location"
  | "insurance"
  | "no_insurance"
  | "membership"
  | "financing"
  | "emergency"
  | "all";

export interface PracticeInfo {
  name: string;
  phone: string;
  address: string;
  timezone: string;
  hours: Record<string, string>;
  hoursSummary: string;
  acceptedPlans: string[];
  insuranceNote: string;
  selfPayNote: string;
  membershipNote: string;
  financingNote: string;
  emergencyNote: string;
}

function formatHours(hours: Record<string, string>): string {
  const order = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const parts: string[] = [];
  let runStart = "";
  let runValue = "";

  const flush = (endDay: string) => {
    if (!runStart) return;
    const startLabel =
      runStart.charAt(0).toUpperCase() + runStart.slice(1, 3);
    if (runStart === endDay) {
      parts.push(`${startLabel}: ${runValue}`);
    } else {
      const endLabel = endDay.charAt(0).toUpperCase() + endDay.slice(1, 3);
      parts.push(`${startLabel}–${endLabel}: ${runValue}`);
    }
    runStart = "";
    runValue = "";
  };

  for (const day of order) {
    const value = hours[day] ?? "";
    if (value === runValue) continue;
    if (runStart) flush(order[order.indexOf(day) - 1] ?? day);
    runStart = day;
    runValue = value;
  }
  if (runStart) flush("sunday");

  return parts.join("; ");
}

export function getPracticeInfo(): PracticeInfo {
  const config = db
    .select()
    .from(practiceConfig)
    .where(eq(practiceConfig.id, "default"))
    .get();

  if (!config) {
    throw new Error("Practice configuration is missing. Run npm run db:seed.");
  }

  const plans = db
    .select()
    .from(insurancePlans)
    .where(eq(insurancePlans.accepted, true))
    .all()
    .map((plan) => plan.name);

  const hours = JSON.parse(config.hoursJson) as Record<string, string>;

  return {
    name: config.name,
    phone: config.phone,
    address: `${config.addressLine1}, ${config.city}, ${config.state} ${config.postalCode}`,
    timezone: config.timezone || PRACTICE_TIMEZONE,
    hours,
    hoursSummary: formatHours(hours),
    acceptedPlans: plans,
    insuranceNote: config.insuranceNote,
    selfPayNote: config.selfPayNote,
    membershipNote: config.membershipNote,
    financingNote: config.financingNote,
    emergencyNote: config.emergencyNote,
  };
}

export function getPracticeInfoForTopic(topic: PracticeInfoTopic) {
  const info = getPracticeInfo();

  if (topic === "all") return info;

  switch (topic) {
    case "hours":
      return {
        name: info.name,
        timezone: info.timezone,
        hours: info.hours,
        hoursSummary: info.hoursSummary,
      };
    case "location":
      return {
        name: info.name,
        address: info.address,
        phone: info.phone,
      };
    case "insurance":
      return {
        acceptedPlans: info.acceptedPlans,
        insuranceNote: info.insuranceNote,
      };
    case "no_insurance":
      return {
        selfPayNote: info.selfPayNote,
        membershipNote: info.membershipNote,
        financingNote: info.financingNote,
      };
    case "membership":
      return { membershipNote: info.membershipNote };
    case "financing":
      return { financingNote: info.financingNote };
    case "emergency":
      return { emergencyNote: info.emergencyNote, phone: info.phone };
  }
}
