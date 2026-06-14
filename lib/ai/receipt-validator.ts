import { generateObject } from "ai";
import { z } from "zod";
import { getVisionModel, isLlmAvailable } from "@/lib/ai/providers";

export function normalizePatientName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",").map((s) => s.trim());
    if (first && last) return `${first} ${last}`;
  }
  return trimmed.replace(/\s+/g, " ");
}

export function patientNamesMatch(extracted: string, expected: string): boolean {
  return normalizePatientName(extracted) === normalizePatientName(expected);
}

export function amountsMatch(
  extracted: number,
  claimed: number,
  tolerance = 0.01
): boolean {
  return Math.abs(extracted - claimed) < tolerance;
}

export function datesMatch(extracted: string, serviceDate: string): boolean {
  return extracted.slice(0, 10) === serviceDate.slice(0, 10);
}

export function normalizeExtractedDate(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const day = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export type ReceiptValidationInput = {
  claimedAmount: number;
  serviceDate: string;
  expectedPatientName: string;
  /** Label shown in validation errors; includes "(dependent)" when applicable. */
  expectedPatientLabel?: string;
  receiptUrl?: string | null;
};

export type ReceiptValidationResult = {
  mode: "live" | "faked";
  extractedPatientName: string;
  extractedAmount: number;
  extractedDate: string;
  expectedPatientName: string;
  patientNameMatch: boolean;
  amountMatch: boolean;
  dateMatch: boolean;
  passed: boolean;
  reasons: string[];
};

const receiptSchema = z.object({
  patientName: z.string(),
  amount: z.number(),
  date: z.string(),
});

export function compareReceiptToClaim(
  extracted: { patientName: string; amount: number; date: string },
  claim: ReceiptValidationInput,
  mode: "live" | "faked"
): ReceiptValidationResult {
  const normalizedDate = normalizeExtractedDate(extracted.date);
  const dateForMatch = normalizedDate ?? "";
  const patientNameMissing = !extracted.patientName?.trim();
  const amountMissing =
    extracted.amount == null || Number.isNaN(Number(extracted.amount));
  const dateMissing = !dateForMatch;

  const patientNameMatch =
    !patientNameMissing &&
    patientNamesMatch(extracted.patientName, claim.expectedPatientName);
  const amountMatch =
    !amountMissing && amountsMatch(extracted.amount, claim.claimedAmount);
  const dateMatch = !dateMissing && datesMatch(dateForMatch, claim.serviceDate);

  const passed = patientNameMatch && amountMatch && dateMatch;
  const reasons: string[] = [];
  const expectedLabel = claim.expectedPatientLabel ?? claim.expectedPatientName;

  if (patientNameMissing) {
    reasons.push(
      `Patient name missing from receipt scan (expected claim patient: ${expectedLabel})`
    );
  } else if (!patientNameMatch) {
    reasons.push(
      `Patient name mismatch: receipt "${extracted.patientName}" vs claim patient "${expectedLabel}"`
    );
  }
  if (amountMissing) {
    reasons.push("Amount missing from receipt scan");
  } else if (!amountMatch) {
    reasons.push(
      `Amount mismatch: receipt $${extracted.amount} vs claimed $${claim.claimedAmount}`
    );
  }
  if (dateMissing) {
    reasons.push("Service date missing from receipt scan");
  } else if (!dateMatch) {
    reasons.push(
      `Service date mismatch: receipt ${dateForMatch} vs service date ${claim.serviceDate}`
    );
  }
  if (mode === "faked") {
    reasons.push("AI validation faked — no API key; using ClaimRequest data");
  }

  return {
    mode,
    extractedPatientName: extracted.patientName?.trim() ?? "",
    extractedAmount: amountMissing ? NaN : extracted.amount,
    extractedDate: dateForMatch,
    expectedPatientName: claim.expectedPatientName,
    patientNameMatch,
    amountMatch,
    dateMatch,
    passed,
    reasons,
  };
}

export function buildFakedExtraction(
  claim: ReceiptValidationInput
): ReceiptValidationResult {
  return compareReceiptToClaim(
    {
      patientName: claim.expectedPatientName,
      amount: claim.claimedAmount,
      date: claim.serviceDate,
    },
    claim,
    "faked"
  );
}

export function getReceiptMimeType(receiptUrl: string): string {
  const match = receiptUrl.match(/^data:([^;]+);/);
  return match?.[1] ?? "image/jpeg";
}

export function isPdfReceipt(receiptUrl: string): boolean {
  return getReceiptMimeType(receiptUrl) === "application/pdf";
}

function buildReceiptContentPart(receiptUrl: string) {
  if (isPdfReceipt(receiptUrl)) {
    return {
      type: "file" as const,
      data: receiptUrl,
      mediaType: "application/pdf" as const,
    };
  }
  return {
    type: "image" as const,
    image: receiptUrl,
  };
}

export async function validateReceipt(
  claim: ReceiptValidationInput
): Promise<ReceiptValidationResult> {
  if (!isLlmAvailable()) {
    return buildFakedExtraction(claim);
  }

  try {
    const { object } = await generateObject({
      model: getVisionModel(),
      schema: receiptSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract patient name, total amount, and service date from this medical receipt. Return JSON fields patientName, amount (number), date (YYYY-MM-DD).",
            },
            buildReceiptContentPart(claim.receiptUrl ?? ""),
          ],
        },
      ],
    });

    return compareReceiptToClaim(
      {
        patientName: object.patientName,
        amount: object.amount,
        date: object.date.slice(0, 10),
      },
      claim,
      "live"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown LLM error";
    const faked = buildFakedExtraction(claim);
    faked.reasons.push(`LLM validation failed (${message}); using ClaimRequest data`);
    return { ...faked, mode: "faked" };
  }
}
