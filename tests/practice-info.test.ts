import { describe, expect, it } from "vitest";
import {
  getPracticeInfo,
  getPracticeInfoForTopic,
} from "@/lib/domain/practice-info";
import { useTestDatabase } from "./helpers/db";

useTestDatabase();

describe("practice information", () => {
  it("exposes hours, location, and accepted plans", () => {
    const info = getPracticeInfo();
    expect(info.name).toBe("Lakeside Family Dental");
    expect(info.hoursSummary).toContain("Mon–Sat");
    expect(info.hoursSummary).toContain("Sun: Closed");
    expect(info.acceptedPlans).toHaveLength(7);
    expect(info.address).toContain("Boston");
  });

  it("answers insurance and no-insurance topics", () => {
    const insurance = getPracticeInfoForTopic("insurance") as {
      acceptedPlans: string[];
      insuranceNote: string;
    };
    expect(insurance.acceptedPlans).toContain("Delta Dental");
    expect(insurance.insuranceNote).toContain("major dental insurance");

    const noInsurance = getPracticeInfoForTopic("no_insurance") as {
      membershipNote: string;
      financingNote: string;
    };
    expect(noInsurance.membershipNote).toContain("Membership");
    expect(noInsurance.financingNote).toContain("CareCredit");
  });

  it("returns emergency guidance with the office phone", () => {
    const emergency = getPracticeInfoForTopic("emergency") as {
      emergencyNote: string;
      phone: string;
    };
    expect(emergency.emergencyNote).toContain("911");
    expect(emergency.phone).toBe("617-555-0142");
  });
});
