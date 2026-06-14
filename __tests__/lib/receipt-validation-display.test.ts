import { describe, expect, it } from "vitest";
import { buildValidationIssuesFromResult } from "@/lib/receipt-validation-display";

describe("receipt-validation-display", () => {
  const claim = { claimed_amount: 150, service_date: "2024-06-01" };

  it("includes dependent label in patient name mismatch", () => {
    const issues = buildValidationIssuesFromResult(
      {
        extractedPatientName: "Jane Doe",
        extractedAmount: 150,
        extractedDate: "2024-06-01",
        expectedPatientName: "Emily Smith",
        patientNameMatch: false,
        amountMatch: true,
        dateMatch: true,
        reasons: [],
      },
      claim,
      "Emily Smith (dependent)"
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe(
      'Patient name mismatch: receipt "Jane Doe" vs claim patient "Emily Smith (dependent)".'
    );
  });

  it("includes dependent label when patient name is missing", () => {
    const issues = buildValidationIssuesFromResult(
      {
        extractedPatientName: "",
        extractedAmount: 150,
        extractedDate: "2024-06-01",
        expectedPatientName: "Emily Smith",
        patientNameMatch: false,
        amountMatch: true,
        dateMatch: true,
        reasons: [],
      },
      claim,
      "Emily Smith (dependent)"
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe(
      "Patient name could not be read from the receipt scan. Expected claim patient: Emily Smith (dependent)."
    );
  });
});
