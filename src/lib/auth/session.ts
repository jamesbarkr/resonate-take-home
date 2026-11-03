import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

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

export const SESSION_COOKIE_NAME = "lakeside_session";
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

  const expected = sign(encoded);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
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

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
