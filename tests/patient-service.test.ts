import { describe, expect, it } from "vitest";
import { patientService } from "@/lib/domain/patient-service";
import { useTestDatabase } from "./helpers/db";

useTestDatabase();

describe("patient identity and registration", () => {
  it("matches an existing patient by phone, DOB, and name", async () => {
    const matches = await patientService.findMatches({
      fullName: "David Johnson",
      phone: "(617) 555-0101",
      dateOfBirth: "1985-04-12",
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].patient.id).toBe("pat_david");
    expect(matches[0].matchedOn).toEqual({
      name: true,
      phone: true,
      dateOfBirth: true,
    });
  });

  it("does not match when the date of birth is wrong", async () => {
    const matches = await patientService.findMatches({
      fullName: "David Johnson",
      phone: "6175550101",
      dateOfBirth: "1985-04-13",
    });

    expect(matches).toHaveLength(0);
  });

  it("does not match when the phone is wrong", async () => {
    const matches = await patientService.findMatches({
      fullName: "David Johnson",
      phone: "6175559999",
      dateOfBirth: "1985-04-12",
    });

    expect(matches).toHaveLength(0);
  });

  it("tolerates a nickname when the surname and phone match", async () => {
    const matches = await patientService.findMatches({
      fullName: "Dave Johnson",
      phone: "6175550101",
      dateOfBirth: "1985-04-12",
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].matchedOn.name).toBe(true);
  });

  it("creates a new patient with a household and is idempotent", async () => {
    const input = {
      fullName: "Taylor Morgan",
      phone: "617-555-0188",
      dateOfBirth: "1998-08-19",
      insuranceName: "Aetna",
    };

    const first = await patientService.create(input);
    const second = await patientService.create(input);

    expect(second.id).toBe(first.id);
    expect(first.phone).toBe("6175550188");
    expect(first.householdId).toBeTruthy();
  });

  it("lists all members of a household", async () => {
    const household = await patientService.listHousehold("pat_david");
    const names = household.map((patient) => patient.fullName).sort();

    expect(names).toEqual([
      "David Johnson",
      "Mia Johnson",
      "Noah Johnson",
      "Sarah Johnson",
    ]);
  });
});
