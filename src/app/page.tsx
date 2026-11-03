import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lakeside Family Dental | Boston, MA",
  description:
    "Gentle, modern dental care for the whole family. Book cleanings, checkups, and same-day emergency visits online.",
};

const services = [
  {
    title: "Cleanings & prevention",
    copy: "Routine hygiene visits with a registered dental hygienist, plus guidance that actually fits your routine.",
    detail: "45-minute visits · most insurance accepted",
  },
  {
    title: "Exams & treatment",
    copy: "Comprehensive exams with a dentist, clear explanations, and a plan you can understand before you decide.",
    detail: "30-minute visits · new patients welcome",
  },
  {
    title: "Emergency care",
    copy: "Urgent pain, swelling, or a dental injury. We reserve same-day slots and alert the clinical team.",
    detail: "Same-day availability · call 911 for life-threatening symptoms",
  },
];

const reasons = [
  {
    title: "Real availability, not a callback",
    copy: "Ava checks live openings and confirms the details with you before anything is booked.",
  },
  {
    title: "Care for the whole household",
    copy: "Book back-to-back cleanings for kids, a spouse, or anyone else in your family.",
  },
  {
    title: "Clear insurance guidance",
    copy: "We accept major dental plans and offer self-pay, membership, and financing options.",
  },
  {
    title: "Built for real life",
    copy: "Keyboard-friendly, screen-reader friendly, and comfortable on the phone in your hand.",
  },
];

export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
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
                Boston, MA · Mon–Sat
              </span>
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex"
          >
            <a className="hover:text-brand-700" href="#services">
              Services
            </a>
            <a className="hover:text-brand-700" href="#why">
              Why Lakeside
            </a>
            <a className="hover:text-brand-700" href="#visit">
              Visit
            </a>
            {session?.role === "staff" ? (
              <Link className="hover:text-brand-700" href="/staff">
                Staff console
              </Link>
            ) : (
              <Link className="hover:text-brand-700" href="/login?role=staff">
                Staff
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {session?.role === "patient" ? (
              <>
                <Link
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-700"
                  href="/portal"
                >
                  My portal
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-700"
                    type="submit"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-700"
                href="/login?role=patient"
              >
                Patient portal
              </Link>
            )}
            <Link
              className="rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 sm:text-sm"
              href="/chat"
            >
              Book online
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,var(--color-brand-100),transparent_45%)]" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
          <div>
            <p className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
              Accepting new patients
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-brand-900 sm:text-5xl lg:text-6xl">
              Dentistry that fits your life.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Gentle, modern care for the whole family — cleanings, checkups,
              and same-day emergency visits. Our virtual front desk can find a
              time that works and confirm it with you in minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                href="/chat"
              >
                Book an appointment
              </Link>
              <Link
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-700"
                href={session?.role === "patient" ? "/portal" : "/login?role=patient"}
              >
                Patient portal
              </Link>
              <a
                className="rounded-full px-5 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                href="tel:6175550142"
              >
                Call 617-555-0142
              </a>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Mon–Sat, 8:00 AM–6:00 PM · Most major insurance accepted ·
              Self-pay and membership options
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-4 rounded-[2rem] bg-brand-100/60 blur-2xl"
            />
            <div className="relative rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-semibold text-white"
                  >
                    A
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-900">
                      Ava · virtual front desk
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                      />
                      Online now
                    </p>
                  </div>
                </div>
                <Link
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  href="/login?role=patient"
                >
                  Sign in
                </Link>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-slate-700">
                  Hi! I can help you book a cleaning, move an appointment, or
                  arrange care for the whole family. What do you need?
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-3 text-white">
                  Can I get a cleaning next week?
                </div>
                <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-slate-700">
                  I have Monday at 8:00 AM with Priya Patel. Should I book that
                  for you?
                </div>
              </div>

              <Link
                className="mt-5 block rounded-full bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700"
                href="/chat"
              >
                Start a conversation
              </Link>
              <p className="mt-2 text-center text-xs text-slate-500">
                No account needed to book as a new patient.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white" id="services">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              Care for every stage
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-brand-900 sm:text-4xl">
              Straightforward visits, from routine to urgent.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {services.map((service) => (
              <article
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
                key={service.title}
              >
                <h3 className="text-lg font-semibold text-brand-900">
                  {service.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {service.copy}
                </p>
                <p className="mt-4 text-xs font-medium text-brand-700">
                  {service.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20" id="why">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              Why families choose Lakeside
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-brand-900 sm:text-4xl">
              Less runaround. More actual care.
            </h2>
            <p className="mt-4 text-slate-600">
              We built the front desk around the questions patients actually
              ask: what is available, what will it cost, and how do I get the
              whole family seen without spending a Saturday on the phone.
            </p>
            <Link
              className="mt-6 inline-block rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
              href="/chat"
            >
              Talk to Ava
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {reasons.map((reason) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                key={reason.title}
              >
                <h3 className="text-sm font-semibold text-brand-900">
                  {reason.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {reason.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white" id="visit">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:py-20">
          <div>
            <h2 className="text-2xl font-semibold text-brand-900">Visit us</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              428 Harborview Avenue
              <br />
              Boston, MA 02128
              <br />
              <a
                className="font-medium text-brand-700 hover:text-brand-900"
                href="tel:6175550142"
              >
                617-555-0142
              </a>
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-brand-900">Hours</h2>
            <dl className="mt-3 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between gap-4">
                <dt>Monday–Friday</dt>
                <dd>8:00 AM–6:00 PM</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Saturday</dt>
                <dd>8:00 AM–6:00 PM</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Sunday</dt>
                <dd>Closed</dd>
              </div>
            </dl>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-brand-900">
              Insurance & payment
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              We accept major dental plans, including Delta Dental, Cigna,
              MetLife, Aetna, Guardian, United Concordia, and Blue Cross Blue
              Shield. No insurance? Ask about self-pay pricing, our membership
              plan, or CareCredit financing.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <div className="rounded-[2rem] bg-brand-900 px-6 py-10 text-white sm:px-10 sm:py-12">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">
                Ready when you are.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-100">
                Start a conversation for a cleaning, checkup, family visit, or
                urgent concern. Ava will confirm the details before anything is
                booked.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-brand-900 hover:bg-brand-50"
                href="/chat"
              >
                Book online
              </Link>
              <a
                className="rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                href="tel:6175550142"
              >
                Call the office
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-900">
              Lakeside Family Dental
            </p>
            <p className="mt-1 text-xs text-slate-500">
              428 Harborview Avenue, Boston, MA 02128 · 617-555-0142
            </p>
          </div>
          <div className="flex flex-wrap gap-5 text-xs font-medium text-slate-600">
            <a className="hover:text-brand-700" href="#services">
              Services
            </a>
            <Link className="hover:text-brand-700" href="/login?role=patient">
              Patient portal
            </Link>
            <Link className="hover:text-brand-700" href="/login?role=staff">
              Staff sign in
            </Link>
            <span className="text-slate-600">
              © 2026 Lakeside Family Dental
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
