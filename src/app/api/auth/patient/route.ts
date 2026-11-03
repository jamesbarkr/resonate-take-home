import { NextResponse, type NextRequest } from "next/server";
import { loginErrorUrl, safeRedirectPath } from "@/lib/auth/redirect";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { findPatientsByPhoneAndDob } from "@/lib/repositories/patient-repository";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const phone = String(form.get("phone") ?? "").replace(/\D/g, "");
  const dateOfBirth = String(form.get("dateOfBirth") ?? "").trim();
  const next = safeRedirectPath(
    String(form.get("next") ?? ""),
    "/portal",
  );

  if (!/^\d{7,15}$/.test(phone) || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return NextResponse.redirect(
      loginErrorUrl(
        request.url,
        "patient",
        "Enter a valid phone number and date of birth.",
        next,
      ),
      303,
    );
  }

  const matches = findPatientsByPhoneAndDob(phone, dateOfBirth);
  const patient = matches[0];

  if (!patient) {
    return NextResponse.redirect(
      loginErrorUrl(
        request.url,
        "patient",
        "We couldn't match that phone number and date of birth. Check the details or start a chat as a new patient.",
        next,
      ),
      303,
    );
  }

  const response = NextResponse.redirect(
    new URL(safeRedirectPath(next, "/portal"), request.url),
    303,
  );
  response.cookies.set(
    SESSION_COOKIE_NAME,
    createSessionToken({
      role: "patient",
      patientId: patient.id,
      name: patient.fullName,
    }),
    sessionCookieOptions(),
  );

  return response;
}
