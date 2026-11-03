const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Lakeside Family Dental";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-600">
          {appName}
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-brand-900 sm:text-5xl">
          A calm, capable scheduling assistant for every patient.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
          Book a cleaning, move an appointment, coordinate the whole family, or
          get urgent help. The assistant explains every step and confirms before
          changing anything.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm transition hover:border-brand-500 hover:shadow-md"
          href="/chat"
        >
          <h2 className="text-xl font-semibold text-brand-900">Patient chat</h2>
          <p className="mt-2 text-slate-600">
            Start a conversation with the dental practice assistant.
          </p>
          <span className="mt-5 inline-block text-sm font-semibold text-brand-600">
            Open chat →
          </span>
        </a>
        <a
          className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm transition hover:border-brand-500 hover:shadow-md"
          href="/staff"
        >
          <h2 className="text-xl font-semibold text-brand-900">Staff console</h2>
          <p className="mt-2 text-slate-600">
            Review today&apos;s schedule, emergency alerts, and escalations.
          </p>
          <span className="mt-5 inline-block text-sm font-semibold text-brand-600">
            Open console →
          </span>
        </a>
      </div>

      <footer className="text-sm text-slate-500">
        Next.js · DeepSeek tool calling · SQLite · synthetic patient data
      </footer>
    </main>
  );
}
