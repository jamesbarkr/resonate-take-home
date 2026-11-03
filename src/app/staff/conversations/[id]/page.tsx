import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getConversationDetail } from "@/lib/domain/conversation-service";
import { formatPracticeDateTime } from "@/lib/domain/time";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "staff") {
    redirect("/login?role=staff&next=/staff");
  }

  const { id } = await params;
  const detail = getConversationDetail(id);

  if (!detail) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <Link className="text-sm font-medium text-brand-600" href="/staff">
          ← Back to staff console
        </Link>
        <h1 className="text-3xl font-semibold text-brand-900">
          {detail.patientName ?? "Unverified visitor"}
        </h1>
        <p className="text-sm text-slate-600">
          Conversation {detail.conversation.id} · status{" "}
          {detail.conversation.status} · updated{" "}
          {formatPracticeDateTime(detail.conversation.updatedAt)}
        </p>
        {detail.patientPhone ? (
          <p className="text-sm text-slate-600">
            Phone {detail.patientPhone}
            {detail.patientDob ? ` · DOB ${detail.patientDob}` : ""}
          </p>
        ) : null}
      </header>

      {detail.alerts.length > 0 ? (
        <section className="mt-6 space-y-2" aria-labelledby="alerts-heading">
          <h2 className="text-lg font-semibold text-brand-900" id="alerts-heading">
            Alerts
          </h2>
          {detail.alerts.map((alert) => (
            <div
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
              key={alert.id}
            >
              <p className="font-semibold uppercase tracking-wide">
                {alert.kind} · {alert.urgency} · {alert.status}
              </p>
              <p className="mt-1">{alert.summary}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="transcript-heading">
        <h2 className="text-lg font-semibold text-brand-900" id="transcript-heading">
          Transcript
        </h2>
        <div className="mt-3 space-y-3">
          {detail.messages.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              No persisted messages yet.
            </p>
          ) : null}
          {detail.messages.map((message) => (
            <article
              className={`rounded-2xl border p-4 text-sm ${
                message.role === "user"
                  ? "border-brand-100 bg-brand-50"
                  : "border-slate-200 bg-white"
              }`}
              key={message.id}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {message.role}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-800">
                {message.content}
              </p>
              <time className="mt-2 block text-xs text-slate-600">
                {formatPracticeDateTime(message.createdAt)}
              </time>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="tools-heading">
        <h2 className="text-lg font-semibold text-brand-900" id="tools-heading">
          Tool activity
        </h2>
        <div className="mt-3 space-y-2">
          {detail.toolCalls.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              No tool calls recorded.
            </p>
          ) : null}
          {detail.toolCalls.map((call) => (
            <details
              className="rounded-2xl border border-slate-200 bg-white p-4 text-sm"
              key={call.id}
            >
              <summary className="cursor-pointer font-medium text-slate-800">
                {call.toolName} · {call.status} ·{" "}
                {formatPracticeDateTime(call.createdAt)}
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                {call.resultJson ?? call.error ?? call.argumentsJson}
              </pre>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
