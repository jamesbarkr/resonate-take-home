import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePatientPage } from "@/lib/auth/page-guards";
import { patientService } from "@/lib/domain/patient-service";
import { schedulingService } from "@/lib/domain/scheduling-service";
import { formatPracticeDateTime } from "@/lib/domain/time";
import type { AppointmentStatus } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Patient portal | Lakeside Family Dental",
};

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Booked",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
};

export default async function PortalPage() {
  const session = await requirePatientPage();

  const patient = await patientService.getById(session.patientId);
  if (!patient) {
    redirect(
      `/login?error=${encodeURIComponent(
        "We could not find that patient record. Please sign in again.",
      )}`,
    );
  }

  const [appointments, household] = await Promise.all([
    schedulingService.listForPatient(patient.id, false),
    patientService.listHousehold(patient.id),
  ]);

  const firstName = patient.fullName.split(" ")[0];
  const householdOthers = household.filter((member) => member.id !== patient.id);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link className="flex items-center gap-3" href="/">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white"
            >
              L
            </span>
            <span>
              <span className="block text-sm font-semibold text-brand-900">
                Lakeside Family Dental
              </span>
              <span className="block text-xs text-slate-500">
                Patient portal
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:block">
              Signed in as {patient.fullName}
            </span>
            <form action="/api/auth/logout" method="post">
              <button
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-600">
              Welcome back
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-brand-900 sm:text-4xl">
              Hi, {firstName}.
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Here is what is coming up. You can also ask Ava to book a new
              visit, move an appointment, or arrange care for your family.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              href="/chat"
            >
              Chat with Ava
            </Link>
            <a
              className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-700"
              href="tel:6175550142"
            >
              Call the office
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <section aria-labelledby="appointments-heading">
            <div className="flex items-center justify-between">
              <h2
                className="text-lg font-semibold text-brand-900"
                id="appointments-heading"
              >
                Upcoming appointments
              </h2>
              <Link
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                href="/chat"
              >
                Book another
              </Link>
            </div>
            <div className="mt-3 space-y-3">
              {appointments.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                  <p className="font-medium text-slate-800">
                    No upcoming appointments.
                  </p>
                  <p className="mt-1">
                    Ask Ava to find a cleaning or checkup that fits your
                    schedule.
                  </p>
                  <Link
                    className="mt-4 inline-block rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                    href="/chat"
                  >
                    Find a time
                  </Link>
                </div>
              ) : null}
              {appointments.map((appointment) => (
                <article
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  key={appointment.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-900">
                        {formatPracticeDateTime(appointment.startsAt)}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {appointment.appointmentTypeName} with{" "}
                        {appointment.providerName}
                      </p>
                      {appointment.notes ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {appointment.notes}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                      {APPOINTMENT_STATUS_LABELS[appointment.status] ??
                        appointment.status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Need to change it?{" "}
                    <Link
                      className="font-semibold text-brand-600 hover:text-brand-700"
                      href="/chat"
                    >
                      Ask Ava to move or cancel
                    </Link>
                  </p>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <section
              aria-labelledby="profile-heading"
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2
                className="text-sm font-semibold uppercase tracking-wide text-slate-500"
                id="profile-heading"
              >
                Your details
              </h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Name</dt>
                  <dd className="font-medium text-slate-800">
                    {patient.fullName}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-medium text-slate-800">
                    {patient.phone}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Date of birth</dt>
                  <dd className="font-medium text-slate-800">
                    {patient.dateOfBirth}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Insurance</dt>
                  <dd className="font-medium text-slate-800">
                    {patient.insuranceName ?? "Self-pay"}
                  </dd>
                </div>
              </dl>
            </section>

            {householdOthers.length > 0 ? (
              <section
                aria-labelledby="household-heading"
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2
                  className="text-sm font-semibold uppercase tracking-wide text-slate-500"
                  id="household-heading"
                >
                  Your household
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {householdOthers.map((member) => (
                    <li key={member.id}>{member.fullName}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-500">
                  Ask Ava to coordinate back-to-back visits for your family.
                </p>
              </section>
            ) : null}

            <section className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
              <h2 className="text-sm font-semibold text-brand-900">
                Need urgent help?
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                For severe pain, swelling, or a dental injury, start a chat and
                Ava will alert the clinical team and look for a same-day slot.
              </p>
              <p className="mt-2 text-xs text-slate-600">
                For a life-threatening emergency, call 911.
              </p>
              <Link
                className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-900"
                href="/chat"
              >
                Get urgent help →
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
