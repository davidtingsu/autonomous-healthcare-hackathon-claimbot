import { describe, expect, it } from "vitest";
import {
  amountsMatch,
  buildFakedExtraction,
  compareReceiptToClaim,
  datesMatch,
  normalizePatientName,
  patientNamesMatch,
} from "@/lib/ai/receipt-validator";

describe("receipt-validator", () => {
  const claim = {
    claimedAmount: 150,
    serviceDate: "2024-06-01",
    expectedPatientName: "John Smith",
  };

  it("normalizes patient names", () => {
    expect(normalizePatientName("Smith, John")).toBe("john smith");
    expect(patientNamesMatch("JOHN SMITH", "John Smith")).toBe(true);
  });

  it("matches amounts within tolerance", () => {
    expect(amountsMatch(150.005, 150)).toBe(true);
    expect(amountsMatch(151, 150)).toBe(false);
  });

  it("matches dates by day", () => {
    expect(datesMatch("2024-06-01T00:00:00", "2024-06-01")).toBe(true);
  });

  it("passes when all fields match", () => {
    const result = compareReceiptToClaim(
      { patientName: "John Smith", amount: 150, date: "2024-06-01" },
      claim,
      "live"
    );
    expect(result.passed).toBe(true);
  });

  it("fails when amount mismatches", () => {
    const result = compareReceiptToClaim(
      { patientName: "John Smith", amount: 200, date: "2024-06-01" },
      claim,
      "live"
    );
    expect(result.passed).toBe(false);
    expect(result.amountMatch).toBe(false);
  });

  it("fakes validation using claim data", () => {
    const result = buildFakedExtraction(claim);
    expect(result.mode).toBe("faked");
    expect(result.passed).toBe(true);
    expect(result.extractedPatientName).toBe("John Smith");
  });
});
