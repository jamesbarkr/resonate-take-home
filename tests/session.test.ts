import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";

describe("signed sessions", () => {
  it("round-trips a patient session", () => {
    const token = createSessionToken({
      role: "patient",
      patientId: "pat_david",
      name: "David Johnson",
    });

    expect(verifySessionToken(token)).toEqual({
      role: "patient",
      patientId: "pat_david",
      name: "David Johnson",
    });
  });

  it("round-trips a staff session", () => {
    const token = createSessionToken({
      role: "staff",
      email: "frontdesk@lakeside.test",
      name: "Front Desk",
    });

    expect(verifySessionToken(token)).toEqual({
      role: "staff",
      email: "frontdesk@lakeside.test",
      name: "Front Desk",
    });
  });

  it("rejects tampered payloads and signatures", () => {
    const token = createSessionToken({
      role: "patient",
      patientId: "pat_david",
      name: "David Johnson",
    });
    const [payload, signature] = token.split(".");

    expect(verifySessionToken(`${payload}.${signature}x`)).toBeNull();
    expect(verifySessionToken(`${payload}x.${signature}`)).toBeNull();
    expect(verifySessionToken("not-a-token")).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });

  it("rejects expired sessions", () => {
    const token = createSessionToken(
      {
        role: "patient",
        patientId: "pat_david",
        name: "David Johnson",
      },
      -1,
    );
    expect(verifySessionToken(token)).toBeNull();
  });
});
