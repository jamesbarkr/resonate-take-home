import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getPatientSession,
  getStaffSession,
} from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { isStaffSite } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in | Lakeside Family Dental",
};

type LoginField = {
  id: string;
  label: string;
  name: string;
  type: "tel" | "date" | "email" | "password";
  autoComplete: string;
  placeholder?: string;
  inputMode?: "tel";
};

const PATIENT_FIELDS: LoginField[] = [
  {
    id: "patient-phone",
    label: "Phone number",
    name: "phone",
    type: "tel",
    autoComplete: "tel",
    placeholder: "617-555-0102",
    inputMode: "tel",
  },
  {
    id: "patient-dob",
    label: "Date of birth",
    name: "dateOfBirth",
    type: "date",
    autoComplete: "bday",
  },
];

const STAFF_FIELDS: LoginField[] = [
  {
    id: "staff-email",
    label: "Work email",
    name: "email",
    type: "email",
    autoComplete: "username",
    placeholder: "frontdesk@lakeside.test",
  },
  {
    id: "staff-password",
    label: "Password",
    name: "password",
    type: "password",
    autoComplete: "current-password",
  },
];

function LoginForm({
  action,
  fields,
  next,
  submitLabel,
}: {
  action: string;
  fields: LoginField[];
  next: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="mt-6 space-y-4" method="post">
      <input name="next" type="hidden" value={next} />
      {fields.map((field) => (
        <div key={field.id}>
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor={field.id}
          >
            {field.label}
          </label>
          <input
            autoComplete={field.autoComplete}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            id={field.id}
            inputMode={field.inputMode}
            name={field.name}
            placeholder={field.placeholder}
            required
            type={field.type}
          />
        </div>
      ))}
      <button
        className="w-full rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const isStaff = isStaffSite();

  const session = isStaff
    ? await getStaffSession()
    : await getPatientSession();
  if (session) redirect(isStaff ? "/staff" : "/portal");

  const params = await searchParams;
  const next = safeRedirectPath(params.next, isStaff ? "/staff" : "/portal");
  const error = params.error;

  const copy = isStaff
    ? {
        brandSubtitle: "Staff workspace",
        eyebrow: "Lakeside staff access",
        headline: "The front desk, without the switchboard.",
        body: "Sign in to review the schedule, urgent alerts, and the conversations Ava handled.",
        features: [
          "Review the upcoming schedule and open alerts",
          "Read full transcripts and tool-call audit trails",
          "Acknowledge urgent requests and follow up",
        ],
        demo: "Staff: frontdesk@lakeside.test · frontdesk-demo",
        formTitle: "Staff sign in",
        formBody: "Access the schedule, patient alerts, and conversation review.",
        action: "/api/auth/staff",
        fields: STAFF_FIELDS,
        submitLabel: "Sign in to staff workspace",
      }
    : {
        brandSubtitle: "Boston, MA",
        eyebrow: "Lakeside patient access",
        headline: "Your care, your appointments, one calm place.",
        body: "Sign in to see upcoming visits and manage your family's care. New patients can start a conversation with Ava without creating an account.",
        features: [
          "View upcoming appointments and visit details",
          "Book, move, or cancel through the assistant",
          "Coordinate cleanings for the whole household",
        ],
        demo: "Patient: Maria Lopez · 617-555-0102 · 1990-11-30",
        formTitle: "Sign in to your portal",
        formBody:
          "Use the phone number and date of birth on your patient record.",
        action: "/api/auth/patient",
        fields: PATIENT_FIELDS,
        submitLabel: "Sign in",
      };

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link className="flex items-center gap-3" href={isStaff ? "/staff" : "/"}>
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
                {copy.brandSubtitle}
              </span>
            </span>
          </Link>
          {isStaff ? (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
              Authorized staff only
            </span>
          ) : (
            <a
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
              href="tel:6175550142"
            >
              Call 617-555-0142
            </a>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-12 sm:px-6">
        <div
          className="grid w-full gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start"
          data-testid="login-content"
        >
          <section className="rounded-3xl bg-brand-900 p-8 text-white shadow-xl sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-100">
              {copy.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              {copy.headline}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-brand-100">
              {copy.body}
            </p>
            <ul className="mt-8 space-y-3 text-sm text-brand-50">
              {copy.features.map((item) => (
                <li className="flex gap-3" key={item}>
                  <span aria-hidden="true">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-10 rounded-2xl bg-white/10 p-4 text-xs leading-relaxed text-brand-50">
              <p className="font-semibold text-white">Demo access</p>
              <p className="mt-1">{copy.demo}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {error ? (
              <div
                className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <h2 className="text-xl font-semibold text-brand-900">
              {copy.formTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{copy.formBody}</p>
            <LoginForm
              action={copy.action}
              fields={copy.fields}
              next={next}
              submitLabel={copy.submitLabel}
            />
            {isStaff ? (
              <p className="mt-4 text-xs text-slate-500">
                Staff access is restricted to practice team members.
              </p>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                New patient?{" "}
                <Link
                  className="font-semibold text-brand-600 hover:text-brand-700"
                  href="/chat"
                >
                  Start a chat with Ava
                </Link>
              </p>
            )}
          </section>
        </div>
      </div>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:px-6">
          <p>© 2026 Lakeside Family Dental · Boston, MA</p>
          {isStaff ? (
            <p>Staff workspace</p>
          ) : (
            <div className="flex gap-4">
              <Link className="hover:text-brand-700" href="/">
                Home
              </Link>
              <Link className="hover:text-brand-700" href="/chat">
                Chat with Ava
              </Link>
            </div>
          )}
        </div>
      </footer>
    </main>
  );
}
