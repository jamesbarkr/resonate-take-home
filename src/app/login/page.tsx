import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Sign in | Lakeside Family Dental",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    error?: string;
    next?: string;
  }>;
}) {
  const session = await getSession();
  if (session?.role === "staff") redirect("/staff");
  if (session?.role === "patient") redirect("/portal");

  const params = await searchParams;
  const role = params.role === "staff" ? "staff" : "patient";
  const next = safeRedirectPath(params.next, role === "staff" ? "/staff" : "/portal");
  const error = params.error;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
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
                Boston, MA
              </span>
            </span>
          </Link>
          <a
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
            href="tel:6175550142"
          >
            Call 617-555-0142
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <section className="rounded-3xl bg-brand-900 p-8 text-white shadow-xl sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-100">
            Lakeside patient access
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            Your care, your appointments, one calm place.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-brand-100">
            Sign in to see upcoming visits and manage your family&apos;s care.
            New patients can start a conversation with Ava without creating an
            account.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-brand-50">
            <li className="flex gap-3">
              <span aria-hidden="true">✓</span>
              View upcoming appointments and visit details
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true">✓</span>
              Book, move, or cancel through the assistant
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true">✓</span>
              Coordinate cleanings for the whole household
            </li>
          </ul>
          <div className="mt-10 rounded-2xl bg-white/10 p-4 text-xs leading-relaxed text-brand-50">
            <p className="font-semibold text-white">Demo access</p>
            <p className="mt-1">
              Patient: Maria Lopez · 617-555-0102 · 1990-11-30
            </p>
            <p>
              Staff: frontdesk@lakeside.test · frontdesk-demo
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div
            className="flex gap-2 rounded-full bg-slate-100 p-1"
            role="tablist"
            aria-label="Sign-in type"
          >
            <Link
              aria-selected={role === "patient"}
              className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold transition ${
                role === "patient"
                  ? "bg-white text-brand-900 shadow-sm"
                  : "text-slate-600 hover:text-brand-700"
              }`}
              href="/login?role=patient"
              role="tab"
            >
              Patient portal
            </Link>
            <Link
              aria-selected={role === "staff"}
              className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold transition ${
                role === "staff"
                  ? "bg-white text-brand-900 shadow-sm"
                  : "text-slate-600 hover:text-brand-700"
              }`}
              href="/login?role=staff"
              role="tab"
            >
              Staff access
            </Link>
          </div>

          {error ? (
            <div
              className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {role === "patient" ? (
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-brand-900">
                Sign in to your portal
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Use the phone number and date of birth on your patient record.
              </p>
              <form
                action="/api/auth/patient"
                className="mt-6 space-y-4"
                method="post"
              >
                <input name="next" type="hidden" value={next} />
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="patient-phone"
                  >
                    Phone number
                  </label>
                  <input
                    autoComplete="tel"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    id="patient-phone"
                    inputMode="tel"
                    name="phone"
                    placeholder="617-555-0102"
                    required
                    type="tel"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="patient-dob"
                  >
                    Date of birth
                  </label>
                  <input
                    autoComplete="bday"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    id="patient-dob"
                    name="dateOfBirth"
                    required
                    type="date"
                  />
                </div>
                <button
                  className="w-full rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
                  type="submit"
                >
                  Sign in
                </button>
              </form>
              <p className="mt-4 text-sm text-slate-600">
                New patient?{" "}
                <Link
                  className="font-semibold text-brand-600 hover:text-brand-700"
                  href="/chat"
                >
                  Start a chat with Ava
                </Link>
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-brand-900">
                Staff sign in
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Access the schedule, patient alerts, and conversation review.
              </p>
              <form
                action="/api/auth/staff"
                className="mt-6 space-y-4"
                method="post"
              >
                <input name="next" type="hidden" value={next} />
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="staff-email"
                  >
                    Work email
                  </label>
                  <input
                    autoComplete="username"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    id="staff-email"
                    name="email"
                    placeholder="frontdesk@lakeside.test"
                    required
                    type="email"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="staff-password"
                  >
                    Password
                  </label>
                  <input
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    id="staff-password"
                    name="password"
                    required
                    type="password"
                  />
                </div>
                <button
                  className="w-full rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
                  type="submit"
                >
                  Sign in to staff workspace
                </button>
              </form>
              <p className="mt-4 text-xs text-slate-500">
                Staff access is restricted to practice team members.
              </p>
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:px-6">
          <p>© 2026 Lakeside Family Dental · Boston, MA</p>
          <div className="flex gap-4">
            <Link className="hover:text-brand-700" href="/">
              Home
            </Link>
            <Link className="hover:text-brand-700" href="/chat">
              Chat with Ava
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
