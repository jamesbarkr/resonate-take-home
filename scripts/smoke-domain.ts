import { randomUUID } from "node:crypto";
import { ensureConversation } from "../src/lib/domain/conversation-service";
import { patientService } from "../src/lib/domain/patient-service";
import { getPracticeInfo } from "../src/lib/domain/practice-info";
import { schedulingService } from "../src/lib/domain/scheduling-service";
import { staffNotificationService } from "../src/lib/domain/staff-notification-service";
import {
  addDaysToDateString,
  formatPracticeDateTime,
  practiceDateString,
} from "../src/lib/domain/time";

async function main() {
  const practice = getPracticeInfo();
  console.log(
    `practice: ${practice.name} | ${practice.hoursSummary} | ${practice.acceptedPlans.length} plans`,
  );

  const conversationId = `conv_smoke_${randomUUID()}`;
  ensureConversation(conversationId);

  const matches = await patientService.findMatches({
    fullName: "David Johnson",
    phone: "6175550101",
    dateOfBirth: "1985-04-12",
  });
  console.log("identity matches:", matches.length, matches[0]?.patient.fullName);
  if (!matches[0]) throw new Error("seed patient not found");

  const start = practiceDateString();
  const end = addDaysToDateString(start, 14);

  const cleaningSlots = await schedulingService.getAvailability({
    appointmentType: "cleaning",
    preferredStartDate: start,
    preferredEndDate: end,
    limit: 5,
  });
  console.log(
    "cleaning slots:",
    cleaningSlots.slice(0, 5).map((slot) => formatPracticeDateTime(slot.startsAt)),
  );
  if (cleaningSlots.length < 2) throw new Error("expected at least 2 slots");

  const booked = await schedulingService.book({
    patientId: matches[0].patient.id,
    providerId: cleaningSlots[0].providerId,
    appointmentType: "cleaning",
    startsAt: cleaningSlots[0].startsAt,
    conversationId,
    idempotencyKey: `smoke_book_${conversationId}`,
  });
  console.log("booked:", formatPracticeDateTime(booked.startsAt), booked.providerName);

  const listed = await schedulingService.listForPatient(
    matches[0].patient.id,
    false,
  );
  console.log("listed appointments:", listed.length);

  const rescheduled = await schedulingService.reschedule({
    appointmentId: booked.id,
    newProviderId: cleaningSlots[1].providerId,
    newStartsAt: cleaningSlots[1].startsAt,
    conversationId,
    idempotencyKey: `smoke_reschedule_${conversationId}`,
  });
  console.log(
    "rescheduled:",
    formatPracticeDateTime(rescheduled.startsAt),
    rescheduled.providerName,
  );

  const cancelled = await schedulingService.cancel({
    appointmentId: booked.id,
    conversationId,
    reason: "smoke test",
  });
  console.log("cancelled status:", cancelled.status);

  const emergencySlots = await schedulingService.getAvailability({
    appointmentType: "emergency",
    preferredStartDate: start,
    preferredEndDate: addDaysToDateString(start, 3),
    preferredTimeOfDay: "any",
    limit: 3,
  });
  console.log(
    "emergency slots:",
    emergencySlots.map((slot) => formatPracticeDateTime(slot.startsAt)),
  );

  const alert = await staffNotificationService.notify({
    conversationId,
    patientId: matches[0].patient.id,
    kind: "emergency",
    urgency: "high",
    summary: "Smoke test: severe pain and facial swelling.",
  });
  console.log("staff alert:", alert.id, alert.status);

  console.log("domain smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
