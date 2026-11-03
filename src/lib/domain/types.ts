export type AppointmentTypeSlug = "cleaning" | "general_checkup" | "emergency";

export type ProviderRole = "dentist" | "hygienist";

export type AppointmentStatus =
  | "booked"
  | "cancelled"
  | "completed"
  | "no_show";

export type AlertKind = "emergency" | "escalation" | "callback";

export type AlertUrgency = "low" | "medium" | "high";
