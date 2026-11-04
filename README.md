# Lakeside Family Dental: Patient Assistant

A conversational scheduling assistant for a mock dental practice, built for the
Resonate AI take-home assessment.

> **Status:** Complete. The patient site, staff workspace, deterministic
> scheduling layer, DeepSeek tool calling, tests, and documentation are in
> place. The demo uses synthetic patient data only.

## What this is

The assistant helps patients:

- Register as a new patient and book a first appointment (cleaning, general
  checkup, or emergency).
- Verify identity as an existing patient and reschedule or cancel.
- Coordinate family appointments, including back-to-back requests.
- Describe an emergency, get the earliest same-day option, and notify staff.
- Ask about insurance, self-pay, membership, financing, location, and hours.

Staff get a separate workspace for the schedule, emergency/escalation alerts,
conversation transcripts, and the tool-call audit trail.

The design goal is **safe automation**: the language model handles conversation,
while deterministic server code owns availability, validation, authorization,
and every state change.

### Beyond the core scenarios

These additions go beyond the core scenario list:

- **Separate patient site and staff workspace** with independent sign-in UIs,
  route guards, and session cookies.
- **Patient portal** showing real upcoming appointments, profile, and household.
- **Staff console** with live schedule, urgent alerts, transcript review, and a
  tool-call audit trail.
- **Tool-level authorization** limiting reads and mutations to the verified
  patient and their household.
- **Conversation design rules** such as one question per reply, explicit
  confirmation, no medical advice, and 911 escalation for red flags.
- **Safe Markdown rendering** for assistant replies, with raw HTML disabled.
- **Accessibility and browser tests** using Playwright and axe.

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

The staff workspace runs as a separate site (`SITE_ROLE=staff`, port 3001) and
reads the same data: schedule, alerts, conversations, and the tool-call audit.

### Data model

- `patients` and `households` for synthetic demographics, phone, DOB, insurance.
- `providers` and `appointment_types` for dentist/hygienist roles and visit
  lengths.
- `availability_blocks`, `appointments`, and `slot_holds` for real slots,
  bookings, five-minute holds, and conflict protection.
- `conversations`, `messages`, and `tool_calls` for transcript and staff-only
  audit.
- `staff_alerts` for emergency, escalation, and callback requests.

### Why this shape

| Decision | Rationale |
|----------|-----------|
| Hybrid LLM + deterministic domain | Conversation is probabilistic; booking integrity cannot be. The model never invents slots or writes SQL. |
| Tool-only availability and mutations | Every read/write goes through a validated contract, so the same rules apply in tests, the UI, and the agent. |
| Explicit confirmation before mutations | No accidental bookings, reschedules, or cancellations. The tool contract requires `confirmedByPatient: true`. |
| Slot holds + transactions + idempotency | Prevents double booking under concurrency and duplicate tool retries. |
| Tool-level authorization | Patient and appointment operations are scoped to the verified conversation patient and household. |
| Separate patient/staff sites | Different sign-in UIs and cookies; staff routes are absent from the patient site. |
| SQLite + Drizzle locally | Zero-setup demo as the assessment prefers; repository ports keep hosted Postgres realistic. |
| Synthetic data only | No real PHI in a demo environment. Stdout logs avoid patient details; the detailed audit is staff-only. |

## Prioritization

Treating this as a production system for hundreds of locations and 10k+
conversations/day, the build order is:

### P0: load-bearing (built)
1. New-patient registration and first booking.
2. Existing-patient verification and reschedule/cancel.
3. Availability with relative/subjective date handling and alternative slots.
4. Transactional, conflict-free booking with holds and idempotency.
5. Family multi-booking with back-to-back coordination.
6. Emergency capture, same-day option, and staff alert.
7. Insurance, no-insurance, location, and hours.
8. Safe failure: retries, timeouts, bounded tool loops, human escalation.
9. Accessible responsive chat and staff console.
10. Scheduling/scenario tests.
11. README, `.env.example`, and seed data.

### P1: built after P0
- Separate patient and staff sites with independent sign-in UIs and cookies.
- Patient portal with real appointments, profile, and household.
- Staff console with transcript review and tool-call audit.
- Tool-level patient and appointment authorization.
- Configurable staff notification webhook (Slack/email).

### P2: documented roadmap, not built
- Post-conversation feedback capture and analytics.
- Real insurance eligibility and payments.
- OTP identity verification and role-based access control.
- SMS/voice channels and multilingual support.
- PMS/EHR and calendar integrations.
- Multi-location routing, SSO, HIPAA BAAs, and audit exports.
- Distributed rate limiting and durable job queues.

**Why:** booking integrity and emergency routing have the highest patient
impact. A reliable core plus a clear escalation path is better than broad,
unreliable automation. Family scheduling reuses the same primitives and is built only after
single booking is correct.

### Risk and failure modes

| Risk | Mitigation | Patient impact if it fails |
|------|------------|----------------------------|
| Model invents a slot | Availability comes only from tools; the server re-validates every mutation | A patient is told a time that does not exist |
| Double booking under concurrency | Slot holds, transaction, conflict check, idempotency keys | Lost or duplicate visits |
| Model timeout, rate limit, or outage | Bounded retries, timeouts, safe fallback copy, escalation ticket | The patient cannot finish online and must call |
| Prompt injection or cross-patient access | Typed tools, confirmation gate, conversation-scoped authorization | Unauthorized changes or record disclosure |
| Ambiguous subjective dates | Resolve to explicit dates in practice time and restate before confirmation | Surprise or wrong-date appointments |
| PHI exposure | Synthetic data, UI isolation, staff-only audit, no PII in stdout logs | Demo avoids real PHI; production needs HIPAA controls |

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **LLM:** DeepSeek V4.1 Flash via Synthetic's OpenAI-compatible API, using `@ai-sdk/openai-compatible` and the Vercel AI SDK. The provider is a thin adapter: point `LLM_BASE_URL` and `LLM_MODEL` at any free-tier OpenAI-compatible model to swap it. The demo uses a Synthetic key; no provider-specific code is required.
- **Database:** SQLite via `better-sqlite3` and Drizzle ORM
- **Auth:** Mock patient/staff sign-in with signed, HttpOnly HMAC session cookies, separated by site and cookie name
- **Testing:** Vitest for unit/integration/scenario coverage, Playwright + axe for browser and accessibility checks
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

# Run each of these in its own terminal; both stay running.
npm run dev        # patient site on http://localhost:3000
npm run dev:staff  # staff site on http://localhost:3001
```

Open the patient site at <http://localhost:3000> and the staff workspace at
<http://localhost:3001>.

Demo sign-in:

- **Patient portal** (port 3000): Maria Lopez · `617-555-0102` · `1990-11-30`
- **Staff workspace** (port 3001): `frontdesk@lakeside.test` / `frontdesk-demo`
- **New patients:** start at `/chat` on the patient site without an account.

The seed script is deterministic and can be run repeatedly:

```bash
npm run db:reset   # delete local DB, migrate, reseed
npm run db:seed    # reseed only
```

### Quick test path

| Scenario | Where to start | Example prompt |
|----------|----------------|----------------|
| New patient booking | `http://localhost:3000/chat` | "I'm a new patient. I'd like a cleaning next week. My name is Alex Rivera, phone 617-555-0199, DOB 1992-02-14, no insurance." |
| Existing patient reschedule | `http://localhost:3000/chat` or `/login` | "I'm Maria Lopez, 617-555-0102, DOB 1990-11-30. Move my appointment to later next week." |
| Family back-to-back | `http://localhost:3000/chat` | "Book cleanings next week for David Johnson (617-555-0101, 1985-04-12) and Sarah Johnson (same phone, 1987-09-03)." |
| Emergency + staff alert | `http://localhost:3000/chat`, then `http://localhost:3001/staff` | "I have severe tooth pain and facial swelling." |
| Insurance, hours, location | `http://localhost:3000/chat` | "Do you accept Delta Dental, and what if I don't have insurance?" |
| Staff review | `http://localhost:3001/login` | Sign in, then open alerts and a conversation. |

Reset the database between demo scenes with `npm run db:reset` and refresh the
browser.

### Environment variables

See `.env.example`. The important ones:

| Variable | Purpose |
|----------|---------|
| `LLM_API_KEY` | Required for live model calls (Synthetic key). Never commit it. |
| `LLM_BASE_URL` | Defaults to `https://api.synthetic.new/openai/v1`. |
| `LLM_MODEL` | Defaults to `hf:deepseek-ai/DeepSeek-V4.1-Flash-1017`. |
| `DATABASE_PATH` | Local SQLite file; defaults to `./data/dental.db`. |
| `PRACTICE_TIMEZONE` | IANA timezone used for scheduling; defaults to `America/New_York`. |
| `SESSION_SECRET` | Signs patient/staff session cookies. Change outside local dev. |
| `STAFF_EMAIL` | Mock staff login email. |
| `STAFF_PASSWORD` | Mock staff login password. |
| `STAFF_WEBHOOK_URL` | Optional Slack/email webhook for alerts. |

## Sign-in, roles, and site separation

The codebase serves two separate sites with isolated sign-in UIs and cookies:

- **Patient site** (`SITE_ROLE=patient`, port 3000): landing page, guest chat,
  patient login, and portal. Staff routes are not available here.
- **Staff site** (`SITE_ROLE=staff`, port 3001): staff login and staff console.
  Patient-facing routes redirect back to the staff workspace.
- **Patient portal (`/portal`):** phone + date of birth match against the
  synthetic patient record. The session is a signed, HttpOnly
  `lakeside_patient_session` cookie. When a patient is signed in, the assistant
  receives their verified profile and household context, so it does not ask
  them to re-verify for their own appointments.
- **Staff workspace (`/staff`):** email + password from `STAFF_EMAIL` /
  `STAFF_PASSWORD`, stored in a separate `lakeside_staff_session` cookie. Staff
  routes redirect to `/login` on the staff site when signed out.
- **Guest chat (`/chat`):** new patients can start a conversation without an
  account; the assistant still verifies identity before touching an existing
  record.
- This is intentionally a mock auth layer. Production would use a real identity
  provider, OTP for patients, role-based access control, and audit review.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the patient site on port 3000. |
| `npm run dev:staff` | Start the staff site on port 3001. |
| `npm run dev:clean` | Clear `.next` and start the patient site. |
| `npm run dev:clean:staff` | Clear `.next-staff` and start the staff site. |
| `npm run build` | Production build for the patient site. |
| `npm run build:staff` | Production build for the staff site. |
| `npm run start` | Run the patient production build. |
| `npm run start:staff` | Run the staff production build on port 3001. |
| `npm run typecheck` | TypeScript, no emit. |
| `npm run db:generate` | Generate Drizzle migrations from the schema. |
| `npm run db:migrate` | Apply migrations. |
| `npm run db:seed` | Seed the mock practice. |
| `npm run db:reset` | Delete, migrate, and reseed the local DB. |
| `npm test` | Run the Vitest unit, integration, and scenario suite. |
| `npm run test:e2e` | Run Playwright browser and axe accessibility checks. |

### Troubleshooting

If the chat page reloads continuously or the dev overlay shows repeated Fast
Refresh rebuilds, the generated `.next` cache is stale:

```bash
npm run dev:clean
```

This removes `.next` and starts a fresh dev server.

## Testing

```bash
npm test          # 65 Vitest tests
npm run test:e2e  # 12 Playwright tests (install Chromium once with `npx playwright install chromium`)
```

Coverage includes:

- Practice-time conversion, date ranges, and overlap detection.
- Identity matching, idempotent registration, and household lookup.
- Real availability, slot holds, conflict handling, concurrent booking attempts,
  idempotency, reschedule/cancel, out-of-hours and provider-role rejection.
- Every model-facing tool, including safe error responses and audit logging.
- All assessment scenarios: new patient, existing patient, family back-to-back,
  emergency alert, and insurance/no-insurance/hours inquiries.
- Conversation design: one question per reply, detail confirmation separated
  from the booking step, no medical advice, and 911 guidance for red flags.
- Adversarial checks: missing confirmation, wrong identity, unverified patient
  or appointment IDs, oversized input, rate limiting, and missing model
  configuration.
- Auth checks: signed-session round trips, tamper/expiry rejection, patient and
  staff login routes, patient/staff site isolation, protected-route redirects,
  and the portal.
- Interaction checks: clickable controls use the pointer cursor; disabled
  controls use not-allowed; tall-viewport footers stay pinned and the login
  content stays vertically centered.
- UI data isolation: the patient chat renders only assistant text, safe status
  labels, and structured appointment cards. Raw tool inputs, model-facing tool
  guidance, and reasoning parts are never rendered; the raw audit stays behind
  staff authentication.
- Tool authorization: patient-scoped reads and mutations, including reschedule
  and cancel, are limited to the patient verified in the conversation and their
  household. Unverified IDs return a safe `FORBIDDEN` error.
- Conversational convenience: availability results are informational. Patients
  type the time they want, and the assistant restates details and requires an
  explicit typed confirmation before any mutation. No inferred confirmation or
  slot-selection control sends a message; the empty-state starter prompts are
  explicit choices that still go through normal confirmation.
- Chat scrolling: the transcript is a fixed-height, internally scrolling pane
  that stays pinned to the latest message as the conversation grows.
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
  app/                     Next.js routes (/, /login, /portal, /chat, /staff, /api/*)
  components/chat/         Accessible streaming chat UI
  lib/
    agent/                 Model config, system prompt, tool contracts, tools
    auth/                  Signed session cookies and redirect helpers
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

- **Practice:** Lakeside Family Dental, Boston, MA. Monday to Saturday, 8:00
  AM to 6:00 PM.
- **Providers:** Dr. Maya Chen and Dr. Omar Haddad (dentists), Priya Patel, RDH
  (hygienist).
- **Appointment types:** Cleaning (45 min), General checkup (30 min), Emergency
  (30 min). Cleanings are scheduled with the hygienist; exams and emergencies
  with a dentist.
- **Patients:** 9 synthetic patients across 5 households, including the Johnson
  family (two adults, two children), the Nguyens (spouses), a self-pay patient,
  and single-patient households. All data is fake.

## Design notes and roadmap

- **Conversation design:** one question per reply, a separate confirmation step
  before booking, no medical advice, and 911 guidance for life-threatening red
  flags. Tone adapts to anxious or urgent patients.
- **Subjective dates:** the model passes a structured date range; the server
  resolves it in practice time and restates explicit dates before confirmation.
- **Identity verification:** phone + date of birth + name. Production would add
  OTP; the demo avoids confirming whether a phone number exists.
- **Tool authorization:** patient and appointment operations are limited to the
  verified conversation patient and household. Cross-patient IDs return a safe
  `FORBIDDEN` error rather than exposing another record.
- **Failures:** model timeout, rate limit, or malformed tool output falls back to
  a safe message and an escalation ticket. The booking path does not depend on
  the model staying online.
- **UI isolation:** patient-facing components never render raw tool payloads or
  internal instructions. They show curated labels, appointment cards, and safe
  error copy; tool audit detail is staff-only.
- **Accessibility:** semantic landmarks, labeled controls, keyboard/focus
  management, contrast, and no color-only status cues.
- **Feedback loop today:** staff review transcripts and the tool-call audit and
  acknowledge alerts. Automated post-conversation ratings and analytics are
  listed in P2.
- **Production deployment sketch:** deploy the patient and staff sites behind
  separate hostnames, share Postgres rather than local SQLite, add a real
  identity provider with OTP, move rate limiting to a shared store, and add
  HIPAA controls and BAAs.
- **Known limitations:** mock auth rather than a real identity provider, no
  post-conversation feedback analytics, no real payments or insurance
  eligibility, no SMS/voice, no PMS integration, single practice/timezone, and
  family access is scoped to a shared household. The rate limiter is in-memory
  and assumes a single app instance. These are deliberate scope decisions for a
  4 to 8 hour assessment; production hardening is listed in P2 above.

## Submission checklist

| Requirement | Where |
|-------------|-------|
| Working prototype | Run `npm run dev` and `npm run dev:staff` after seeding |
| Access and testing instructions | Setup, demo sign-in, and Quick test path |
| Architecture overview | Architecture and Data model |
| Technologies used | Tech stack |
| Design decisions and rationale | Why this shape and Prioritization |
| Error handling and fallbacks | Risk and failure modes; Design notes |
| Setup and usage | Setup and Scripts |
| `.env` template | `.env.example` |
| Code organization | Project structure |
| Commit history | `git log --oneline` |
