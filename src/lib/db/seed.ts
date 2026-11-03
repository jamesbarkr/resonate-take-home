import { addMinutes, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { db } from "./client";
import {
  appointmentTypes,
  appointments,
  availabilityBlocks,
  conversations,
  feedback,
  households,
  insurancePlans,
  messages,
  patients,
  practiceConfig,
  providers,
  slotHolds,
  staffAlerts,
  toolCalls,
} from "./schema";

export function seedDatabase() {
  const timezone = process.env.PRACTICE_TIMEZONE ?? "America/New_York";
  const now = new Date();
  const nowIso = now.toISOString();

  function practiceDate(dayOfWeek: number, minDaysAhead = 1): string {
    const todayLocal = formatInTimeZone(now, timezone, "yyyy-MM-dd");
    const base = new Date(`${todayLocal}T12:00:00Z`);
    for (let offset = minDaysAhead; offset < minDaysAhead + 14; offset += 1) {
      const candidate = new Date(base);
      candidate.setUTCDate(base.getUTCDate() + offset);
      if (candidate.getUTCDay() === dayOfWeek) {
        return format(candidate, "yyyy-MM-dd");
      }
    }
    return todayLocal;
  }

  function appointmentWindow(
    date: string,
    time: string,
    durationMinutes: number,
  ): { startsAt: string; endsAt: string } {
    const start = fromZonedTime(`${date}T${time}:00`, timezone);
    return {
      startsAt: start.toISOString(),
      endsAt: addMinutes(start, durationMinutes).toISOString(),
    };
  }

  function insertAvailability(
    providerId: string,
    days: number[],
    ranges: Array<[string, string]>,
  ) {
    for (const dayOfWeek of days) {
      ranges.forEach(([startTime, endTime], rangeIndex) => {
        db.insert(availabilityBlocks)
          .values({
            id: `avail_${providerId}_${dayOfWeek}_${rangeIndex}`,
            providerId,
            dayOfWeek,
            startTime,
            endTime,
          })
          .run();
      });
    }
  }

  // Clear in dependency order so reseeding is deterministic.
  db.delete(feedback).run();
  db.delete(staffAlerts).run();
  db.delete(toolCalls).run();
  db.delete(messages).run();
  db.delete(slotHolds).run();
  db.delete(appointments).run();
  db.delete(conversations).run();
  db.delete(patients).run();
  db.delete(households).run();
  db.delete(availabilityBlocks).run();
  db.delete(appointmentTypes).run();
  db.delete(providers).run();
  db.delete(insurancePlans).run();
  db.delete(practiceConfig).run();

  db.insert(practiceConfig)
    .values({
      id: "default",
      name: "Lakeside Family Dental",
      addressLine1: "428 Harborview Avenue",
      city: "Boston",
      state: "MA",
      postalCode: "02128",
      phone: "617-555-0142",
      timezone,
      hoursJson: JSON.stringify({
        monday: "8:00 AM - 6:00 PM",
        tuesday: "8:00 AM - 6:00 PM",
        wednesday: "8:00 AM - 6:00 PM",
        thursday: "8:00 AM - 6:00 PM",
        friday: "8:00 AM - 6:00 PM",
        saturday: "8:00 AM - 6:00 PM",
        sunday: "Closed",
      }),
      insuranceNote:
        "We accept all major dental insurance plans, including Delta Dental, Cigna, MetLife, Aetna, Guardian, United Concordia, and Blue Cross Blue Shield.",
      selfPayNote:
        "No insurance is not a problem. We offer transparent self-pay pricing, and our team can give you an estimate before treatment.",
      membershipNote:
        "The Lakeside Smile Membership starts at $29/month and covers routine cleanings, exams, and a discount on other treatment.",
      financingNote:
        "We partner with CareCredit for 0% interest financing on qualifying treatment plans.",
      emergencyNote:
        "For a life-threatening emergency, call 911 immediately. For urgent dental pain, we reserve same-day emergency slots and alert our clinical team.",
      updatedAt: nowIso,
    })
    .run();

  const plans = [
    "Delta Dental",
    "Cigna",
    "MetLife",
    "Aetna",
    "Guardian",
    "United Concordia",
    "Blue Cross Blue Shield",
  ];

  plans.forEach((name, index) => {
    db.insert(insurancePlans)
      .values({
        id: `plan_${index + 1}`,
        name,
        accepted: true,
      })
      .run();
  });

  db.insert(providers)
    .values([
      { id: "prov_chen", name: "Dr. Maya Chen", role: "dentist", active: true },
      {
        id: "prov_haddad",
        name: "Dr. Omar Haddad",
        role: "dentist",
        active: true,
      },
      {
        id: "prov_patel",
        name: "Priya Patel, RDH",
        role: "hygienist",
        active: true,
      },
    ])
    .run();

  db.insert(appointmentTypes)
    .values([
      {
        id: "type_cleaning",
        slug: "cleaning",
        name: "Cleaning",
        durationMinutes: 45,
        requiredRole: "hygienist",
        description: "Routine hygiene cleaning with a registered dental hygienist.",
      },
      {
        id: "type_checkup",
        slug: "general_checkup",
        name: "General checkup",
        durationMinutes: 30,
        requiredRole: "dentist",
        description: "Dental exam with a dentist, including a treatment review.",
      },
      {
        id: "type_emergency",
        slug: "emergency",
        name: "Emergency visit",
        durationMinutes: 30,
        requiredRole: "dentist",
        description:
          "Urgent dental concern. We collect a short summary and alert the clinical team.",
      },
    ])
    .run();

  const weekdays = [1, 2, 3, 4, 5];
  insertAvailability("prov_chen", weekdays, [
    ["08:00", "12:00"],
    ["13:00", "18:00"],
  ]);
  insertAvailability("prov_chen", [6], [["08:00", "13:00"]]);
  insertAvailability("prov_haddad", weekdays, [
    ["09:00", "13:00"],
    ["14:00", "18:00"],
  ]);
  insertAvailability("prov_haddad", [6], [["08:00", "12:00"]]);
  insertAvailability("prov_patel", [1, 2, 3, 4, 5, 6], [
    ["08:00", "12:00"],
    ["13:00", "18:00"],
  ]);

  db.insert(households)
    .values([
      { id: "hh_johnson", name: "Johnson Family", createdAt: nowIso },
      { id: "hh_lopez", name: "Maria Lopez", createdAt: nowIso },
      { id: "hh_carter", name: "James Carter", createdAt: nowIso },
      { id: "hh_nguyen", name: "Nguyen Family", createdAt: nowIso },
      { id: "hh_brooks", name: "Ava Brooks", createdAt: nowIso },
    ])
    .run();

  db.insert(patients)
    .values([
      {
        id: "pat_david",
        householdId: "hh_johnson",
        fullName: "David Johnson",
        phone: "6175550101",
        dateOfBirth: "1985-04-12",
        insuranceName: "Delta Dental",
        notes: "Prefers morning appointments.",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "pat_sarah",
        householdId: "hh_johnson",
        fullName: "Sarah Johnson",
        phone: "6175550101",
        dateOfBirth: "1987-09-03",
        insuranceName: "Delta Dental",
        notes: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "pat_mia",
        householdId: "hh_johnson",
        fullName: "Mia Johnson",
        phone: "6175550101",
        dateOfBirth: "2014-06-21",
        insuranceName: "Delta Dental",
        notes: "Pediatric patient. Guardian: Sarah Johnson.",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "pat_noah",
        householdId: "hh_johnson",
        fullName: "Noah Johnson",
        phone: "6175550101",
        dateOfBirth: "2017-02-08",
        insuranceName: "Delta Dental",
        notes: "Pediatric patient. Guardian: Sarah Johnson.",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "pat_maria",
        householdId: "hh_lopez",
        fullName: "Maria Lopez",
        phone: "6175550102",
        dateOfBirth: "1990-11-30",
        insuranceName: "Cigna",
        notes: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "pat_james",
        householdId: "hh_carter",
        fullName: "James Carter",
        phone: "6175550103",
        dateOfBirth: "1979-01-17",
        insuranceName: null,
        notes: "Self-pay patient. Interested in the membership plan.",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "pat_linh",
        householdId: "hh_nguyen",
        fullName: "Linh Nguyen",
        phone: "6175550104",
        dateOfBirth: "1995-07-25",
        insuranceName: "MetLife",
        notes: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "pat_ethan",
        householdId: "hh_nguyen",
        fullName: "Ethan Nguyen",
        phone: "6175550104",
        dateOfBirth: "1993-03-14",
        insuranceName: "MetLife",
        notes: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "pat_ava",
        householdId: "hh_brooks",
        fullName: "Ava Brooks",
        phone: "6175550105",
        dateOfBirth: "2001-12-05",
        insuranceName: "Aetna",
        notes: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ])
    .run();

  const seededAppointments = [
    {
      id: "appt_david_cleaning",
      patientId: "pat_david",
      providerId: "prov_patel",
      appointmentTypeId: "type_cleaning",
      date: practiceDate(1),
      time: "09:00",
      duration: 45,
      notes: "Routine cleaning.",
    },
    {
      id: "appt_maria_checkup",
      patientId: "pat_maria",
      providerId: "prov_chen",
      appointmentTypeId: "type_checkup",
      date: practiceDate(2),
      time: "10:00",
      duration: 30,
      notes: "Follow-up exam.",
    },
    {
      id: "appt_linh_cleaning",
      patientId: "pat_linh",
      providerId: "prov_patel",
      appointmentTypeId: "type_cleaning",
      date: practiceDate(4),
      time: "14:00",
      duration: 45,
      notes: "Routine cleaning.",
    },
  ];

  for (const appointment of seededAppointments) {
    const window = appointmentWindow(
      appointment.date,
      appointment.time,
      appointment.duration,
    );
    db.insert(appointments)
      .values({
        id: appointment.id,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        appointmentTypeId: appointment.appointmentTypeId,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        status: "booked",
        notes: appointment.notes,
        idempotencyKey: `seed_${appointment.id}`,
        conversationId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .run();
  }

  console.log(
    `[db] seeded Lakeside Family Dental (${timezone}) at ${nowIso}: 3 providers, 3 appointment types, 9 patients, ${seededAppointments.length} appointments`,
  );
}

if (process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1])) {
  seedDatabase();
}
