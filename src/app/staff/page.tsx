import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  acknowledgeAlert,
  getDashboardData,
} from "@/lib/domain/staff-dashboard-service";
import { formatPracticeDateTime } from "@/lib/domain/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff console | Lakeside Family Dental",
};

async function acknowledge(formData: FormData) {
  "use server";
  const alertId = String(formData.get("alertId") ?? "");
  if (alertId) {
    acknowledgeAlert(alertId);
    revalidatePath("/staff");
  }
}

const urgencyStyles: Record<string, string> = {
  high: "border-rose-200 bg-rose-50 text-rose-900",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  low: "border-sky-200 bg-sky-50 text-sky-900",
};

export default async function StaffPage() {
  const session = await getSession();
  if (session?.role !== "staff") {
    redirect("/login?role=staff&next=/staff");
  }

  const data = getDashboardData();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link className="text-sm font-medium text-brand-600" href="/">
            ← Back to site
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-brand-900">
            Staff console
          </h1>
          <p className="mt-1 text-slate-600">
            Live schedule, patient alerts, conversations, and feedback from the
            chat assistant.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
            Staff workspace · synthetic patient data
          </p>
          <p className="hidden text-xs text-slate-500 sm:block">
            Signed in as {session.name}
          </p>
          <form action="/api/auth/logout" method="post">
            <button
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section
        aria-label="Summary"
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          {
            label: "Upcoming appointments",
            value: data.appointments.length,
            note: "Next 7 days",
          },
          {
            label: "Open alerts",
            value: data.alerts.length,
            note: "Needs attention",
          },
          {
            label: "Recent conversations",
            value: data.conversations.length,
            note: "Latest activity",
          },
          {
            label: "Satisfaction",
            value:
              data.feedback.satisfaction === null
                ? "—"
                : `${data.feedback.satisfaction}%`,
            note: `${data.feedback.total} ratings`,
          },
        ].map((stat) => (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            key={stat.label}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-900">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
          </div>
        ))}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section aria-labelledby="alerts-heading">
          <h2
            className="text-lg font-semibold text-brand-900"
            id="alerts-heading"
          >
            Alerts
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Emergencies and escalation requests created by the assistant.
          </p>
          <div className="mt-3 space-y-3">
            {data.alerts.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                No open alerts. Emergencies and escalations will appear here.
              </p>
            ) : null}
            {data.alerts.map((alert) => (
              <article
                className={`rounded-2xl border p-4 shadow-sm ${
                  urgencyStyles[alert.urgency] ?? urgencyStyles.medium
                }`}
                key={alert.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold uppercase tracking-wide">
                    {alert.kind} · {alert.urgency}
                  </p>
                  <time className="text-xs opacity-80">
                    {formatPracticeDateTime(alert.createdAt)}
                  </time>
                </div>
                <p className="mt-2 text-sm">{alert.summary}</p>
                <p className="mt-2 text-xs opacity-80">
                  {alert.patientName ?? "Unverified patient"}
                  {alert.patientPhone ? ` · ${alert.patientPhone}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {alert.conversationId ? (
                    <Link
                      className="text-xs font-semibold underline underline-offset-2"
                      href={`/staff/conversations/${alert.conversationId}`}
                    >
                      View conversation
                    </Link>
                  ) : null}
                  <form action={acknowledge}>
                    <input name="alertId" type="hidden" value={alert.id} />
                    <button
                      className="rounded-full border border-current px-3 py-1.5 text-xs font-semibold"
                      type="submit"
                    >
                      Acknowledge
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="schedule-heading">
          <h2
            className="text-lg font-semibold text-brand-900"
            id="schedule-heading"
          >
            Upcoming schedule
          </h2>
          <p className="mt-1 text-sm text-slate-500">Next seven days.</p>
          <div className="mt-3 space-y-2">
            {data.appointments.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                No upcoming appointments.
              </p>
            ) : null}
            {data.appointments.map((appointment) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                key={appointment.id}
              >
                <p className="text-sm font-semibold text-brand-900">
                  {formatPracticeDateTime(appointment.startsAt)}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {appointment.patientName} · {appointment.appointmentTypeName}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {appointment.providerName}
                  {appointment.notes ? ` · ${appointment.notes}` : ""}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section aria-labelledby="conversations-heading">
          <h2
            className="text-lg font-semibold text-brand-900"
            id="conversations-heading"
          >
            Recent conversations
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Transcripts persisted from the chat assistant.
          </p>
          <div className="mt-3 space-y-2">
            {data.conversations.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                No conversations yet.
              </p>
            ) : null}
            {data.conversations.map((conversation) => (
              <Link
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-500"
                href={`/staff/conversations/${conversation.id}`}
                key={conversation.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-brand-900">
                    {conversation.patientName ?? "Unverified visitor"}
                  </p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {conversation.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                  {conversation.lastMessage ?? "No messages yet."}
                </p>
                <time className="mt-2 block text-xs text-slate-600">
                  {formatPracticeDateTime(conversation.updatedAt)}
                </time>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="feedback-heading">
          <h2
            className="text-lg font-semibold text-brand-900"
            id="feedback-heading"
          >
            Patient feedback
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Thumbs up/down from the chat interface.
          </p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-700">
              {data.feedback.total === 0
                ? "No ratings yet."
                : `${data.feedback.positive} positive · ${data.feedback.negative} negative out of ${data.feedback.total} ratings.`}
            </p>
            {data.feedback.comments.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {data.feedback.comments.map((item) => (
                  <li
                    className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    key={item.id}
                  >
                    “{item.comment}”
                    <span className="mt-1 block text-xs text-slate-600">
                      {item.patientName ?? "Anonymous"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
