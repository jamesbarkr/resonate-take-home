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

async function withSiteRole<T>(
  role: "patient" | "staff",
  fn: () => Promise<T>,
): Promise<T> {
  const saved = process.env.SITE_ROLE;
  process.env.SITE_ROLE = role;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.SITE_ROLE;
    else process.env.SITE_ROLE = saved;
  }
}

const patientFields = {
  phone: "617-555-0102",
  dateOfBirth: "1990-11-30",
};

const staffFields = {
  email: "frontdesk@lakeside.test",
  password: "frontdesk-demo",
};

describe("mock auth routes", () => {
  it("signs in a seeded patient with phone and date of birth", async () => {
    const response = await withSiteRole("patient", () =>
      patientLogin(
        formRequest("http://localhost/api/auth/patient", patientFields),
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/portal");
    expect(response.headers.get("set-cookie")).toContain(
      "lakeside_patient_session=",
    );
  });

  it("rejects an unknown patient without revealing account existence", async () => {
    const response = await withSiteRole("patient", () =>
      patientLogin(
        formRequest("http://localhost/api/auth/patient", {
          ...patientFields,
          phone: "617-555-9999",
        }),
      ),
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login?");
    expect(location).toContain("error=");
    expect(location).not.toContain("role=");
  });

  it("signs in staff with the configured credentials", async () => {
    const response = await withSiteRole("staff", () =>
      staffLogin(
        formRequest("http://localhost/api/auth/staff", staffFields),
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/staff");
    expect(response.headers.get("set-cookie")).toContain(
      "lakeside_staff_session=",
    );
  });

  it("rejects invalid staff credentials", async () => {
    const response = await withSiteRole("staff", () =>
      staffLogin(
        formRequest("http://localhost/api/auth/staff", {
          ...staffFields,
          password: "wrong-password",
        }),
      ),
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login?");
    expect(location).toContain("error=");
    expect(location).not.toContain("role=");
  });

  it("does not expose the staff login on the patient site", async () => {
    const response = await withSiteRole("patient", () =>
      staffLogin(
        formRequest("http://localhost/api/auth/staff", staffFields),
      ),
    );
    expect(response.status).toBe(404);
  });

  it("does not expose the patient login on the staff site", async () => {
    const response = await withSiteRole("staff", () =>
      patientLogin(
        formRequest("http://localhost/api/auth/patient", patientFields),
      ),
    );
    expect(response.status).toBe(404);
  });
});
