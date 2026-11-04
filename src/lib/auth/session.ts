import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { safeEqual } from "@/lib/auth/safe-equal";

export type PatientSession = {
  role: "patient";
  patientId: string;
  name: string;
};

export type StaffSession = {
  role: "staff";
  email: string;
  name: string;
};

export type Session = PatientSession | StaffSession;

type SessionPayload = Session & { exp: number };

export const PATIENT_SESSION_COOKIE_NAME = "lakeside_patient_session";
export const STAFF_SESSION_COOKIE_NAME = "lakeside_staff_session";
export const SESSION_COOKIE_NAMES = [
  PATIENT_SESSION_COOKIE_NAME,
  STAFF_SESSION_COOKIE_NAME,
] as const;

const SESSION_COOKIE_BY_ROLE = {
  patient: PATIENT_SESSION_COOKIE_NAME,
  staff: STAFF_SESSION_COOKIE_NAME,
} as const;

const DEFAULT_SECRET = "local-development-secret-change-me";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? DEFAULT_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(
  session: Session,
  ttlSeconds = SESSION_TTL_SECONDS,
): string {
  const payload: SessionPayload = {
    ...session,
    exp: Date.now() + ttlSeconds * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  if (!safeEqual(signature, sign(encoded))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;

    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now()) {
      return null;
    }

    if (
      parsed.role === "patient" &&
      typeof parsed.patientId === "string" &&
      typeof parsed.name === "string"
    ) {
      return {
        role: "patient",
        patientId: parsed.patientId,
        name: parsed.name,
      };
    }

    if (
      parsed.role === "staff" &&
      typeof parsed.email === "string" &&
      typeof parsed.name === "string"
    ) {
      return { role: "staff", email: parsed.email, name: parsed.name };
    }

    return null;
  } catch {
    return null;
  }
}

async function getSessionForRole<R extends Session["role"]>(
  role: R,
): Promise<Extract<Session, { role: R }> | null> {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE_BY_ROLE[role])?.value,
  );
  return session?.role === role
    ? (session as Extract<Session, { role: R }>)
    : null;
}

export const getPatientSession = () => getSessionForRole("patient");
export const getStaffSession = () => getSessionForRole("staff");

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
