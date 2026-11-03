# Lakeside Family Dental — Patient Assistant

A conversational scheduling assistant for a mock dental practice, built for the
Resonate AI take-home assessment.

> **Status:** Phase 2 scaffold complete. The app shell, database schema, seed
> data, tool contracts, and repository ports are in place. The agent loop, chat
> UI, staff console, and tests land in Phases 3–4.

## What this is

The assistant helps patients:

- Register as a new patient and book a first appointment (cleaning, general
  checkup, or emergency).
- Verify identity as an existing patient and reschedule or cancel.
- Coordinate family appointments, including back-to-back requests.
- Describe an emergency, get the earliest same-day option, and notify staff.
- Ask about insurance, self-pay/membership options, location, and hours.

The design goal is **safe automation**: the language model handles conversation,
while deterministic server code owns availability, validation, and every state
change.

## Architecture

```
Patient browser
      │
      ▼
Next.js App Router (chat UI + /api/chat streaming)
      │
      ▼
Agent loop (DeepSeek V4.1 Flash via Synthetic + AI SDK tool calling)
      │  typed tools, confirmation gates, bounded steps
      ▼
Domain services (deterministic)
  ├── PatientService         identity matching, household lookup
  ├── SchedulingService      availability, slot holds, transactions
  └── StaffNotification      emergency/escalation alerts
      │
      ▼
SQLite + Drizzle ORM (local-first, Postgres-ready ports)
```

Staff console at `/staff` reads the same data: schedule, alerts, flagged
conversations, and feedback.

### Why this shape

| Decision | Rationale |
|----------|-----------|
| Hybrid LLM + deterministic domain | Conversation is probabilistic; booking integrity cannot be. The model never invents slots or writes SQL. |
| Tool-only availability and mutations | Every read/write goes through a validated contract, so the same rules apply in tests, the UI, and the agent. |
| Explicit confirmation before mutations | No accidental bookings, reschedules, or cancellations. The tool contract requires `confirmedByPatient: true`. |
| Slot holds + transactions + idempotency | Prevents double booking under concurrency and duplicate tool retries. |
| SQLite + Drizzle locally | Zero-setup demo as the assessment prefers; repository ports keep hosted Postgres realistic. |
| Synthetic data only | No real PHI in a demo environment; logs are designed to redact sensitive fields. |

## Prioritization

Treating this as a production system for hundreds of locations and 10k+
conversations/day, the build order is:

### P0 — load-bearing
1. New-patient registration and first booking.
2. Existing-patient verification and reschedule/cancel.
3. Availability with relative/subjective date handling and alternative slots.
4. Transactional, conflict-free booking with holds and idempotency.
5. Emergency capture, same-day option, and staff alert.
6. Insurance, no-insurance, location, and hours.
7. Safe failure: retries, timeouts, bounded tool loops, human escalation.
8. Accessible responsive chat and staff console.
9. Scheduling/scenario tests.
10. README, `.env.example`, seed data, and demo video.

### P1 — additive if time remains
- Family multi-booking with back-to-back coordination.
- Feedback capture and basic analytics.
- Configurable staff webhook (Slack/email).

### P2 — documented roadmap, not built
- Real insurance eligibility and payments.
- SMS/voice channels and multilingual support.
- PMS/EHR and calendar integrations.
- Multi-location routing, SSO, HIPAA BAAs, and audit exports.

**Why:** booking integrity and emergency routing have the highest patient
impact. A reliable core plus honest escalation is better than broad, unreliable
automation. Family scheduling reuses the same primitives and is added only after
single booking is correct.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **LLM:** DeepSeek V4.1 Flash via Synthetic's OpenAI-compatible API, using `@ai-sdk/openai-compatible` and the Vercel AI SDK
- **Database:** SQLite via `better-sqlite3` and Drizzle ORM
- **Testing:** Vitest (Phase 4), Playwright for critical UI paths (Phase 4)
- **Deployment:** local by default; optional hosted Postgres if a live URL is needed

## Setup

### Prerequisites

- Node.js 22+ (tested on Node 25)
- npm
- A Synthetic API key from <https://synthetic.new/> (the same key works in any OpenAI-compatible client)

### Install and seed

```bash
npm install
cp .env.example .env.local
# Edit .env.local and set LLM_API_KEY to your Synthetic key
npm run db:reset
npm run dev
```

Open <http://localhost:3000>.

The seed script is deterministic and can be run repeatedly:

```bash
npm run db:reset   # delete local DB, migrate, reseed
npm run db:seed    # reseed only
```

### Environment variables

See `.env.example`. The important ones:

| Variable | Purpose |
|----------|---------|
| `LLM_API_KEY` | Required for live model calls (Synthetic key). Never commit it. |
| `LLM_BASE_URL` | Defaults to `https://api.synthetic.new/openai/v1`. |
| `LLM_MODEL` | Defaults to `hf:deepseek-ai/DeepSeek-V4.1-Flash-1017`. |
| `DATABASE_PATH` | Local SQLite file; defaults to `./data/dental.db`. |
| `PRACTICE_TIMEZONE` | IANA timezone used for scheduling; defaults to `America/New_York`. |
| `STAFF_WEBHOOK_URL` | Optional Slack/email webhook for alerts. |

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Production build. |
| `npm run start` | Run the production build. |
| `npm run typecheck` | TypeScript, no emit. |
| `npm run db:generate` | Generate Drizzle migrations from the schema. |
| `npm run db:migrate` | Apply migrations. |
| `npm run db:seed` | Seed the mock practice. |
| `npm run db:reset` | Delete, migrate, and reseed the local DB. |
| `npm test` | Run the Vitest unit, integration, and scenario suite. |
| `npm run test:e2e` | Run Playwright browser and axe accessibility checks. |

## Testing

```bash
npm test          # 51 Vitest tests
npm run test:e2e  # 4 Playwright tests (install Chromium once with `npx playwright install chromium`)
```

Coverage includes:

- Practice-time conversion, date ranges, and overlap detection.
- Identity matching, idempotent registration, and household lookup.
- Real availability, slot holds, conflict handling, concurrent booking attempts,
  idempotency, reschedule/cancel, out-of-hours and provider-role rejection.
- Every model-facing tool, including safe error responses and audit logging.
- All assessment scenarios: new patient, existing patient, family back-to-back,
  emergency alert, and insurance/no-insurance/hours inquiries.
- Adversarial checks: missing confirmation, wrong identity, oversized input,
  rate limiting, and missing model configuration.
- Playwright keyboard/visibility checks and axe scans on the chat and staff pages
  (no serious or critical accessibility violations).

Live evaluation scripts (require `LLM_API_KEY`):

```bash
npx tsx scripts/smoke-domain.ts     # deterministic domain smoke test
npx tsx scripts/live-agent.ts       # three-turn new-patient booking
npx tsx scripts/live-scenarios.ts   # reschedule, emergency, family, insurance
npx tsx scripts/live-emergency.ts   # emergency triage + same-day booking
```

## Project structure

```
src/
  app/                     Next.js routes (/, /chat, /staff, /api/*)
  components/chat/         Accessible streaming chat UI
  lib/
    agent/                 Model config, system prompt, tool contracts, tools
    domain/                Deterministic services, ports, shared types
    repositories/          Drizzle-backed read/write helpers
    db/                    Schema, client, migrations, seed
    security/              In-memory rate limiting
data/
  dental.db                Local SQLite database (gitignored)
drizzle/                   Generated migrations
tests/
  *.test.ts                Vitest unit, integration, and scenario tests
  e2e/ui.spec.ts           Playwright + axe checks
scripts/                   Domain smoke test and live evaluation scripts
```

## Mock practice and seed data

- **Practice:** Lakeside Family Dental, Boston, MA. Mon–Sat, 8:00 AM–6:00 PM.
- **Providers:** Dr. Maya Chen and Dr. Omar Haddad (dentists), Priya Patel, RDH
  (hygienist).
- **Appointment types:** Cleaning (45 min), General checkup (30 min), Emergency
  (30 min). Cleanings are scheduled with the hygienist; exams and emergencies
  with a dentist.
- **Patients:** 9 synthetic patients across 5 households, including the Johnson
  family (two adults, two children), the Nguyens (spouses), a self-pay patient,
  and single-patient households. All data is fake.

## Design notes and roadmap

- **Subjective dates:** the model passes a structured date range; the server
  resolves it in practice time and restates explicit dates before confirmation.
- **Identity verification:** phone + date of birth + name. Production would add
  OTP; the demo deliberately avoids account enumeration.
- **Failures:** model timeout, rate limit, or malformed tool output falls back to
  a safe message and an escalation ticket. The booking path does not depend on
  the model staying online.
- **Accessibility:** semantic landmarks, labeled controls, keyboard/focus
  management, contrast, and no color-only status cues.
- **Known limitations:** no real payments or insurance eligibility, no
  SMS/voice, no PMS integration, single practice/timezone. These are deliberate
  scope decisions for a 4–8 hour assessment.

## Demo video

_To be recorded in Phase 5._ It will cover the build/deploy, the core patient
journeys, the architecture and prioritization rationale, and the main challenges
and trade-offs.
