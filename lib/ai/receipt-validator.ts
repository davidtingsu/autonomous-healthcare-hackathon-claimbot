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

export type ReceiptValidationInput = {
  claimedAmount: number;
  serviceDate: string;
  expectedPatientName: string;
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
  const patientNameMatch = patientNamesMatch(
    extracted.patientName,
    claim.expectedPatientName
  );
  const amountMatch = amountsMatch(extracted.amount, claim.claimedAmount);
  const dateMatch = datesMatch(extracted.date, claim.serviceDate);
  const passed = patientNameMatch && amountMatch && dateMatch;
  const reasons: string[] = [];

  if (!patientNameMatch) {
    reasons.push(
      `Patient name mismatch: receipt "${extracted.patientName}" vs expected "${claim.expectedPatientName}"`
    );
  }
  if (!amountMatch) {
    reasons.push(
      `Amount mismatch: receipt $${extracted.amount} vs claimed $${claim.claimedAmount}`
    );
  }
  if (!dateMatch) {
    reasons.push(
      `Date mismatch: receipt ${extracted.date} vs service date ${claim.serviceDate}`
    );
  }
  if (mode === "faked") {
    reasons.push("AI validation faked — no API key; using ClaimRequest data");
  }

  return {
    mode,
    extractedPatientName: extracted.patientName,
    extractedAmount: extracted.amount,
    extractedDate: extracted.date,
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
            {
              type: "image",
              image: claim.receiptUrl ?? "",
            },
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
