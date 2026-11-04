import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAMES,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { isStaffSite } from "@/lib/site";

export async function POST(request: NextRequest) {
  const destination = isStaffSite() ? "/login" : "/";
  const response = NextResponse.redirect(
    new URL(destination, request.url),
    303,
  );

  for (const name of SESSION_COOKIE_NAMES) {
    response.cookies.set(name, "", sessionCookieOptions(0));
  }

  return response;
}
