import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { staffAlerts, type StaffAlert } from "@/lib/db/schema";
import type { StaffNotificationService } from "@/lib/domain/ports";

export class SqliteStaffNotificationService
  implements StaffNotificationService
{
  async notify(input: {
    conversationId: string;
    patientId?: string;
    appointmentId?: string;
    kind: "emergency" | "escalation" | "callback";
    urgency: "low" | "medium" | "high";
    summary: string;
  }): Promise<StaffAlert> {
    const alert = db
      .insert(staffAlerts)
      .values({
        id: `alert_${randomUUID()}`,
        conversationId: input.conversationId,
        patientId: input.patientId ?? null,
        kind: input.kind,
        urgency: input.urgency,
        summary: input.summary,
        status: "open",
        createdAt: new Date().toISOString(),
        acknowledgedAt: null,
      })
      .returning()
      .get();

    const webhookUrl = process.env.STAFF_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: `[${input.urgency.toUpperCase()} ${input.kind}] ${input.summary}`,
            alertId: alert.id,
            conversationId: input.conversationId,
            patientId: input.patientId ?? null,
            appointmentId: input.appointmentId ?? null,
          }),
        });
      } catch (error) {
        // The in-app alert is the source of truth; a webhook failure must not
        // block the patient's emergency flow.
        console.error("[staff-notify] webhook delivery failed", {
          alertId: alert.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return alert;
  }
}

export const staffNotificationService =
  new SqliteStaffNotificationService();
