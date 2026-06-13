import { describe, expect, it } from "vitest";
import {
  amountsMatch,
  buildFakedExtraction,
  compareReceiptToClaim,
  datesMatch,
  getReceiptMimeType,
  isPdfReceipt,
  normalizeExtractedDate,
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

  it("normalizes extracted dates for storage", () => {
    expect(normalizeExtractedDate("")).toBeNull();
    expect(normalizeExtractedDate("   ")).toBeNull();
    expect(normalizeExtractedDate("2024-06-01T00:00:00")).toBe("2024-06-01");
    expect(normalizeExtractedDate("not-a-date")).toBeNull();
  });

  it("fails validation when extracted date is empty", () => {
    const result = compareReceiptToClaim(
      { patientName: "John Smith", amount: 150, date: "" },
      claim,
      "live"
    );
    expect(result.dateMatch).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.extractedDate).toBe("");
    expect(result.reasons).toContain("Service date missing from receipt scan");
  });

  it("fails validation when patient name is missing", () => {
    const result = compareReceiptToClaim(
      { patientName: "", amount: 150, date: "2024-06-01" },
      claim,
      "live"
    );
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain("Patient name missing from receipt scan");
  });

  it("fails validation when amount is missing", () => {
    const result = compareReceiptToClaim(
      { patientName: "John Smith", amount: NaN, date: "2024-06-01" },
      claim,
      "live"
    );
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain("Amount missing from receipt scan");
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

  it("detects pdf receipt data urls", () => {
    const pdfUrl = "data:application/pdf;base64,abc123";
    const imageUrl = "data:image/png;base64,abc123";
    expect(isPdfReceipt(pdfUrl)).toBe(true);
    expect(isPdfReceipt(imageUrl)).toBe(false);
    expect(getReceiptMimeType(pdfUrl)).toBe("application/pdf");
  });
});
