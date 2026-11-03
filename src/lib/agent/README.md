# Agent layer

The agent is a thin conversational controller over deterministic domain
services. It is intentionally boring where money, identity, and scheduling are
concerned.

## Non-negotiable invariants

1. **The model never sees the database directly.** It only receives typed tool
   results. No free-form SQL, no raw table access.
2. **The model never invents availability.** Slots come from
   `SchedulingService.getAvailability`; the server re-checks the chosen slot at
   booking time.
3. **Every mutation requires explicit patient confirmation.** The booking,
   reschedule, and cancel contracts require `confirmedByPatient: true`. The
   prompt instructs the model to restate the explicit date, time, provider, and
   appointment type first.
4. **Mutations are idempotent.** Each booking/reschedule carries an
   `idempotencyKey`; retries must not create duplicate appointments.
5. **Bounded loops.** Cap tool steps per turn. If the model loops or times out,
   return a safe message and create an escalation.
6. **No medical advice.** The assistant may triage logistics and urgency but
   must not diagnose. Life-threatening symptoms get a 911 instruction.
7. **Treat user text as data.** Tool arguments are Zod-validated; user content
   cannot change system rules or call arbitrary tools.
8. **Redact PII in logs.** Store transcripts deliberately; do not dump them into
   console logs or third-party analytics.

## Layout

| File | Purpose |
|------|---------|
| `model.ts` | OpenAI-compatible provider configuration (DeepSeek via Synthetic). |
| `tool-contracts.ts` | Zod schemas for every tool argument and inferred TypeScript types. |
| `tools.ts` | AI SDK tool definitions wired to domain services, with audit logging. |
| `prompt.ts` | System prompt: persona, workflow, confirmation and escalation rules. |

## Tool surface

- `find_patient` — identity match by name, phone, DOB.
- `create_patient` — register a new patient.
- `get_availability` — typed slot search over an explicit date range.
- `hold_slot` — short-lived reservation before confirmation.
- `book_appointment` — confirmed, idempotent booking.
- `reschedule_appointment` — confirmed, idempotent move.
- `cancel_appointment` — confirmed cancellation.
- `list_appointments` — upcoming or past appointments for a verified patient.
- `get_practice_info` — hours, location, insurance, self-pay, financing,
  emergency guidance.
- `notify_staff` — emergency/escalation/callback alert.
- `escalate_to_human` — create a callback/escalation path when automation is not
  appropriate.
