# Domain layer

Deterministic business logic lives here. The agent and the staff console must
both go through these services; neither may mutate tables directly.

## Ports

`ports.ts` defines the interfaces that the tool layer depends on:

- `PatientService` — find matches, create patients, household lookup.
- `SchedulingService` — availability, slot holds, book, reschedule, cancel, list.
- `StaffNotificationService` — persist and optionally deliver staff alerts.

Phase 3 implements these against SQLite. A hosted Postgres adapter should be able
to replace the implementations without changing the tool contracts or prompts.

## Rules to enforce in implementations

- Practice hours are Mon–Sat, 8:00 AM–6:00 PM in `PRACTICE_TIMEZONE`.
- Cleaning requires a hygienist; checkups and emergencies require a dentist.
- Do not offer a slot that overlaps an active appointment or a live slot hold.
- Holds expire after five minutes; expired holds are deleted before reuse.
- Book/reschedule/cancel run in a transaction and re-check conflicts.
- Cancelled appointments free their slot; completed/no-show do not.
- Family bookings are sequential; a partial failure must be reported clearly or
  rolled back.
- Emergency bookings reserve same-day capacity and always create a staff alert.

## Error model (Phase 3)

Services should return typed, user-safe failures rather than raw SQLite errors:

- `SLOT_UNAVAILABLE` — the slot was taken or held; offer alternatives.
- `OUTSIDE_HOURS` — requested time is not in a provider block.
- `PROVIDER_NOT_QUALIFIED` — appointment type / provider role mismatch.
- `PATIENT_NOT_FOUND` — identity match failed (generic, no enumeration).
- `APPOINTMENT_NOT_FOUND` / `APPOINTMENT_NOT_EDITABLE`.
- `IDEMPOTENCY_CONFLICT` — same key used for different payloads.
