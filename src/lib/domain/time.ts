import { addDays, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const PRACTICE_TIMEZONE =
  process.env.PRACTICE_TIMEZONE ?? "America/New_York";

export function practiceDateString(date = new Date()): string {
  return formatInTimeZone(date, PRACTICE_TIMEZONE, "yyyy-MM-dd");
}

export function practiceDateFromIso(iso: string): string {
  return formatInTimeZone(new Date(iso), PRACTICE_TIMEZONE, "yyyy-MM-dd");
}

export function practiceTimeFromIso(iso: string): string {
  return formatInTimeZone(new Date(iso), PRACTICE_TIMEZONE, "HH:mm");
}

export function formatPracticeDate(isoOrDate: string | Date): string {
  const date =
    typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return formatInTimeZone(date, PRACTICE_TIMEZONE, "EEEE, MMMM d");
}

export function formatPracticeDateTime(iso: string): string {
  return formatInTimeZone(
    new Date(iso),
    PRACTICE_TIMEZONE,
    "EEEE, MMMM d 'at' h:mm a",
  );
}

export function formatPracticeTime(iso: string): string {
  return formatInTimeZone(new Date(iso), PRACTICE_TIMEZONE, "h:mm a");
}

export function addDaysToDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00Z`);
  return format(addDays(date, days), "yyyy-MM-dd");
}

export function dayOfWeekForDateString(dateString: string): number {
  return new Date(`${dateString}T12:00:00Z`).getUTCDay();
}

export function localDateTimeToIso(
  dateString: string,
  time: string,
): string {
  return fromZonedTime(`${dateString}T${time}:00`, PRACTICE_TIMEZONE).toISOString();
}

export function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  let guard = 0;

  while (cursor <= endDate && guard < 62) {
    dates.push(cursor);
    cursor = addDaysToDateString(cursor, 1);
    guard += 1;
  }

  return dates;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function isFutureIso(iso: string, leadMinutes = 0): boolean {
  return Date.parse(iso) >= Date.now() + leadMinutes * 60_000;
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(aEnd) > Date.parse(bStart);
}
