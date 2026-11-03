import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as patientLogin } from "@/app/api/auth/patient/route";
import { POST as staffLogin } from "@/app/api/auth/staff/route";
import { useTestDatabase } from "./helpers/db";

useTestDatabase();

function formRequest(
  url: string,
  fields: Record<string, string>,
): NextRequest {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, value);
  }
  return new NextRequest(url, { method: "POST", body });
}

describe("mock auth routes", () => {
  it("signs in a seeded patient with phone and date of birth", async () => {
    const response = await patientLogin(
      formRequest("http://localhost/api/auth/patient", {
        phone: "617-555-0102",
        dateOfBirth: "1990-11-30",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/portal");
    expect(response.headers.get("set-cookie")).toContain("lakeside_session=");
  });

  it("rejects an unknown patient without revealing account existence", async () => {
    const response = await patientLogin(
      formRequest("http://localhost/api/auth/patient", {
        phone: "617-555-9999",
        dateOfBirth: "1990-11-30",
      }),
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login?");
    expect(location).toContain("role=patient");
    expect(location).toContain("error=");
  });

  it("signs in staff with the configured credentials", async () => {
    const response = await staffLogin(
      formRequest("http://localhost/api/auth/staff", {
        email: "frontdesk@lakeside.test",
        password: "frontdesk-demo",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/staff");
    expect(response.headers.get("set-cookie")).toContain("lakeside_session=");
  });

  it("rejects invalid staff credentials", async () => {
    const response = await staffLogin(
      formRequest("http://localhost/api/auth/staff", {
        email: "frontdesk@lakeside.test",
        password: "wrong-password",
      }),
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login?");
    expect(location).toContain("role=staff");
  });
});
