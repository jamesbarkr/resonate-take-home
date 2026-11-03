import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { loginErrorUrl, safeRedirectPath } from "@/lib/auth/redirect";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/auth/session";

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeRedirectPath(String(form.get("next") ?? ""), "/staff");

  const staffEmail = (
    process.env.STAFF_EMAIL ?? "frontdesk@lakeside.test"
  ).trim();
  const staffPassword = process.env.STAFF_PASSWORD ?? "frontdesk-demo";

  const emailMatches = email.toLowerCase() === staffEmail.toLowerCase();
  const passwordMatches = safeEqual(password, staffPassword);

  if (!emailMatches || !passwordMatches) {
    return NextResponse.redirect(
      loginErrorUrl(
        request.url,
        "staff",
        "That email and password combination is not recognized.",
        next,
      ),
      303,
    );
  }

  const response = NextResponse.redirect(
    new URL(safeRedirectPath(next, "/staff"), request.url),
    303,
  );
  response.cookies.set(
    SESSION_COOKIE_NAME,
    createSessionToken({
      role: "staff",
      email: staffEmail,
      name: "Front Desk",
    }),
    sessionCookieOptions(),
  );

  return response;
}
